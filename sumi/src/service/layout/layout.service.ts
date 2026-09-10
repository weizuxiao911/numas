/**
 * service/layout/layout.service.ts
 *
 * LayoutServiceImpl — DI 单例. 持有 SOLO 布局状态 (sidebar / drawer),
 * 提供订阅 + 操作命令. 渲染方 (SoloLayout) 读 state 渲染; 操作方
 * (ActionBar / Sidebar) 经 executeCommand 或直接调方法.
 *
 * 状态转移规则 (与 46fa122 / 754572d 对齐):
 *   - sidebar 折叠 = collapsed boolean (折叠时不渲染, 不用 1px 占位)
 *   - 折叠时记住展开宽度, 展开恢复
 *   - drawer 打开 → 自动折叠 sidebar 让出空间 (并记下展开宽度)
 *   - 关闭 drawer 不自动恢复 sidebar (用户自己 expand)
 *   - drawer 打开时视口 resize → 宽度同步 50%
 */

import { Injectable, Autowired } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';

import type { ILayoutService, LayoutState, SidebarState, DrawerState } from './layout.interface';
import { LayoutToken, LAYOUT_COMMANDS } from './layout.interface';

const DEFAULT_SIDEBAR_W = 320;
const MIN_SIDEBAR_W = 200;
const MAX_SIDEBAR_W = 480;
const MIN_DRAWER_W = 120;
/** drawer 打开时宽度 = viewport 65% */
const DRAWER_RATIO = 0.65;

function viewportRatioWidth(): number {
  return Math.round(window.innerWidth * DRAWER_RATIO);
}

@Injectable()
export class LayoutServiceImpl implements ILayoutService {
  private _state: LayoutState = {
    sidebar: { collapsed: false, width: DEFAULT_SIDEBAR_W },
    drawer: { open: false, width: 0 },
  };
  /** 折叠时记住展开态宽度, 展开时恢复 */
  private expandedSidebarW = DEFAULT_SIDEBAR_W;
  private listeners = new Set<(s: LayoutState) => void>();

  get state(): LayoutState {
    return {
      sidebar: { ...this._state.sidebar },
      drawer: { ...this._state.drawer },
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

  // ───────────────────────── drawer ─────────────────────────

  openDrawer(width?: number): void {
    const cur = this._state.drawer;
    const nextW = Math.max(MIN_DRAWER_W, width ?? (cur.width > 0 ? cur.width : viewportRatioWidth()));
    this._state.drawer = { open: true, width: nextW };
    // 打开 drawer → 自动折叠 sidebar 让出空间
    if (!this._state.sidebar.collapsed) this.collapseSidebar();
    this.emit();
  }

  closeDrawer(): void {
    this._state.drawer = { ...this._state.drawer, open: false };
    this.emit();
  }

  toggleDrawer(): void {
    if (this._state.drawer.open) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  setDrawerWidth(n: number): void {
    const next = Math.max(MIN_DRAWER_W, Math.min(window.innerWidth - 200, n));
    this._state.drawer = { ...this._state.drawer, width: next };
    this.emit();
  }

  /** drawer 打开时视口变化 → 同步 50% 宽 (resize 事件里调用) */
  syncDrawerToViewport(): void {
    if (!this._state.drawer.open) return;
    this._state.drawer = { ...this._state.drawer, width: viewportRatioWidth() };
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
    commands.registerCommand(LAYOUT_COMMANDS.drawerOpen, { execute: () => this.layout.openDrawer() });
    commands.registerCommand(LAYOUT_COMMANDS.drawerClose, { execute: () => this.layout.closeDrawer() });
    commands.registerCommand(LAYOUT_COMMANDS.drawerToggle, { execute: () => this.layout.toggleDrawer() });
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
