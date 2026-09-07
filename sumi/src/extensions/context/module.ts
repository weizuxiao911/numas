/**
 * Context 拓展 — 把编辑器选区 / 终端选区 / 文件树项挂到当前对话.
 *
 * 入口:
 *   - 文件树右键「添加到对话」
 *   - 编辑器选中文本 → 悬浮条
 *   - 终端选中文本 → 悬浮条
 * 契约: chat/commands/chatApi.addToConversation (不 import Chat.tsx, 不走 ask()).
 */
import { Injectable, Autowired } from '@opensumi/di';
import { Domain, URI, CommandRegistry, CommandContribution, Disposable, IDisposable } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution, SlotLocation } from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import type { IEditor } from '@opensumi/ide-editor';
import { FileTreeModelService } from '@opensumi/ide-file-tree-next/lib/browser/services/file-tree-model.service';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common';
import type { ITerminalClient } from '@opensumi/ide-terminal-next/lib/common';

import { addToConversation, type ChatContextItem } from '../chat/commands/chatApi';
import { hideAddToChatFloat, showAddToChatFloat } from './float';
import { displayNameFromPath, hostPathFromUri } from './host-path';
import {
  isFloatButton,
  collectAccessibleIframes,
  eventPointToTop,
  readAnyAccessibleSelection,
} from './dom-selection';

export const ADD_TO_CONVERSATION_COMMAND = {
  id: 'numas.addToConversation',
  label: '添加到对话',
};

@Injectable()
@Domain(CommandContribution, MenuContribution, ClientAppContribution)
export class ContextContribution implements CommandContribution, MenuContribution, ClientAppContribution {
  @Autowired(IMainLayoutService)
  private readonly layoutService!: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService!: WorkbenchEditorService;

  @Autowired(FileTreeModelService)
  private readonly fileTreeModel!: FileTreeModelService;

  @Autowired(ITerminalController)
  private readonly terminalController!: ITerminalController;

  private readonly toDispose = new Disposable();
  private editorBind: IDisposable | null = null;
  private terminalBind: IDisposable | null = null;
  private boundEditorId: string | null = null;
  private boundTerminalId: string | null = null;
  private editorSnapshot: ChatContextItem | null = null;
  private terminalSnapshot: ChatContextItem | null = null;
  private customSnapshot: ChatContextItem | null = null;
  private customAnchor: { x: number; y: number } | null = null;
  private editorPointerDown = false;
  private terminalPointerDown = false;
  private iframeHooked = new WeakSet<HTMLIFrameElement>();
  private observedDocs = new WeakSet<Document>();
  private iframeObservers: MutationObserver[] = [];

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(ADD_TO_CONVERSATION_COMMAND, {
      execute: (uri?: URI, extras?: URI[]) => {
        const list = Array.isArray(extras) && extras.length ? extras : (uri ? [uri] : []);
        const uris = list.length ? list : this.fallbackExplorerUris();
        uris.forEach((u) => this.addFile(u));
      },
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.ExplorerContext, {
      command: ADD_TO_CONVERSATION_COMMAND.id,
      group: '9_numas',
      order: 10,
    });
  }

  onStart(): void {
    this.bindEditor();
    this.toDispose.addDispose(this.editorService.onActiveResourceChange(() => this.bindEditor()));
    this.toDispose.addDispose(this.editorService.onDidCurrentEditorGroupChanged(() => this.bindEditor()));

    this.bindTerminal(this.terminalController.activeClient);
    this.toDispose.addDispose(this.terminalController.onDidChangeActiveTerminal(() => {
      this.bindTerminal(this.terminalController.activeClient);
    }));
    this.toDispose.addDispose(this.terminalController.onDidOpenTerminal(() => {
      this.bindTerminal(this.terminalController.activeClient);
    }));

    this.bindCustomEditors();
    this.toDispose.addDispose({
      dispose: () => {
        this.editorBind?.dispose();
        this.terminalBind?.dispose();
        this.iframeObservers.forEach((mo) => mo.disconnect());
        this.iframeObservers = [];
        hideAddToChatFloat();
      },
    });
  }

  private fallbackExplorerUris(): URI[] {
    const selected = this.fileTreeModel.selectedFiles || [];
    if (selected.length) return selected.map((n) => n.uri).filter(Boolean);
    const ctx = this.fileTreeModel.contextMenuFile;
    return ctx?.uri ? [ctx.uri] : [];
  }

