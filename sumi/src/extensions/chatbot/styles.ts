/**
 * Chatbot 主题样式 — 由 ChatbotMain 顶部 <style>{styles}</style> 注入
 *
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 布局: 只有对话主区 (顶栏样式已拆到 extensions/action/styles.ts)
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

/* container: 主区, 承载 ChatbotView (消息流 + 输入框)
   宽度 75% 居中: 宽屏下不让消息/输入框拉满整屏 (阅读行长过长),
   窄屏 (< 900px) 退回 100% + 20px 内边距 */
.app-chatbot__container {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 75%;
  max-width: 75%;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
}
@media (max-width: 900px) {
  .app-chatbot__container { width: 100%; max-width: 100%; padding: 0 20px; }
}

/* ChatbotView 根 (.chat) 在 container 内撑满, 背景透明跟主区一致 */
.app-chatbot__container > .chat {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  background: transparent;
}
`;
