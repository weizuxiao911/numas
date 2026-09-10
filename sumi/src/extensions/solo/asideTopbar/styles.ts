/**
 * AsideTopbar 样式 — 胶囊分段控件 (查看 | 终端 | 浏览器)
 * 主题色: 全部走 codeblitz/opensumi token, 不硬编码
 */
export const styles = `
.app-aside-topbar {
  --ai-fg: var(--editor-foreground, #333);
  --ai-fg-muted: var(--descriptionForeground, #8f8f8f);
  --ai-bg-elev: var(--editorWidget-background, var(--sideBar-background, #fff));
  --ai-hairline: var(--panel-border, var(--editorWidget-border, rgba(0,0,0,.1)));

  display: flex; align-items: center; justify-content: center;
  min-height: 60px; padding: 12px;
  box-sizing: border-box;
  user-select: none;
  background: var(--editor-background);
}
/* 胶囊: 3 等分, 底部滑块 (pill) 用 transform 过渡 */
.app-aside-topbar__capsule {
  position: relative;
  display: grid; grid-template-columns: repeat(3, 1fr);
  width: 100%; max-width: 260px;
  padding: 3px;
  background: color-mix(in srgb, var(--ai-fg) 7%, transparent);
  border-radius: 999px;
}
.app-aside-topbar__pill {
  position: absolute; top: 3px; bottom: 3px; left: 3px;
  width: calc((100% - 6px) / 3);
  background: var(--ai-bg-elev);
  border-radius: 999px;
  box-shadow:
    0 1px 2px color-mix(in srgb, #000 14%, transparent),
    0 0 0 .5px color-mix(in srgb, var(--ai-fg) 10%, transparent);
  transition: transform .28s cubic-bezier(.4, 0, .2, 1);
  transform: translateX(0);
  pointer-events: none;
}
.app-aside-topbar__capsule[data-index="1"] .app-aside-topbar__pill { transform: translateX(100%); }
.app-aside-topbar__capsule[data-index="2"] .app-aside-topbar__pill { transform: translateX(200%); }
.app-aside-topbar__btn {
  position: relative; z-index: 1;
  height: 26px; padding: 0;
  border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 12px; line-height: 1;
  color: var(--ai-fg-muted);
  border-radius: 999px;
  transition: color .18s ease;
}
.app-aside-topbar__btn.is-active { color: var(--ai-fg); font-weight: 600; }
.app-aside-topbar__btn:hover:not(.is-active) { color: var(--ai-fg); }
`;
