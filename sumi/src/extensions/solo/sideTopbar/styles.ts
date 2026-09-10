/**
 * SideTopbar 样式 — 左列顶部活动栏 (模式切换 + 折叠)
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 */
export const styles = `
.app-side-topbar {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  color: var(--ai-fg);
  background: transparent;
  user-select: none;
}

/* 顶部模式行: 当前模式大按钮 + 折叠 (裸 icon) */
.app-side-topbar__mode-row {
  display: flex; align-items: center; justify-content: space-between;
}
.app-side-topbar__mode {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px;
  padding: 0 10px 0 14px;
  background: var(--ai-accent);
  color: var(--ai-accent-fg);
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: opacity 0.12s ease;
}
.app-side-topbar__mode:hover { opacity: 0.85; }
.app-side-topbar__mode-label {
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.10em;
  color: var(--ai-accent-fg);
}
.app-side-topbar__mode-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  background: var(--ai-accent-fg);
  color: var(--ai-accent);
  border-radius: 6px;
}
.app-side-topbar__icon-btn {
  height: 36px; width: 36px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-side-topbar__icon-btn:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
`;
