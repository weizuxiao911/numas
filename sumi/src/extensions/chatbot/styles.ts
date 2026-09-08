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
`;
