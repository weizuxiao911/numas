/**
 * service/layout/layout.interface.ts
 *
 * SOLO 布局契约: sidebar (左列) + aside (右列) 折叠/宽度状态.
 * 对标 VSCode 视图布局的折叠/拖宽, 但 SOLO 模式自绘三列 (不用 SplitPanel).
 *
 * 状态所有权在 service 单例 (LayoutServiceImpl), 渲染方 (SoloLayout) 与
 * 操作方 (ActionBar / Sidebar 拓展) 统一:
 *   - 读状态 / 订阅: useInjectable(LayoutToken) → subscribe / state
 *   - 操作: CommandService.executeCommand('sidebar.collapse') 等
 *          (跨拓展 vscode 标准, 见 AGENTS §2.2 规则 4)
 * 命令 id 常量 (sidebar.* / aside.*) 是跨拓展字符串契约,
 * 消费方不 import 本 interface 也能 executeCommand.
 */

export interface SidebarState {
  /** 当前是否折叠 (折叠 = 完全隐藏, 不渲染) */
  collapsed: boolean;
  /** 当前 sidebar 宽 (px) */
  width: number;
}

/** aside 中间区视图 (asidetopbar 胶囊切换): 查看 | 终端 | 浏览器 */
export type AsideView = 'view' | 'terminal' | 'browser';

export interface AsideState {
  /** 当前是否打开 */
  open: boolean;
  /** 当前 aside 宽 (px) */
  width: number;
  /** 当前激活视图 (默认 view = explorer + editor 左右布局) */
  view: AsideView;
}

export interface LayoutState {
  sidebar: SidebarState;
  aside: AsideState;
}

/** SOLO 布局命令 id (跨拓展契约, 字符串即 API) */
export const LAYOUT_COMMANDS = {
  sidebarCollapse: { id: 'sidebar.collapse', label: '折叠侧栏' },
  sidebarExpand: { id: 'sidebar.expand', label: '展开侧栏' },
  sidebarToggle: { id: 'sidebar.toggle', label: '切换侧栏' },
  asideOpen: { id: 'aside.open', label: '打开右列' },
  asideClose: { id: 'aside.close', label: '关闭右列' },
  asideToggle: { id: 'aside.toggle', label: '切换右列' },
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

  // aside
  openAside(width?: number): void;
  closeAside(): void;
  toggleAside(): void;
  setAsideWidth(n: number): void;
  /** 切换 aside 中间区视图 (查看 | 终端 | 浏览器) */
  setAsideView(view: AsideView): void;
  /** aside 打开时视口变化 → 同步 60% 宽 (resize 事件调用) */
  syncAsideToViewport(): void;
}

export const LayoutToken: symbol = Symbol('ILayoutService');
