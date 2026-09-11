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
 *   - aside 打开时视口 resize → 未手动拖过宽度才同步 60%; 手动拖过则保留 (只做上限收敛)
 *   - 全量状态持久化到 localStorage (刷新恢复上次布局; 手动宽度标记一并持久化)
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

/** 布局状态持久化 key (全量: sidebar 折叠/宽 + aside 开合/宽/视图/explorer 折叠 + 手动宽度标记) */
const STORAGE_KEY = 'NUMAS_SOLO_LAYOUT_V1';
const VALID_VIEWS: AsideView[] = ['view', 'terminal', 'browser'];

function viewportRatioWidth(ratio: number = ASIDE_RATIO): number {
  return Math.round(window.innerWidth * ratio);
}

function clampSidebarW(n: number): number {
  return Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
}

function clampAsideW(n: number): number {
  return Math.max(MIN_ASIDE_W, Math.min(window.innerWidth - 200, n));
}

function loadPersisted(): any {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

@Injectable()
export class LayoutServiceImpl implements ILayoutService {
  private _state: LayoutState = {
    sidebar: { collapsed: false, width: SIDEBAR_DEFAULT_W },
    aside: { open: false, width: 0, view: 'view', explorerCollapsed: false },
  };
  /** 折叠时记住展开态宽度, 展开时恢复 */
  private expandedSidebarW = SIDEBAR_DEFAULT_W;
  /** aside 宽度是否被手动拖过 (拖过则 resize 不再按 60% 重置) */
  private asideWidthManual = false;
  private listeners = new Set<(s: LayoutState) => void>();

  constructor() {
    this.restore();
  }

  /** 从 localStorage 恢复状态 (字段校验 + 范围收敛; 损坏数据静默回默认) */
  private restore(): void {
    const p = loadPersisted();
    const sb = p.sidebar || {};
    const as = p.aside || {};
    const sbW = Number.isFinite(sb.width) ? clampSidebarW(sb.width) : SIDEBAR_DEFAULT_W;
    this.expandedSidebarW = Number.isFinite(p.expandedSidebarW) ? clampSidebarW(p.expandedSidebarW) : sbW;
    this._state.sidebar = { collapsed: !!sb.collapsed, width: sbW };
    const asW = Number.isFinite(as.width) && as.width > 0 ? clampAsideW(as.width) : 0;
    this._state.aside = {
      open: !!as.open,
      width: asW,
      view: VALID_VIEWS.includes(as.view) ? as.view : 'view',
      explorerCollapsed: !!as.explorerCollapsed,
    };
    this.asideWidthManual = !!as.widthManual;
    // 互斥不变量: aside 打开时 sidebar 必须折叠 (与 openAside 行为一致)
    if (this._state.aside.open && !this._state.sidebar.collapsed) {
      this._state.sidebar = { ...this._state.sidebar, collapsed: true };
    }
  }

  /** 写回 localStorage (每次状态变更时同步写, payload 很小) */
  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sidebar: this._state.sidebar,
        aside: { ...this._state.aside, widthManual: this.asideWidthManual },
        expandedSidebarW: this.expandedSidebarW,
      }));
    } catch { /* 存储不可用忽略 */ }
  }

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
    this.persist();
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
    const next = clampAsideW(n);
    this.asideWidthManual = true;
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

  /** aside 打开时视口变化 → 未手动拖过宽度才同步 60%; 手动宽度只做上限收敛 (不重置) */
  syncAsideToViewport(): void {
    if (!this._state.aside.open) return;
    const next = this.asideWidthManual ? clampAsideW(this._state.aside.width) : viewportRatioWidth();
    if (next === this._state.aside.width) return;
    this._state.aside = { ...this._state.aside, width: next };
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
