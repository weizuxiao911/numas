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
  min-height: 60px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--ai-fg);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  box-sizing: border-box;
}

/* 模式切换按钮: 跟 sidebar mode-active 同款 (高 36px)
   - 主题色实心 (--ai-accent 背景 + --ai-accent-fg 文字)
   - 内嵌反色 icon 块 */
.app-action__mode {
  flex: 0 0 auto;
  height: 36px;
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

/* 项目选择按钮的定位容器: popover 锚在这里 (而非整条 action 栏),
   保证折叠态 (前面有 ModeSwitch + ExpandToggle) 下 popover 仍跟按钮左对齐 */
.app-action__pick-wrap {
  flex: 0 0 auto;
  position: relative;
  display: inline-flex;
}

/* ProjectPicker popover: 顶 8px 下拉 + fade in, 跟触发按钮左边缘对齐
   无 border, 仅 soft shadow + 跟 sidebar 同样的纯 editor-bg (跟主区 1 档色差) */
.app-project-picker {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  width: 260px;
  background: var(--editor-background);
  color: var(--ai-fg);
  border: 0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  padding: 10px;
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  font-size: 12px;
  box-sizing: border-box;
  animation: app-project-picker-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  transform-origin: top left;
}
@keyframes app-project-picker-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.app-project-picker__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 70vh;
  overflow-y: auto;
}

.app-project-picker__actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.app-project-picker__action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  color: var(--ai-fg);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background 0.12s;
}
.app-project-picker__action:hover { background: var(--ai-hover); }
.app-project-picker__action-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--list-hoverBackground, var(--ai-hover));
  color: var(--ai-fg);
  border-radius: 6px;
}
.app-project-picker__action-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.app-project-picker__action-label { font-weight: 600; line-height: 1.2; }
.app-project-picker__action-desc {
  font-size: 11px;
  color: var(--ai-fg-muted);
  line-height: 1.3;
}

.app-project-picker__divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--ai-border);
  opacity: 0.25;
}

.app-project-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.app-project-picker__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: transparent;
  color: var(--ai-fg);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  width: 100%;
  transition: background 0.12s;
}
.app-project-picker__item:hover { background: var(--ai-hover); }
.app-project-picker__item-icon {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ai-fg-muted);
}
.app-project-picker__item-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}
.app-project-picker__item-name {
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-project-picker__item-dir {
  font-size: 11px;
  color: var(--ai-fg-muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-project-picker__item-time {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--ai-fg-muted);
  white-space: nowrap;
}

.app-project-picker__empty {
  padding: 12px 10px;
  font-size: 11px;
  color: var(--ai-fg-muted);
  text-align: center;
  font-style: italic;
}
`;
