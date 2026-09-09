/**
 * SettingsBar 样式 — extensions/settings/styles.ts
 * 主题色走 codeblitz/opensumi token, 不硬编码.
 */
export const styles = `
.app-settings {
  --ai-fg: var(--editor-foreground);
  --ai-fg-muted: var(--descriptionForeground);
  --ai-hover: var(--list-hoverBackground);
  --ai-accent: var(--button-background);

  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 6px;
  border-radius: 8px;
  background: transparent;
  box-sizing: border-box;
  user-select: none;
}

/* 单行: 用户信息 + 设置按钮 */
.app-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.app-settings__user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.app-settings__avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ai-accent) 18%, transparent);
  color: var(--ai-accent);
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}
.app-settings__name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ai-fg);
}
.app-settings__btn {
  flex: 0 0 auto;
  height: 26px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  transition: background 0.12s, color 0.12s;
}
.app-settings__btn:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}

/* ============== 全局 modal (设置面板占位) ============== */
.app-settings__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  animation: app-settings-modal-fade 150ms ease both;
}
.app-settings__modal {
  width: min(45vw, 580px);
  aspect-ratio: 3 / 4;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--editor-background);
  color: var(--ai-fg);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
  animation: app-settings-modal-pop 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.app-settings__modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}
.app-settings__modal-title {
  font-size: 14px;
  font-weight: 700;
}
.app-settings__modal-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ai-fg-muted);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.app-settings__modal-close:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.app-settings__modal-body {
  flex: 1 1 auto;
  min-height: 160px;
  padding: 16px;
  overflow-y: auto;
}
.app-settings__modal-empty {
  font-size: 12.5px;
  color: var(--ai-fg-muted);
  text-align: center;
  padding: 40px 0;
  font-style: italic;
}
@keyframes app-settings-modal-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes app-settings-modal-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

