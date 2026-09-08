/**
 * service/layout/layout.interface.ts
 *
 * SOLO 布局契约: sidebar (左列) + drawer (右抽屉) 折叠/宽度状态.
 * 对标 VSCode 视图布局的折叠/拖宽, 但 SOLO 模式自绘三列 (不用 SplitPanel).
 *
 * 状态所有权在 service 单例 (LayoutServiceImpl), 渲染方 (SoloLayout) 与
 * 操作方 (ActionBar / Sidebar 拓展) 统一:
 *   - 读状态 / 订阅: useInjectable(LayoutToken) → subscribe / state
 *   - 操作: CommandService.executeCommand('numas.sidebar.collapse') 等
 *          (跨拓展 vscode 标准, 见 AGENTS §2.2 规则 4)
 * 命令 id 常量 (numas.sidebar.* / numas.drawer.*) 是跨拓展字符串契约,
 * 消费方不 import 本 interface 也能 executeCommand.
 */

export interface SidebarState {
  /** 当前是否折叠 (折叠 = 完全隐藏, 不渲染) */
  collapsed: boolean;
  /** 当前 sidebar 宽 (px) */
  width: number;
}

export interface DrawerState {
  /** 当前是否打开 */
  open: boolean;
  /** 当前抽屉宽 (px) */
  width: number;
}

export interface LayoutState {
  sidebar: SidebarState;
  drawer: DrawerState;
}

/** SOLO 布局命令 id (跨拓展契约, 字符串即 API) */
export const LAYOUT_COMMANDS = {
  sidebarCollapse: { id: 'numas.sidebar.collapse', label: '折叠侧栏' },
  sidebarExpand: { id: 'numas.sidebar.expand', label: '展开侧栏' },
  sidebarToggle: { id: 'numas.sidebar.toggle', label: '切换侧栏' },
  drawerOpen: { id: 'numas.drawer.open', label: '打开抽屉' },
  drawerClose: { id: 'numas.drawer.close', label: '关闭抽屉' },
  drawerToggle: { id: 'numas.drawer.toggle', label: '切换抽屉' },
} as const;

export interface ILayoutService {
  /** 当前布局状态 (实时读) */
  readonly state: LayoutState;
  /** 订阅布局状态变化 (返回 unsubscribe) */
  subscribe(cb: (s: LayoutState) => void): () => void;

  // sidebar
  collapseSidebar(): void;
  expandSidebar(): void;
  toggleSidebar(): void;
  setSidebarWidth(n: number): void;

  // drawer
  openDrawer(width?: number): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setDrawerWidth(n: number): void;
  /** drawer 打开时视口变化 → 同步 50% 宽 (resize 事件调用) */
  syncDrawerToViewport(): void;
}

export const LayoutToken: symbol = Symbol('ILayoutService');
