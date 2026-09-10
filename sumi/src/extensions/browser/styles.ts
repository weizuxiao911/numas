/**
 * 内置浏览器样式 — 紧凑工具条 + iframe 区, 主题变量自适应
 */
export const styles = `
.app-browser {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--editor-background, var(--vscode-editor-background, #fff));
  overflow: hidden;
}
.app-browser__bar {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 4px;
  height: 36px; padding: 0 8px;
  border-bottom: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(0,0,0,.08)));
}
.app-browser__btn {
  width: 26px; height: 26px; flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 6px; background: none;
  color: var(--descriptionForeground, #8f8f8f);
  font-size: 14px; line-height: 1; cursor: pointer;
  transition: background .12s, color .12s;
}
.app-browser__btn:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: var(--editor-foreground, #1f2328);
}
.app-browser__btn:disabled { opacity: .35; cursor: default; }
.app-browser__addr {
  flex: 1 1 auto; min-width: 0;
  height: 26px; padding: 0 10px;
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  border-radius: 8px; outline: none;
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 4%, transparent);
  color: var(--editor-foreground, #1f2328);
  font-size: 12.5px; font-family: inherit;
}
.app-browser__addr:focus { border-color: var(--button-background, #2563eb); }
.app-browser__frame {
  flex: 1 1 auto; min-height: 0;
  width: 100%; border: none; background: #fff;
}
.app-browser__empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px; text-align: center;
  color: var(--descriptionForeground, #8f8f8f); font-size: 12.5px; line-height: 1.7;
}
`;
