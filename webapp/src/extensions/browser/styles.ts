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
  /* 不用边框: 工具条用浅灰底与下方内容区形成色差 */
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 4%, var(--editor-background, #ffffff));
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
  border: none; border-radius: 8px; outline: none;
  /* 白底输入框 (在浅灰工具条上以色差凸显); focus 用淡 accent 底代替边框 */
  background: var(--editor-background, #ffffff);
  color: var(--editor-foreground, #1f2328);
  font-size: 12.5px; font-family: inherit;
}
.app-browser__addr:focus {
  background: color-mix(in srgb, var(--focusBorder, #2563eb) 8%, var(--editor-background, #ffffff));
}
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
