/**
 * service/layout/layout.service.ts
 *
 * LayoutServiceImpl — DI 单例. 持有 SOLO 布局状态 (sidebar / aside),
 * 提供订阅 + 操作命令. 渲染方 (SoloLayout) 读 state 渲染; 操作方
 * (ActionBar / Sidebar) 经 executeCommand 或直接调方法.
 *
 * 状态转移规则 (与 46fa122 / 754572d 对齐):
 *   - sidebar 折叠 = collapsed boolean (折叠时不渲染, 不用 1px 占位)
 *   - 折叠时记住展开宽度, 展开恢复
 *   - aside 打开 → 自动折叠 sidebar 让出空间 (并记下展开宽度)
 *   - sidebar 展开 → 自动折叠 aside (两列互斥, 同一时间只展开一列)
 *   - 关闭 aside 不自动恢复 sidebar (用户自己 expand)
 *   - aside 打开时视口 resize → 宽度同步 60%
 */

import { Injectable, Autowired } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';

import type { ILayoutService, LayoutState, AsideView } from './layout.interface';
import { LayoutToken, LAYOUT_COMMANDS } from './layout.interface';

const MIN_SIDEBAR_W = 200;
const MAX_SIDEBAR_W = 480;
const MIN_ASIDE_W = 120;
/** aside 打开时宽度 = viewport 60% */
const ASIDE_RATIO = 0.6;
/** sidebar 默认宽度 = 固定 300px */
const SIDEBAR_DEFAULT_W = 300;

function viewportRatioWidth(ratio: number = ASIDE_RATIO): number {
  return Math.round(window.innerWidth * ratio);
}

@Injectable()
export class LayoutServiceImpl implements ILayoutService {
  private _state: LayoutState = {
    sidebar: { collapsed: false, width: SIDEBAR_DEFAULT_W },
    aside: { open: false, width: 0, view: 'view', explorerCollapsed: false },
  };
  /** 折叠时记住展开态宽度, 展开时恢复 */
  private expandedSidebarW = SIDEBAR_DEFAULT_W;
  private listeners = new Set<(s: LayoutState) => void>();

  get state(): LayoutState {
    return {
      sidebar: { ...this._state.sidebar },
      aside: { ...this._state.aside },
    };
  }

  subscribe(cb: (s: LayoutState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(): void {
    const snap = this.state;
    this.listeners.forEach((cb) => {
      try { cb(snap); } catch { /* 订阅方异常忽略 */ }
    });
  }

  // ───────────────────────── sidebar ─────────────────────────

  collapseSidebar(): void {
    const { sidebar } = this._state;
    if (!sidebar.collapsed) this.expandedSidebarW = sidebar.width;
    this._state.sidebar = { ...sidebar, collapsed: true };
    this.emit();
  }

  expandSidebar(): void {
    const next = this.expandedSidebarW;
    this._state.sidebar = { collapsed: false, width: next };
    // 展开 sidebar → 折叠 aside (互斥: 同一时间只展开一列)
    if (this._state.aside.open) this._state.aside = { ...this._state.aside, open: false };
    this.emit();
  }

  toggleSidebar(): void {
    if (this._state.sidebar.collapsed) {
      this.expandSidebar();
    } else {
      this.collapseSidebar();
    }
  }

  setSidebarWidth(n: number): void {
    const clamped = Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
    this._state.sidebar = { ...this._state.sidebar, width: clamped };
    this.emit();
  }

  // ───────────────────────── aside ─────────────────────────

  openAside(width?: number): void {
    const cur = this._state.aside;
    const nextW = Math.max(MIN_ASIDE_W, width ?? (cur.width > 0 ? cur.width : viewportRatioWidth()));
    this._state.aside = { ...cur, open: true, width: nextW };
    // 打开 aside → 自动折叠 sidebar 让出空间
    if (!this._state.sidebar.collapsed) this.collapseSidebar();
    this.emit();
  }

  closeAside(): void {
    this._state.aside = { ...this._state.aside, open: false };
    this.emit();
  }

  toggleAside(): void {
    if (this._state.aside.open) {
      this.closeAside();
    } else {
      this.openAside();
    }
  }

  setAsideWidth(n: number): void {
    const next = Math.max(MIN_ASIDE_W, Math.min(window.innerWidth - 200, n));
    this._state.aside = { ...this._state.aside, width: next };
    this.emit();
  }

  /** 切换 aside 中间区视图 (查看 | 终端 | 浏览器) */
  setAsideView(view: AsideView): void {
    if (this._state.aside.view === view) return;
    this._state.aside = { ...this._state.aside, view };
    this.emit();
  }

  /** 折叠/展开查看模式下的资源管理器 (aside 内 explorer; 折叠=隐藏, 编辑器占满) */
  toggleAsideExplorer(): void {
    this._state.aside = { ...this._state.aside, explorerCollapsed: !this._state.aside.explorerCollapsed };
    this.emit();
  }

  /** aside 打开时视口变化 → 同步 60% 宽 (resize 事件里调用) */
  syncAsideToViewport(): void {
    if (!this._state.aside.open) return;
    this._state.aside = { ...this._state.aside, width: viewportRatioWidth() };
    this.emit();
  }
}

/** 命令注册: 跨拓展 executeCommand 调布局操作 (vscode 标准) */
@Injectable()
@Domain(CommandContribution)
export class LayoutCommandContribution implements CommandContribution {
  @Autowired(LayoutToken)
  private readonly layout!: ILayoutService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(LAYOUT_COMMANDS.sidebarCollapse, { execute: () => this.layout.collapseSidebar() });
    commands.registerCommand(LAYOUT_COMMANDS.sidebarExpand, { execute: () => this.layout.expandSidebar() });
    commands.registerCommand(LAYOUT_COMMANDS.sidebarToggle, { execute: () => this.layout.toggleSidebar() });
    commands.registerCommand(LAYOUT_COMMANDS.asideOpen, { execute: () => this.layout.openAside() });
    commands.registerCommand(LAYOUT_COMMANDS.asideClose, { execute: () => this.layout.closeAside() });
    commands.registerCommand(LAYOUT_COMMANDS.asideToggle, { execute: () => this.layout.toggleAside() });
    commands.registerCommand(LAYOUT_COMMANDS.asideExplorerToggle, { execute: () => this.layout.toggleAsideExplorer() });
  }
}

@Injectable()
export class LayoutModule extends BrowserModule {
  providers = [
    { token: LayoutToken, useClass: LayoutServiceImpl },
    LayoutServiceImpl,
    LayoutCommandContribution,
  ];
  contributionProvider = [CommandContribution];
}