  private addFile(uri: URI | undefined): void {
    const path = hostPathFromUri(uri);
    if (!path) return;
    this.push({ kind: 'file', path, name: displayNameFromPath(path) });
  }

  private push(item: ChatContextItem): void {
    this.revealChat();
    addToConversation(item);
  }

  private revealChat(): void {
    try {
      this.layoutService.toggleSlot(SlotLocation.right, true);
      this.layoutService.getTabbarHandler('chat-panel')?.activate();
    } catch { /* 面板未就绪时仍派事件, Chat 挂载后 flush 队列 */ }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat:ai-reveal'));
    }
  }

  private bindEditor(): void {
    const editor = this.editorService.currentEditor;
    if (editor && this.boundEditorId === editor.getId() && this.editorBind) return;
    this.editorBind?.dispose();
    this.editorBind = null;
    this.boundEditorId = null;
    this.editorSnapshot = null;
    this.editorPointerDown = false;
    hideAddToChatFloat();
    if (!editor?.monacoEditor) return;
    this.boundEditorId = editor.getId();
    const bag = new Disposable();
    const refresh = () => this.onEditorSelection(editor, { show: !this.editorPointerDown });
    bag.addDispose(editor.onSelectionsChanged(refresh));
    const monaco = editor.monacoEditor as any;
    const dom = monaco?.getDomNode?.() as HTMLElement | null;
    const onDown = () => {
      this.editorPointerDown = true;
      hideAddToChatFloat();
    };
    const onUp = () => {
      if (!this.editorPointerDown) return;
      this.editorPointerDown = false;
      this.onEditorSelection(editor, { show: true });
    };
    if (dom) {
      dom.addEventListener('mousedown', onDown);
      bag.addDispose({ dispose: () => dom.removeEventListener('mousedown', onDown) });
    }
    window.addEventListener('mouseup', onUp);
    bag.addDispose({ dispose: () => window.removeEventListener('mouseup', onUp) });
    if (typeof monaco?.onDidScrollChange === 'function') {
      bag.addDispose(monaco.onDidScrollChange(() => {
        if (this.editorSnapshot && !this.editorPointerDown) this.placeEditorFloat(editor);
      }));
    }
    bag.addDispose(editor.onDispose(() => {
      this.editorSnapshot = null;
      this.boundEditorId = null;
      hideAddToChatFloat();
    }));
    this.editorBind = bag;
    refresh();
  }

  private onEditorSelection(editor: IEditor, opts: { show: boolean }): void {
    const monaco = editor.monacoEditor as any;
    const sel = monaco?.getSelection?.();
    const empty = !sel || (typeof sel.isEmpty === 'function' ? sel.isEmpty() : (
      sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn
    ));
    if (empty) {
      this.editorSnapshot = null;
      if (opts.show) {
        hideAddToChatFloat();
        this.restoreOtherFloat();
      }
      return;
    }
    const model = monaco.getModel?.();
    const text = String(model?.getValueInRange?.(sel) || editor.currentDocumentModel?.getText?.(sel) || '').trim();
    if (!text) {
      this.editorSnapshot = null;
      if (opts.show) {
        hideAddToChatFloat();
        this.restoreOtherFloat();
      }
      return;
    }
    const path = hostPathFromUri(editor.currentUri) || this.activeEditorPath();
    const startLine = Math.min(sel.startLineNumber, sel.endLineNumber);
    const endLine = Math.max(sel.startLineNumber, sel.endLineNumber);
    const name = path
      ? `${displayNameFromPath(path)}:${startLine}${endLine !== startLine ? `-${endLine}` : ''}`
      : `选区 ${startLine}-${endLine}`;
    this.editorSnapshot = {
      kind: 'selection',
      source: 'editor',
      path: path || undefined,
      name,
      startLine,
      endLine,
      text,
    };
    if (opts.show) this.placeEditorFloat(editor);
  }

  private placeEditorFloat(editor: IEditor): void {
    const snapshot = this.editorSnapshot;
    if (!snapshot) return;
    const monaco = editor.monacoEditor as any;
    const sel = monaco?.getSelection?.();
    if (!sel) return;
    const end = typeof sel.getPosition === 'function'
      ? sel.getPosition()
      : { lineNumber: sel.positionLineNumber || sel.endLineNumber, column: sel.positionColumn || sel.endColumn };
    const vis = monaco.getScrolledVisiblePosition?.(end);
    const dom = monaco.getDomNode?.() as HTMLElement | null;
    if (!vis || !dom) return;
    const rect = dom.getBoundingClientRect();
    showAddToChatFloat(rect.left + vis.left, rect.top + vis.top + vis.height + 6, () => {
      if (this.editorSnapshot) this.push(this.editorSnapshot);
    });
  }

  private bindTerminal(client: ITerminalClient | undefined): void {
    if (client && this.boundTerminalId === client.id && this.terminalBind) return;
    this.terminalBind?.dispose();
    this.terminalBind = null;
    this.boundTerminalId = null;
    this.terminalSnapshot = null;
    this.terminalPointerDown = false;
    hideAddToChatFloat();
    if (!client?.term) return;
    this.boundTerminalId = client.id;
    const bag = new Disposable();
    const refresh = () => this.onTerminalSelection(client, { show: !this.terminalPointerDown });
    const selDisp = client.term.onSelectionChange(refresh) as IDisposable | void;
    if (selDisp && typeof selDisp.dispose === 'function') bag.addDispose(selDisp);
    const host = client.container;
    const onDown = () => {
      this.terminalPointerDown = true;
      hideAddToChatFloat();
    };
    const onUp = () => {
      if (!this.terminalPointerDown) return;
      this.terminalPointerDown = false;
      this.onTerminalSelection(client, { show: true });
    };
    if (host) {
      host.addEventListener('mousedown', onDown);
      bag.addDispose({ dispose: () => host.removeEventListener('mousedown', onDown) });
    }
    window.addEventListener('mouseup', onUp);
    bag.addDispose({ dispose: () => window.removeEventListener('mouseup', onUp) });
    if (typeof (client.term as any).onScroll === 'function') {
      bag.addDispose((client.term as any).onScroll(() => {
        if (this.terminalSnapshot && !this.terminalPointerDown) this.placeTerminalFloat(client);
      }));
    }
    bag.addDispose(client.onExit(() => {
      this.terminalSnapshot = null;
      this.boundTerminalId = null;
      hideAddToChatFloat();
    }));
    this.terminalBind = bag;
    refresh();
  }

  private onTerminalSelection(client: ITerminalClient, opts: { show: boolean }): void {
    const text = String(client.getSelection?.() || '').trim();
    if (!text) {
      this.terminalSnapshot = null;
      if (opts.show) {
        hideAddToChatFloat();
        this.restoreOtherFloat();
      }
      return;
    }
    this.terminalSnapshot = {
      kind: 'selection',
      source: 'terminal',
      name: client.name || '终端',
      text,
    };
    if (opts.show) this.placeTerminalFloat(client);
  }

  private placeTerminalFloat(client: ITerminalClient): void {
    if (!this.terminalSnapshot) return;
    const host = client.container;
    if (!host) return;
    const blocks = host.querySelectorAll('.xterm-selection div, .xterm-selection');
    let rect: DOMRect | null = null;
    blocks.forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return;
      if (!rect || r.bottom > rect.bottom || (r.bottom === rect.bottom && r.right > rect.right)) rect = r;
    });
    if (!rect) rect = host.getBoundingClientRect();
    const anchor = rect;
    showAddToChatFloat(anchor.right, anchor.bottom + 6, () => {
      if (this.terminalSnapshot) this.push(this.terminalSnapshot);
    });
  }

  private restoreOtherFloat(): void {
    const editor = this.editorService.currentEditor;
    if (this.editorSnapshot && editor && !this.editorPointerDown) {
      this.placeEditorFloat(editor);
      return;
    }
    const term = this.terminalController.activeClient;
    if (this.terminalSnapshot && term && !this.terminalPointerDown) {
      this.placeTerminalFloat(term);
      return;
    }
    if (this.customSnapshot && !this.editorPointerDown && !this.terminalPointerDown) {
      this.placeCustomFloat();
    }
  }

  private activeEditorPath(): string {
    const fromRes = hostPathFromUri(this.editorService.currentResource?.uri);
    if (fromRes) return fromRes;
    const root = document.getElementById('workbench-editor');
    if (!root) return '';
    const tabs = root.querySelectorAll('[data-uri]');
    for (let i = 0; i < tabs.length; i++) {
      const el = tabs[i] as HTMLElement;
      const current = Array.from(el.classList).some(
        (c) => c.includes('kt_editor_tab_current') && !c.includes('prev') && !c.includes('next'),
      );
      if (!current) continue;
      const raw = el.getAttribute('data-uri') || '';
      if (!raw) continue;
      try {
        const uri = URI.parse(raw);
        return hostPathFromUri(uri);
      } catch {
        return raw.replace(/^file:\/\//, '');
      }
    }
    return '';
  }

  private bindCustomEditors(): void {
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0 || isFloatButton(e.target)) return;
      window.requestAnimationFrame(() => this.tryCustomSelection(e));
    };
    window.addEventListener('mouseup', onUp, true);
    this.toDispose.addDispose({ dispose: () => window.removeEventListener('mouseup', onUp, true) });

    this.scanIframes();
    const mo = new MutationObserver(() => this.scanIframes());
    const root = document.getElementById('workbench-editor') || document.body;
    mo.observe(root, { childList: true, subtree: true });
    this.iframeObservers.push(mo);
  }

  private scanIframes(): void {
    collectAccessibleIframes().forEach((iframe) => this.hookIframe(iframe));
  }

  private observeDoc(doc: Document): void {
    if (this.observedDocs.has(doc)) return;
    this.observedDocs.add(doc);
    const mo = new MutationObserver(() => this.scanIframes());
    try {
      mo.observe(doc.documentElement || doc, { childList: true, subtree: true });
      this.iframeObservers.push(mo);
    } catch { /* 跨域 / 无 documentElement */ }
  }

  private hookIframe(iframe: HTMLIFrameElement): void {
    if (this.iframeHooked.has(iframe)) return;
    let doc: Document | null = null;
    try { doc = iframe.contentDocument; } catch {
      this.iframeHooked.add(iframe);
      return;
    }
    if (!doc) return;
    this.iframeHooked.add(iframe);
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const pt = eventPointToTop(e);
      window.requestAnimationFrame(() => {
        if (this.editorPointerDown || this.terminalPointerDown) return;
        this.applyCustomHit(readAnyAccessibleSelection(), pt);
      });
    };
    doc.addEventListener('mouseup', onUp, true);
    this.observeDoc(doc);
    iframe.addEventListener('load', () => {
      try {
        const next = iframe.contentDocument;
        if (!next) return;
        next.addEventListener('mouseup', onUp, true);
        this.observeDoc(next);
        this.scanIframes();
      } catch { /* cross-origin */ }
    });
    this.scanIframes();
  }

  private tryCustomSelection(e: MouseEvent): void {
    if (this.editorPointerDown || this.terminalPointerDown) return;
    if (this.editorSnapshot || this.terminalSnapshot) return;
    const t = e.target;
    const root = document.getElementById('workbench-editor');
    const inWorkbench = !!(root && t instanceof Node && (root.contains(t) || t === root));
    if (!inWorkbench) return;
    this.applyCustomHit(readAnyAccessibleSelection(), eventPointToTop(e));
  }

  private applyCustomHit(hit: { text: string; x: number; y: number } | null, mouse?: { x: number; y: number }): void {
    if (!hit) {
      if (this.customSnapshot) {
        this.customSnapshot = null;
        this.customAnchor = null;
        hideAddToChatFloat();
      }
      return;
    }
    const path = this.activeEditorPath();
    this.customSnapshot = {
      kind: 'selection',
      source: 'editor',
      path: path || undefined,
      name: path ? displayNameFromPath(path) : '选区',
      text: hit.text,
    };
    const x = mouse ? mouse.x : hit.x;
    const y = mouse ? mouse.y + 10 : hit.y;
    this.customAnchor = { x, y };
    showAddToChatFloat(x, y, () => {
      if (this.customSnapshot) this.push(this.customSnapshot);
    });
  }

  private placeCustomFloat(): void {
    if (!this.customSnapshot) return;
    const pos = this.customAnchor;
    if (pos) {
      showAddToChatFloat(pos.x, pos.y, () => {
        if (this.customSnapshot) this.push(this.customSnapshot);
      });
      return;
    }
    const hit = readAnyAccessibleSelection();
    if (hit) {
      showAddToChatFloat(hit.x, hit.y, () => {
        if (this.customSnapshot) this.push(this.customSnapshot);
      });
    }
  }
}

@Injectable()
export class ContextModule extends BrowserModule {
  providers = [ContextContribution];
  contributionProvider = [CommandContribution, MenuContribution, ClientAppContribution];
}
