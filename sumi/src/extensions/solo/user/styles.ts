/**
 * UserBar 样式 — extensions/solo/user/styles.ts
 * 主题色走 codeblitz/opensumi token, 不硬编码; 无 border.
 */
export const styles = `
.app-user {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);

  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  padding: 4px 6px;
  background: transparent;
  color: var(--ai-fg);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  box-sizing: border-box;
  user-select: none;
  transition: background 0.12s;
}
.app-user:hover { background: var(--ai-hover); }
.app-user__avatar {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ai-hover);
  font-size: 15px;
  line-height: 1;
}
.app-user__name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 500;
}
`;
