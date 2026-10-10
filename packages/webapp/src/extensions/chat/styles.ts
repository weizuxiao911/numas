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
   默认宽度 90% 居中, 最大 728px 封顶 (宽屏下不超过 728,
   窄屏 / 窗口很小时仍能利用全宽的 90%) */
.app-chatbot__container {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 90%;
  max-width: 728px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
  /* 基础字号 14px (原继承 16px): 正文/非标题统一 14px, 标题/logo 各自覆写 */
  font-size: 14px;
}

/* ChatbotView 根 (.chat) 在 container 内撑满, 背景透明跟主区一致 */
.app-chatbot__container > .chat {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  background: transparent;
}
`;
