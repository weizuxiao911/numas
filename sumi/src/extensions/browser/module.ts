/**
 * extensions/browser/module.ts — 内置浏览器拓展入口
 *
 * - 自定义 scheme numas-browser:// (仿 welcome): registerResource + registerEditorComponent,
 *   BrowserView 作为主编辑区(main slot)编辑器标签打开, 内部 <iframe> 渲染网页.
 * - 多开: 每窗口 = 一个编辑器 tab, URI 唯一标识 = 首次打开 URL 的 hash
 *   (`numas-browser://<urlHash>`; 无 URL 空窗口 = numas-browser://browser).
 *   同 URL 再 open → 聚焦已有 tab (编辑器按 URI 去重); 不同 URL → 独立 tab 各自 iframe.
 * - DI: BrowserToken → BrowserServiceImpl (内置拓展 useInjectable 调).
 * - 全局命令 browser.* (CommandContribution): vsix / 其他拓展用 vscode 标准
 *   executeCommand 调用 (open/navigate/reload/openExternal/executeJs/queryDom/activeUrl).
 */

import { Injectable, Autowired } from '@opensumi/di';
import { Domain, URI, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import {
  BrowserModule as OpenSumiBrowserModule,
  ClientAppContribution,
} from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import type { IResource, ResourceService } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
} from '@opensumi/ide-editor/lib/browser/types';

import { BrowserView } from './BrowserView';
import { BrowserServiceImpl, browserUriFor, viewIdFromUri, windowTitleFor } from './browser.service';
import {
  BrowserToken,
  BROWSER_SCHEME,
  BROWSER_VIEW_ID,
  type IBrowserService,
} from './browser.interface';

const BROWSER_URI = browserUriFor();

/** 全局命令 id (vscode/codeblitz 标准, 供 executeCommand 调用) */
export const BROWSER_COMMANDS = {
  open: { id: 'browser.open', label: '内置浏览器: 打开' },
  navigate: { id: 'browser.navigate', label: '内置浏览器: 导航' },
  reload: { id: 'browser.reload', label: '内置浏览器: 刷新' },
  openExternal: { id: 'browser.openExternal', label: '内置浏览器: 在真实浏览器打开' },
  executeJs: { id: 'browser.executeJs', label: '内置浏览器: 执行 JS' },
  queryDom: { id: 'browser.queryDom', label: '内置浏览器: 查询 DOM' },
  activeUrl: { id: 'browser.activeUrl', label: '内置浏览器: 当前地址' },
} as const;

@Injectable()
@Domain(BrowserEditorContribution, CommandContribution, ClientAppContribution)
export class BrowserContribution
  implements BrowserEditorContribution, CommandContribution, ClientAppContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(BrowserToken)
  private readonly browser: IBrowserService;

  // ----- 打开标签的 opener / fileOpener 注入给 service (service 不直接依赖 editor, 解耦) -----
  onDidStart(): void {
    (this.browser as BrowserServiceImpl).opener = async (uri: URI) => {
      // 同 URI (同 url hash) → 编辑器聚焦已有 tab, 不重复开; 不同 URI → 多开
      await this.editorService.open(uri, { preview: false, focus: true });
    };
    (this.browser as BrowserServiceImpl).fileOpener = async (absPath: string) => {
      // 推断 file:// URI; normSep 处理跨平台; PdfReaderView (file scheme, .pdf 后缀) 自动接管
      const normalized = absPath.replace(/\\/g, '/');
      const uri = URI.file(normalized);
      await this.editorService.open(uri, { preview: false, focus: true });
    };
  }

  // ----- Resource Provider (numas-browser://) -----
  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider({
      scheme: BROWSER_SCHEME,
      provideResource: (uri: URI): IResource => {
        // 多开标签名: 窗口 url (knownUrls) 的域名; 无 → 默认名. 每窗口独立 tab.
        const host = viewIdFromUri(uri);
        const known = (this.browser as BrowserServiceImpl).knownUrlFor(host);
        return {
          uri,
          name: windowTitleFor(known),
          icon: 'codicon codicon-globe',
          supportsRevive: false,
        };
      },
      shouldCloseResourceWithoutConfirm: () => true,
    });
  }

  // ----- Editor Component -----
  registerEditorComponent(registry: EditorComponentRegistry): void {
    registry.registerEditorComponent({
      uid: BROWSER_VIEW_ID,
      scheme: BROWSER_SCHEME,
      component: BrowserView as any,
    });
    registry.registerEditorComponentResolver(BROWSER_SCHEME, (_resource, _results, resolve) => {
      resolve([{ componentId: BROWSER_VIEW_ID, type: 'component', title: '内置浏览器' }]);
    });
  }

  // ----- 全局命令 (vsix / 其他拓展 executeCommand 调) -----
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(BROWSER_COMMANDS.open, {
      execute: (url?: string) => this.browser.open(url),
    });
    commands.registerCommand(BROWSER_COMMANDS.navigate, {
      execute: (url: string) => this.browser.navigate(url),
    });
    commands.registerCommand(BROWSER_COMMANDS.reload, {
      execute: () => this.browser.reload(),
    });
    commands.registerCommand(BROWSER_COMMANDS.openExternal, {
      execute: (url?: string) => this.browser.openExternal(url),
    });
    commands.registerCommand(BROWSER_COMMANDS.executeJs, {
      execute: (code: string) => this.browser.executeJs(code),
    });
    commands.registerCommand(BROWSER_COMMANDS.queryDom, {
      execute: (selector?: string) => this.browser.queryDom(selector),
    });
    commands.registerCommand(BROWSER_COMMANDS.activeUrl, {
      execute: () => this.browser.activeUrl(),
    });
  }
}

@Injectable()
@Domain(ComponentContribution)
export class BrowserSlotContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    // aside 浏览器视图 (solo.aside.browser): asidetopbar 激活浏览器时中间段加载此 slot.
    // 独立组件形态 (非编辑器 tab), 与「查看」模式的编辑区互斥、互不污染.
    registry.register(
      ASIDE_BROWSER_PANEL_ID,
      { id: ASIDE_BROWSER_PANEL_ID, component: BrowserView as any },
      { containerId: ASIDE_BROWSER_PANEL_ID, iconClass: 'codicon codicon-globe', title: '浏览器' },
      ASIDE_BROWSER_SLOT,
    );
  }
}

/** aside 浏览器视图 panel id / slot (跟 config/slots.ts SOLO_SLOTS.AsideBrowser 同值) */
export const ASIDE_BROWSER_PANEL_ID = 'aside-browser';
const ASIDE_BROWSER_SLOT = 'solo.aside.browser';

@Injectable()
export class BuiltinBrowserModule extends OpenSumiBrowserModule {
  providers = [
    BrowserContribution,
    BrowserSlotContribution,
    { token: BrowserToken, useClass: BrowserServiceImpl },
    BrowserServiceImpl,
  ];
  contributionProvider = [BrowserEditorContribution, ComponentContribution, CommandContribution, ClientAppContribution];
}

