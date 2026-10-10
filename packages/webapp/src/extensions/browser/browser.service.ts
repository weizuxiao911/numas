/**
 * BrowserService — 内置浏览器视图注册表 (独立拓展内部契约)
 *
 * 每个 BrowserView 实例 (aside 视图 / numas-browser:// 编辑器 tab) 挂载时注册、卸载时注销;
 * browser.* 全局命令作用于 active (最近聚焦) 视图.
 * pending: 编辑器 tab 的 URI 只带窗口 id (authority 会被小写化), URL 本体存这里按 id 查.
 */
import { Injectable } from '@opensumi/di';

export interface BrowserViewApi {
  navigate(url: string): void;
  reload(): void;
  openExternal(url?: string): void;
  activeUrl(): string;
}

@Injectable()
export class BrowserServiceImpl {
  private readonly views = new Map<string, BrowserViewApi>();
  private readonly urls = new Map<string, string>();
  private activeId = '';

  /** 稳定窗口 id (URL → base36 hash; URI authority 只能小写安全字符) */
  hashFor(url: string): string {
    let h = 5381;
    for (let i = 0; i < url.length; i += 1) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
    return `w${(h >>> 0).toString(36)}`;
  }

  /** 记住窗口当前 URL (编辑器 tab 重挂载/切回时恢复) */
  remember(id: string, url: string): void {
    this.urls.set(id, url);
  }

  recall(id: string): string {
    return this.urls.get(id) || '';
  }

  register(id: string, api: BrowserViewApi): void {
    this.views.set(id, api);
    this.activeId = id;
  }

  unregister(id: string): void {
    this.views.delete(id);
    if (this.activeId === id) this.activeId = this.views.keys().next().value || '';
  }

  activate(id: string): void {
    if (this.views.has(id)) this.activeId = id;
  }

  active(): BrowserViewApi | undefined {
    return this.views.get(this.activeId) || this.views.values().next().value;
  }
}
