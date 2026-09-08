/**
 * Sidebar 拓展样式 — 当前仅 mode-row (模式切换 + 折叠)
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 由 Sidebar.tsx 顶部 <style>{styles}</style> 注入
 */
export const styles = `
.app-sidebar {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  display: flex; flex-direction: column;
  height: 100%;
  padding: 12px 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  color: var(--ai-fg);
  background: transparent;
  user-select: none;
}
/* 拖动条 (SplitPanel 渲染) — 加宽 + 主题色, hover 突出 */
.app-sidebar + .resize-handle-horizontal,
.app-sidebar ~ .resize-handle-horizontal {
  width: 6px !important;
  background: transparent !important;
  cursor: col-resize;
  position: relative;
  z-index: 10;
}
.app-sidebar + .resize-handle-horizontal::before,
.app-sidebar ~ .resize-handle-horizontal::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  left: 2px; width: 2px;
  background: var(--ai-border);
  transition: background 0.15s ease;
}
.app-sidebar + .resize-handle-horizontal:hover::before,
.app-sidebar ~ .resize-handle-horizontal:hover::before {
  background: var(--ai-accent);
}

/* ============== 顶部模式行: 当前模式大按钮 + 折叠 (裸 icon) ============== */
.app-sidebar__mode-row {
  display: flex; align-items: center; justify-content: space-between;
}
.app-sidebar__mode-active {
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
.app-sidebar__mode-active:hover { opacity: 0.85; }
.app-sidebar__mode-active-label {
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.10em;
  color: var(--ai-accent-fg);
}
.app-sidebar__mode-active-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  background: var(--ai-accent-fg);
  color: var(--ai-accent);
  border-radius: 6px;
}
.app-sidebar__icon-btn--bare {
  height: 36px; width: 36px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-sidebar__icon-btn--bare:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
`
