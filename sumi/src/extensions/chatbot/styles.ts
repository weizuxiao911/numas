/**
 * Chatbot 主题样式 — 由 ChatbotMain 顶部 <style>{styles}</style> 注入
 *
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 排版: flex column, 居中布局, 跟 sidebar 风格一致
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
  width: 100%;
  height: 100%;
  padding: 24px 32px;
  background: transparent;
  color: var(--ai-fg);
  box-sizing: border-box;
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
}
`;
