/**
 * Markdown 拓展 — .md 预览 (复刻 Trae/VS Code markdown 预览; 含 mermaid/代码高亮/数学)
 *
 * 入口:
 *   - explorer 右键 .md → 「打开预览」
 *   - 编辑器标题栏预览按钮 (when: resourceExtname == .md)
 *   - 命令 markdown.showPreview
 * 载体: codeblitz 编辑器组件 (虚拟 scheme numas-md-preview://<encodeURIComponent(绝对路径)>),
 *       与在树 pdf/html 同思路; 渲染见 render.ts (marked + shiki + katex + mermaid).
 */
import { Autowired, Injectable } from '@opensumi/di';
import { Domain, URI, CommandRegistry, CommandContribution } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { BrowserEditorContribution, EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser/types';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import type { IResource, ResourceService } from '@opensumi/ide-editor';
import { FileTreeModelService } from '@opensumi/ide-file-tree-next/lib/browser/services/file-tree-model.service';

import { MarkdownPreview, MD_PREVIEW_SCHEME, previewPathFromUri, previewUriFor } from './MarkdownPreview';

export const MD_PREVIEW_COMPONENT_ID = 'numas.md-preview';

export const MD_COMMANDS = {
  showPreview: { id: 'markdown.showPreview', label: '打开预览' },
} as const;

@Injectable()
@Domain(BrowserEditorContribution, CommandContribution, MenuContribution)
export class MarkdownContribution implements BrowserEditorContribution, CommandContribution, MenuContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService!: WorkbenchEditorService;

  @Autowired(FileTreeModelService)
  private readonly fileTreeModel!: FileTreeModelService;

  /** 自定义 scheme 必须先注册资源 (否则编辑器把它当外部协议去 launch) */
  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider({
      scheme: MD_PREVIEW_SCHEME,
      provideResource: (uri: URI): IResource => ({
        uri,
        name: `预览: ${previewPathFromUri(uri).split(/[\\/]/).pop() || 'Markdown'}`,
        icon: 'codicon codicon-markdown',
        supportsRevive: false,
      }),
    });
  }

  registerEditorComponent(registry: EditorComponentRegistry): void {
    registry.registerEditorComponent({
      uid: MD_PREVIEW_COMPONENT_ID,
      scheme: MD_PREVIEW_SCHEME,
      component: MarkdownPreview as any,
    });
    // 该虚拟 scheme 一律用预览组件 (对齐 pdf reader 的 resolver 模式)
    registry.registerEditorComponentResolver(
      (scheme: string) => (scheme === MD_PREVIEW_SCHEME ? 1000 : -1),
      (_resource: any, _results: any[], resolve: (r: any[]) => void) => {
        resolve([
          {
            componentId: MD_PREVIEW_COMPONENT_ID,
            type: 'component',
            title: 'Markdown 预览',
            weight: 1000,
          },
        ]);
      },
    );
    // .md 默认打开方式 = 预览 (用户拍板), 且打开方式列表保留「文本编辑器」可选:
    // 只向 results 前置预览项 (高权重 = 默认), 不 resolve() break —
    // 让 file-scheme 的 code resolver 继续跑 (对齐 open-type 的 assoc resolver 模式).
    registry.registerEditorComponentResolver(
      (scheme: string) => (scheme === 'file' ? 1000 : -1),
      (resource: any, results: any[], _resolve: (r: any[]) => void) => {
        const p = String(resource?.uri?.codeUri?.fsPath || resource?.uri?.path?.toString?.() || '').toLowerCase();
        if (!p.endsWith('.md')) return;
        results.unshift({
          componentId: MD_PREVIEW_COMPONENT_ID,
          type: 'component',
          title: 'Markdown 预览',
          weight: 1000,
        });
      },
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(MD_COMMANDS.showPreview, {
      execute: (uri?: URI) => void this.openPreview(uri),
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.ExplorerContext, {
      command: MD_COMMANDS.showPreview.id,
      group: '9_numas',
      order: 15,
      when: 'resourceExtname == .md',
    });
  }

  private async openPreview(uriArg?: URI): Promise<void> {
    const abs = this.resolveTargetPath(uriArg);
    if (!abs) return;
    await this.editorService.open(previewUriFor(abs), { preview: false } as any);
  }

  /** 目标文件绝对路径: 命令参数 → 文件树右键/选中 → 当前编辑器 */
  private resolveTargetPath(uriArg?: URI): string {
    const argPath = (uriArg as any)?.codeUri?.fsPath || (uriArg as any)?.fsPath;
    if (argPath) return String(argPath);
    const node: any = this.fileTreeModel.contextMenuFile ?? this.fileTreeModel.selectedFiles?.[0];
    const nodePath = node?.uri?.codeUri?.fsPath || node?.uri?.fsPath;
    if (nodePath) return String(nodePath);
    const current: any = this.editorService.currentResource;
    const curPath = current?.uri?.codeUri?.fsPath || current?.uri?.fsPath;
    return curPath ? String(curPath) : '';
  }
}

@Injectable()
export class MarkdownModule extends BrowserModule {
  providers = [MarkdownContribution];
  contributionProvider = [BrowserEditorContribution, CommandContribution, MenuContribution];
}
