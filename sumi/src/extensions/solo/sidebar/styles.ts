/**
 * Sidebar 拓展样式 — 当前仅 mode-row (模式切换 + 折叠)
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码颜色
 * 由 Sidebar.tsx 顶部 <style>{styles}</style> 注入
 */
export const styles = `
/* 三段区域 (action / container) 共享主题变量与字体; 区域 padding 由 SoloLayout 列壳提供 */
.app-sidebar-action,
.app-sidebar-container {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);
  --ai-accent-fg: var(--button-foreground);
  --ai-border: var(--panel-border, var(--editorWidget-border));

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  color: var(--ai-fg);
  background: transparent;
  user-select: none;
}
.app-sidebar-action { display: flex; flex-direction: column; }
/* container: 新建会话按钮 + 历史会话 (占满中段) */
.app-sidebar-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  min-height: 0;
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

/* ============== 主体区: 新建会话按钮 + 历史会话 ============== */
.app-sidebar__new-session {
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
.app-sidebar__new-session:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* ============== 历史会话列表 ============== */
.app-sidebar__sessions {
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  min-height: 0;
}
.app-sidebar__sessions-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  margin-bottom: 12px;
}
.app-sidebar__sessions-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--ai-fg-muted);
}
.app-sidebar__sessions-count {
  font-size: 10px;
  color: var(--ai-fg-muted);
  background: var(--ai-hover);
  border-radius: 8px;
  padding: 1px 6px;
}
.app-sidebar__sessions-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  scrollbar-width: none;
}
.app-sidebar__sessions-body::-webkit-scrollbar {
  display: none;
}
.app-sidebar__sessions-empty {
  padding: 8px 4px;
  font-size: 12px;
  color: var(--ai-fg-muted);
  font-style: italic;
}
.app-sidebar__session {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--ai-fg);
}
.app-sidebar__session:hover {
  background: var(--ai-hover);
}
.app-sidebar__session.is-active {
  background: var(--ai-hover);
  color: var(--ai-fg);
  box-shadow: inset 2px 0 0 var(--ai-accent);
}
.app-sidebar__session-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-sidebar__session-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  flex: 0 0 auto;
  max-width: 55%;
}
/* 项目分组 (会话按 directory 分组, 组标题 = 相对 workspace 路径, 根 = '.') */
.app-sidebar__group { margin-bottom: 6px; }
.app-sidebar__group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 2px;
  user-select: none;
}
.app-sidebar__group-name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ai-fg-muted);
  opacity: 0.85;
}
.app-sidebar__group-count {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--ai-fg-muted);
  opacity: 0.7;
}
.app-sidebar__session-time {
  flex: 0 0 auto;
  font-size: 10.5px;
  color: var(--ai-fg-muted);
  white-space: nowrap;
}
.app-sidebar__session-del {
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
.app-sidebar__session:hover .app-sidebar__session-del {
  opacity: 1;
}
.app-sidebar__session-del:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
`
