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

/* 项目选择按钮: 带文字的开关按钮 (📁 {项目名} ⌄)
   - 透明 bg, hover 浅色; 展开态 is-open 维持 hover 态
   - 文字 = 当前 workspace basename, 自动截断 (max-width) */
.app-action__pick {
  flex: 0 0 auto;
  max-width: 280px;
  height: 36px;
  padding: 0 10px 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: background 0.12s, color 0.12s;
}
.app-action__pick:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.app-action__pick.is-open {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.app-action__pick-label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-action__pick > svg { flex: 0 0 auto; }

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
`;
