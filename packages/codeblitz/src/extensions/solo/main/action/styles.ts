/**
 * Action 顶栏样式 — 由 ActionBar 顶部 <style>{styles}</style> 注入
 *
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 布局: 单行横排 (模式切换 / sidebar 展开 / 项目选择), 高 60px 跟 sidebar mode-row 对齐
 *
 * sidebar 折叠态时承载 mode-row (替代 sidebar 内部的 mode-row):
 *   - app-action__mode: 切换模式按钮 (跟 sidebar mode-active 风格一致)
 *   - app-action__expand: 展开 sidebar 按钮 (panel-left 风格, 显示竖线槽位 = 已折叠)
 */
export const styles = `
.app-action {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--ai-fg);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  box-sizing: border-box;
}

/* 左右两栏: 左组 (mode/expand/pick) + 右组 (aside 开关), space-between 分两端 */
.app-action__left {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.app-action__right {
  flex: 0 0 auto;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 模式切换按钮: 跟 sidebar mode-active 同款 (高 36px)
   - 主题色实心 (--ai-accent 背景 + --ai-accent-fg 文字)
   - 内嵌反色 icon 块 */
.app-action__mode {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 10px 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ai-accent);
  color: var(--ai-accent-fg);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.10em;
  transition: opacity 0.15s ease;
}
.app-action__mode:hover { opacity: 0.85; }
.app-action__mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--ai-accent-fg);
  color: var(--ai-accent);
  border-radius: 6px;
}
.app-action__mode-label { line-height: 1; color: var(--ai-accent-fg); }

/* 展开按钮: 跟 sidebar 折叠按钮同款 (36x36 裸 icon)
   - 透明 bg, hover 浅色, 显示 panel-left 风格 (外框 + 内部竖线 = 已折叠态) */
.app-action__expand {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-action__expand:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* 项目选择按钮: 带文字的开关按钮 (📁 {项目名} ⌄ ✕)
   - 胶囊容器 (wrap) 承载浅色底 (前景色 7% 混) + hover 加深; 内部按钮/关闭 ✕ 透明融合
   - 文字 = 当前 workspace basename, 自动截断 (max-width); ✕ 仅选中项目后渲染 */
.app-action__pick-wrap {
  position: relative;
  flex: 0 0 auto;
  height: 32px;
  display: inline-flex;
  align-items: center;
  background: color-mix(in srgb, var(--ai-fg) 7%, transparent);
  border-radius: 9px;
  transition: background 0.12s;
}
.app-action__pick-wrap:hover {
  background: color-mix(in srgb, var(--ai-fg) 12%, transparent);
}
.app-action__pick {
  flex: 0 0 auto;
  /* 宽度适配内容 (不固定): 短名不撑宽, 长名到 max-width 后省略号截断 */
  max-width: 260px;
  height: 32px;
  padding: 0 8px 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--ai-fg);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.app-action__pick-label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-action__pick > svg { flex: 0 0 auto; }
/* 前置 repo 图标: 略淡, 与项目名形成 "仓库 名称" 语义 */
.app-action__pick-icon { flex: 0 0 auto; opacity: 0.72; margin-right: -1px; }
/* ✕ 关闭项目: 融合同一胶囊 (仅选中项目后渲染, 替代箭头位置) */
.app-action__pick-close {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  margin-right: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--ai-fg-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-action__pick-close:hover {
  background: color-mix(in srgb, #e5484d 20%, transparent);
  color: #e5484d;
}
/* 关闭项目确认 modal — 风格对齐 chat 历史会话列表 modal (玻璃底 + 16px 圆角 + 遮罩)
   (portal 到 body, 用通用主题 token; 不依赖 .app-action 的 --ai-*) */
.app-action__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: var(--vscode-overlay-background, rgba(0, 0, 0, 0.45));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.app-action__modal {
  width: 380px;
  max-width: 100%;
  padding: 20px 22px 16px;
  /* 近不透明玻璃 (对齐 chat 历史会话列表: 96% 底 + blur) */
  background: color-mix(in srgb, var(--editorWidget-background, #fff) 96%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  border: none;
  border-radius: 16px;
  box-shadow: 0 24px 60px color-mix(in srgb, #000 55%, transparent), 0 0 0 1px var(--panel-border, rgba(255, 255, 255, 0.08)) inset;
  color: var(--editor-foreground, #1f2328);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  font-size: 13px;
}
.app-action__modal-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.app-action__modal-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--descriptionForeground, #8f8f8f);
}
.app-action__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
.app-action__modal-btn {
  padding: 8px 18px;
  border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  background: none;
  color: var(--descriptionForeground, #8f8f8f);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-action__modal-btn:hover {
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 8%, transparent);
  color: var(--editor-foreground, #1f2328);
}
.app-action__modal-btn.is-primary {
  background: #e5484d;
  border-color: #e5484d;
  color: #fff;
  font-weight: 600;
}
.app-action__modal-btn.is-primary:hover {
  background: #d13438;
  color: #fff;
}

/* 抽屉开关按钮: 36x36 裸 icon, 跟 sideTopbar 的 .app-side-topbar__icon-btn 同款
   (透明 bg, muted fg, hover 浅色 + 加深 fg), 仅通过内部 icon 方向
   (chevron-right ↔ chevron-left) 区分 "抽屉关闭" / "抽屉打开". */
.app-action__aside {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-action__aside:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* ─────────────── sidebar 折叠态 topbar 扩展: 历史会话 modal + 新建会话 ───────────────
 * 样式命名沿用 IdeRightTopbar 的 app-ide__hist-*, 保持 IDE / SOLO 两种模式下
 * chat 历史会话视觉一致; 实际样式是另一份 (这里 CSS 也会注入, 跟 IdeRightTopbar
 * 注入的同名 class 规则一致, 单模式生效时只一份实际起作用). */

/* 历史会话 / 新建会话 icon 按钮: 28x28 (跟 IdeRightTopbar 同款) */
.app-action__chat-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--descriptionForeground, #8f8f8f);
  border-radius: 8px;
  transition: background .12s, color .12s;
}
.app-action__chat-btn:hover {
  background: color-mix(in srgb, currentColor 14%, transparent);
  color: var(--editor-foreground, var(--ai-fg));
}

/* 历史会话 modal — 自绘 createPortal (跟 IdeRightTopbar 同款, 玻璃卡/无边框/圆角 16/弹层阴影).
   命名沿用 app-ide__hist-*: SOLO 折叠态 topbar 复用 IDE 的视觉/交互. */
.app-ide__hist-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--vscode-overlay-background, rgba(0,0,0,0.45));
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.app-ide__hist-modal {
  width: 560px; max-width: 100%;
  max-height: min(calc(100vh - 72px), 600px);
  background: color-mix(in srgb, var(--editorWidget-background, #fff) 96%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  border: none;
  border-radius: 16px;
  box-shadow: 0 24px 60px color-mix(in srgb, #000 55%, transparent), 0 0 0 1px var(--panel-border, rgba(255,255,255,0.08)) inset;
  display: flex; flex-direction: column;
  overflow: hidden;
  color: var(--editor-foreground, #1f2328);
  font-size: 13px;
}
.app-ide__hist-panel { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.app-ide__hist-search {
  display: flex; align-items: center; gap: 10px;
  margin: 16px 16px 4px; padding: 9px 14px;
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 5%, var(--editorWidget-background, #fff));
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  border-radius: 10px;
  color: var(--descriptionForeground, #8f8f8f);
}
.app-ide__hist-search:focus-within {
  border-color: var(--button-background, #6366f1);
}
.app-ide__hist-search input {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  color: var(--editor-foreground, #1f2328);
  font-family: inherit; font-size: 13px;
}
.app-ide__hist-search input::placeholder { color: var(--descriptionForeground, #8f8f8f); }
.app-ide__hist-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 12px 16px; }
.app-ide__hist-group-title {
  padding: 14px 14px 8px; margin-top: 8px;
  font-size: 11.5px; font-weight: 600; color: var(--descriptionForeground, #8f8f8f);
  text-transform: uppercase; letter-spacing: 0.5px; user-select: none;
}
.app-ide__hist-item {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  transition: background .1s;
}
.app-ide__hist-item:hover { background: var(--list-hoverBackground, rgba(0,0,0,.06)); }
.app-ide__hist-item.is-active { background: var(--list-activeSelectionBackground, rgba(99,102,241,.18)); }
.app-ide__hist-item.is-highlighted { background: var(--list-hoverBackground, rgba(0,0,0,.06)); }
.app-ide__hist-name { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.app-ide__hist-time { flex: 0 0 auto; font-size: 11px; color: var(--descriptionForeground, #8f8f8f); }
.app-ide__hist-del {
  flex: 0 0 auto; width: 24px; height: 24px; visibility: hidden;
  display: inline-flex;
  align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer; border-radius: 6px;
  color: var(--descriptionForeground, #8f8f8f);
}
.app-ide__hist-item:hover .app-ide__hist-del,
.app-ide__hist-del:focus-visible { visibility: visible; }
.app-ide__hist-del:hover { color: #e5484d; background: color-mix(in srgb, #e5484d 12%, transparent); }
.app-ide__hist-empty { padding: 28px 12px; text-align: center; color: var(--descriptionForeground, #8f8f8f); }

/* 新建会话按钮: 28x28 icon 跟历史按钮同款 (跟 IdeRightTopbar 一致) */
.app-action__new {
  flex: 0 0 auto;
  width: 28px; height: 28px;
  display: inline-flex;
  align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--descriptionForeground, #8f8f8f);
  border-radius: 8px;
  transition: background .12s, color .12s;
}
.app-action__new:hover {
  /* hover 用前景色 (不用 --button-background: light 主题下 = #ffffff, icon 变白不可见; 见 pitfalls-frontend #35) */
  background: color-mix(in srgb, currentColor 14%, transparent);
  color: var(--editor-foreground, var(--ai-fg, #1f2328));
}
`;
