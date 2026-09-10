/**
 * Browser 拓展 — 内置浏览器 (独立拓展, 全新实现)
 *
 * 入口:
 *   - SOLO aside 胶囊「浏览器」→ aside.browser 视图 (solo.aside.browser)
 *   - 编辑器 tab: numas-browser://<窗口 id> (多窗口, 每窗口独立 URL)
 *   - 全局命令 browser.* (open/navigate/reload/openExternal/activeUrl) 供其它拓展/vsix 调用
 * 直连目标地址, 不做反向代理.
 */
import { Autowired, Injectable } from '@opensumi/di';
import { Domain, URI, CommandRegistry, CommandContribution } from '@opensumi/ide-core-common';
import { BrowserModule as OpenSumiBrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import type { IResource, ResourceService } from '@opensumi/ide-editor';
import { BrowserEditorContribution, EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser/types';

import { BrowserServiceImpl } from './browser.service';
import { BrowserView } from './BrowserView';

export const ASIDE_BROWSER_PANEL_ID = 'aside-browser';
export const BROWSER_SCHEME = 'numas-browser';
const BROWSER_COMPONENT_ID = 'numas.browser-view';
const ASIDE_BROWSER_SLOT = 'solo.aside.browser';

export const BROWSER_COMMANDS = {
  open: { id: 'browser.open', label: '打开内置浏览器' },
  navigate: { id: 'browser.navigate', label: '浏览器导航' },
  reload: { id: 'browser.reload', label: '浏览器刷新' },
  openExternal: { id: 'browser.openExternal', label: '用系统浏览器打开' },
  activeUrl: { id: 'browser.activeUrl', label: '浏览器当前地址' },
} as const;

@Injectable()
@Domain(ComponentContribution, BrowserEditorContribution, CommandContribution)
export class BrowserContribution implements ComponentContribution, BrowserEditorContribution, CommandContribution {
  @Autowired(BrowserServiceImpl)
  private readonly service!: BrowserServiceImpl;

  @Autowired(WorkbenchEditorService)
  private readonly editorService!: WorkbenchEditorService;

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      ASIDE_BROWSER_PANEL_ID,
      { id: ASIDE_BROWSER_PANEL_ID, component: BrowserView as any },
      { containerId: ASIDE_BROWSER_PANEL_ID, iconClass: 'codicon codicon-globe', title: '浏览器' },
      ASIDE_BROWSER_SLOT,
    );
  }

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider({
      scheme: BROWSER_SCHEME,
      provideResource: (uri: URI): IResource => {
        const url = this.service.recall(uri.authority);
        let name = '浏览器';
        try {
          if (url) name = new URL(url).host || name;
        } catch { /* 非法 URL, 用默认名 */ }
        return { uri, name, icon: 'codicon codicon-globe', supportsRevive: false };
      },
    });
  }

  registerEditorComponent(registry: EditorComponentRegistry): void {
    registry.registerEditorComponent({
      uid: BROWSER_COMPONENT_ID,
      scheme: BROWSER_SCHEME,
      component: BrowserView as any,
    });
    registry.registerEditorComponentResolver(
      (scheme: string) => (scheme === BROWSER_SCHEME ? 1000 : -1),
      (_resource: any, _results: any[], resolve: (r: any[]) => void) => {
        resolve([{ componentId: BROWSER_COMPONENT_ID, type: 'component', title: '浏览器', weight: 1000 }]);
      },
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(BROWSER_COMMANDS.open, { execute: (url?: string) => void this.open(url) });
    commands.registerCommand(BROWSER_COMMANDS.navigate, { execute: (url: string) => this.service.active()?.navigate(url) });
    commands.registerCommand(BROWSER_COMMANDS.reload, { execute: () => this.service.active()?.reload() });
    commands.registerCommand(BROWSER_COMMANDS.openExternal, { execute: (url?: string) => this.service.active()?.openExternal(url) });
    commands.registerCommand(BROWSER_COMMANDS.activeUrl, { execute: () => this.service.active()?.activeUrl() ?? '' });
  }

  /** 新编辑器 tab 打开 (同 URL 复用同一 tab; 空 URL = 空白窗口) */
  private async open(url?: string): Promise<void> {
    const target = (url || '').trim();
    const id = target ? this.service.hashFor(target) : 'blank';
    if (target) this.service.remember(id, target);
    await this.editorService.open(URI.from({ scheme: BROWSER_SCHEME, authority: id, path: '/' }), {
      preview: false,
    } as any);
  }
}

@Injectable()
export class BrowserModule extends OpenSumiBrowserModule {
  providers = [BrowserContribution, BrowserServiceImpl];
  contributionProvider = [ComponentContribution, BrowserEditorContribution, CommandContribution];
}
