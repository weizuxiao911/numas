/**
 * Drawer API — commands/drawer.ts
 *
 * 跨拓展共享的抽屉状态契约 (位于 commands 契约层, 见 docs/AI 工作台总体设计.md §3.1):
 *   extensions → commands → service → codeblitz/opencode
 *
 * SoloLayout (layout 层, 不在分层铁律硬约束内) 持有 drawer 开关 + 宽度 state,
 * mount 时通过 registerDrawerApi 暴露给 commands/drawer (api owner),
 * 卸载时清空. 消费方 (ActionBar 等) 调 getDrawerApi() 拿快照 + 调方法.
 *
 * 不挂 window, 用模块级单例 register/get.
 * 历史曾短暂在 extensions/drawer/commands/drawerApi 存在 (不是真拓展, 是 API 目录).
 * sidebar/commands/sidebarApi 同步迁到 commands/sidebar.ts, 保持统一.
 */
export interface DrawerState {
  open: boolean;
  /** 当前宽度 (px) */
  width: number;
}

export interface DrawerApi {
  readonly open: boolean;
  readonly width: number;
  open: (width?: number) => void;
  close: () => void;
  toggle: () => void;
  setWidth: (n: number) => void;
  /** 订阅 open/width 变化, 返回 unsubscribe */
  onChange: (cb: (s: DrawerState) => void) => () => void;
}

let _api: DrawerApi | null = null;

export function registerDrawerApi(api: DrawerApi | null): void {
  _api = api;
}

export function getDrawerApi(): DrawerApi | null {
  return _api;
}
