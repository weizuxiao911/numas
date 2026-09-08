/**
 * Chatbot 主题样式 — 由 ChatbotMain 顶部 <style>{styles}</style> 注入
 *
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 布局: 上下结构 (header 100% 宽 + container 左右内边距 ≥ 20px)
 *
 * header 在 sidebar 折叠态时承载 mode-row (替代 sidebar 内部的 mode-row):
 *   - app-chatbot__header-mode: 切换模式按钮 (跟 sidebar mode-active 风格一致)
 *   - app-chatbot__header-expand: 展开 sidebar 按钮 (panel-left 风格, 显示竖线槽位 = 已折叠)
 */
export const styles = `
.app-chatbot {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  color: var(--ai-fg);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  box-sizing: border-box;
}

/* header: 顶部栏, 100% 宽 (跟 composer 等宽, 跟左右边距无关)
   高度 = 60px: 12px top padding + 36px mode/expand 按钮 + 12px bottom padding
   跟 sidebar 展开态的 mode-row 高度 (12+36+12) 一致, 折叠态时视觉位置不变.
   后续装: 对话标题 / 模型选择 / 操作按钮 / 折叠聊天等 */
.app-chatbot__header {
  flex: 0 0 auto;
  width: 100%;
  min-height: 60px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  box-sizing: border-box;
}

/* container: 主区, 左右内边距 ≥ 20px, 上下内边距留给后续组件自行管理
   后续装: 消息流 / 输入框 / 附件 / 快捷按钮等 */
.app-chatbot__container {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
}

/* header 模式切换按钮: 跟 sidebar mode-active 同款 (高 36px)
   - 主题色实心 (--ai-accent 背景 + --ai-accent-fg 文字)
   - 内嵌反色 icon 块 */
.app-chatbot__header-mode {
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
.app-chatbot__header-mode:hover { opacity: 0.85; }
.app-chatbot__header-mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--ai-accent-fg);
  color: var(--ai-accent);
  border-radius: 6px;
}
.app-chatbot__header-mode-label { line-height: 1; color: var(--ai-accent-fg); }

/* header 展开按钮: 跟 sidebar 折叠按钮同款 (36x36 裸 icon)
   - 透明 bg, hover 浅色, 显示 panel-left 风格 (外框 + 内部竖线 = 已折叠态) */
.app-chatbot__header-expand {
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
.app-chatbot__header-expand:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* header 项目选择按钮: 带文字的开关按钮 (📁 {项目名} ⌄)
   - 透明 bg, hover 浅色; 展开态 is-open 维持 hover 态
   - 文字 = 当前 workspace basename, 自动截断 (max-width) */
.app-chatbot__header-pick {
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
.app-chatbot__header-pick:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.app-chatbot__header-pick.is-open {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.app-chatbot__header-pick-label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-chatbot__header-pick > svg { flex: 0 0 auto; }

/* header 改为相对定位容器, popover 绝对定位锚定 */
.app-chatbot__header { position: relative; }

/* ProjectPicker popover: 顶 8px 下拉 + fade in, 跟 header 顶 36px 按钮左对齐
   无 border, 仅 soft shadow + bg 区分 */
.app-project-picker {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  min-width: 360px;
  max-width: 480px;
  background: color-mix(in srgb, var(--editor-background) 92%, var(--editor-foreground) 8%);
  color: var(--ai-fg);
  border: 0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  padding: 6px;
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

.app-project-picker__section-label {
  padding: 6px 10px 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ai-fg-muted);
  text-transform: uppercase;
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
