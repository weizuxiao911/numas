/**
 * Sessions 样式 — 左列容器区 (新建会话 + 历史会话列表)
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 */
export const styles = `
.app-sessions {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  min-height: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  color: var(--ai-fg);
  background: transparent;
  user-select: none;
}

/* 新建会话按钮 */
.app-sessions__new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 75%;
  height: 36px;
  padding: 0 12px;
  margin: 0 auto;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  transition: background 0.12s, color 0.12s;
}
.app-sessions__new:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* 历史会话列表 */
.app-sessions__list {
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  min-height: 0;
}
.app-sessions__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  margin-bottom: 12px;
}
.app-sessions__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--ai-fg-muted);
}
.app-sessions__count {
  font-size: 10px;
  color: var(--ai-fg-muted);
  background: var(--ai-hover);
  border-radius: 8px;
  padding: 1px 6px;
}
.app-sessions__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  scrollbar-width: none;
}
.app-sessions__body::-webkit-scrollbar {
  display: none;
}
.app-sessions__empty {
  padding: 8px 4px;
  font-size: 12px;
  color: var(--ai-fg-muted);
  font-style: italic;
}
.app-sessions__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--ai-fg);
}
.app-sessions__item:hover {
  background: var(--ai-hover);
}
.app-sessions__item.is-active {
  background: var(--ai-hover);
  color: var(--ai-fg);
  box-shadow: inset 2px 0 0 var(--ai-accent);
}
.app-sessions__item-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-sessions__item-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  flex: 0 0 auto;
  max-width: 55%;
}
.app-sessions__item-time {
  flex: 0 0 auto;
  font-size: 10.5px;
  color: var(--ai-fg-muted);
  white-space: nowrap;
}
.app-sessions__item-del {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, color 0.12s;
}
.app-sessions__item:hover .app-sessions__item-del {
  opacity: 1;
}
.app-sessions__item-del:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
`;
