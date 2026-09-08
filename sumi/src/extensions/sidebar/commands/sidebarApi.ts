/**
 * Sidebar 对外 API — extensions/sidebar/commands/sidebarApi
 *
 * Sidebar 组件 (装 SOLO_SLOTS.Sidebar 槽) 激活后, 把面板自身交互能力注册到此处,
 * 供 chatbot 等其他拓展消费 (折叠状态同步 / 展开按钮调 toggle).
 *
 * 模式跟 chat/commands/chatApi.ts 完全一致: 模块级单例 + 函数引用,
 * 不挂 window 全局, 不直接 import Sidebar.tsx, 仅单向暴露 SidebarApi.
 *
 * 用法:
 *   - Sidebar 组件 mount 时 registerSidebarApi({ collapsed, setCollapsed, toggle, expand, collapse })
 *   - ChatbotMain 调 getSidebarApi() 读 collapsed + 调 toggle() / expand() / collapse()
 */

export interface SidebarApi {
  /** 当前是否折叠 (sidebar 宽度 = 1px) */
  readonly collapsed: boolean;
  /** 当前 sidebar 宽 (px) */
  readonly width: number;
  /** 折叠: width 设为 1, 持久化 collapsed=true, 保留 savedWidth 用于后续 expand */
  collapse(): void;
  /** 展开: 恢复到 savedWidth (默认 256), 持久化 collapsed=false */
  expand(): void;
  /** 切换 collapsed 态 */
  toggle(): void;
  /** 直接 set width (拖动条用) */
  setWidth(n: number): void;
  /** 订阅 collapsed 变化 (返回 unsubscribe 函数) */
  onChange(cb: (s: { collapsed: boolean; width: number }) => void): () => void;
}

let registered: SidebarApi | null = null;

export function registerSidebarApi(api: SidebarApi | null): void {
  registered = api;
}

export function getSidebarApi(): SidebarApi | null {
  return registered;
}
