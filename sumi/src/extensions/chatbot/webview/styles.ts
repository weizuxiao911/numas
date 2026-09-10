/**
 * 全部 chat 样式 — extensions/chat/webview/styles.ts
 * UI 设计不变, 仅搬迁位置.
 */

export const styles = `
/* 霓虹跑圈: 注册角度变量, 供 conic-gradient 光点绕边框旋转 */
@property --ab-neon-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
.chat {
  /* ========== 主题色板: 优先使用 IDE/VSCode 主题变量, 暗色兜底 ========== */
  /* 与 left slot 保持一致 (var(--app-surface-muted)) */
  --ai-bg: var(--editor-background, var(--app-surface-muted, #181818));
  /* 弹层/浮起表面: 不允许透明, 用 editorWidget-background (VSCode 标准弹层色) */
  --ai-bg-elev: var(--editorWidget-background, var(--sideBar-background, var(--ai-bg, #1c1c22)));
  --ai-bg-input: color-mix(in srgb, var(--ai-fg, #e5e7eb) 5%, var(--ai-bg-elev));
  --ai-fg: var(--editor-foreground, #e5e7eb);
  --ai-fg-muted: var(--descriptionForeground, #9ca3af);
  --ai-border: var(--panel-border, var(--editorWidget-border, rgba(255,255,255,0.08)));
  --ai-divider: var(--editor-lineHighlightBorder, rgba(255,255,255,0.06));
  --ai-hover: var(--list-hoverBackground, rgba(255,255,255,0.06));
  --ai-active: var(--list-activeSelectionBackground, rgba(99,102,241,0.18));
  --ai-accent: var(--button-background, #6366f1);
  --ai-accent-fg: var(--button-foreground, #ffffff);
  --ai-accent-soft: var(--list-activeSelectionBackground, rgba(99,102,241,0.18));
  --ai-danger: var(--errorForeground, #fca5a5);
  --ai-danger-bg: var(--inputValidation-errorBackground, rgba(239,68,68,0.18));
  --ai-danger-border: var(--inputValidation-errorBorder, rgba(239,68,68,0.4));
  --ai-success: var(--terminal-ansiGreen, #4ade80);
  --ai-success-bg: color-mix(in srgb, var(--ai-success) 22%, var(--ai-bg-elev));
  --ai-warning: var(--editorWarning-foreground, #facc15);
  --ai-shadow: 0 16px 40px rgba(0,0,0,0.5);
  --ai-radius: 10px;

  /* ========== 金属 3D 风格 (Apple 质感, 基于主题色派生 = 兼容明/暗主题) ========== */
  /* 金属: 主题前景色漂白 → 高光; 主题背景压暗 → 暗部 */
  --ai-metal-hi: color-mix(in srgb, var(--ai-fg) 22%, #ffffff);
  --ai-metal-mid: color-mix(in srgb, var(--ai-fg) 10%, var(--ai-bg-elev));
  --ai-metal-lo: color-mix(in srgb, var(--ai-fg) 2%, #000000);
  --ai-metal: linear-gradient(180deg, var(--ai-metal-hi) 0%, var(--ai-metal-mid) 45%, var(--ai-metal-lo) 100%);
  --ai-metal-edge: color-mix(in srgb, var(--ai-fg) 18%, transparent);
  /* 金属强调 (发送键/logo): 主题强调色 + 高光顶 */
  --ai-metal-accent-hi: color-mix(in srgb, var(--ai-accent) 55%, #ffffff);
  --ai-metal-accent: linear-gradient(180deg, var(--ai-metal-accent-hi) 0%, var(--ai-accent) 55%, color-mix(in srgb, var(--ai-accent) 75%, #000000) 100%);
  /* 磨砂玻璃表面 (卡片/弹层) */
  --ai-glass-bg: color-mix(in srgb, var(--ai-bg-elev) 74%, transparent);
  --ai-glass-blur: blur(18px) saturate(160%);
  --ai-glass-edge: var(--ai-border);
  --ai-press-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 3px 10px color-mix(in srgb, #000 32%, transparent);
  --ai-pop-shadow: 0 24px 60px color-mix(in srgb, #000 55%, transparent), 0 0 0 1px var(--ai-glass-edge) inset;
  /* 抛光球面高光 (圆钮/图标) */
  --ai-chrome: radial-gradient(circle at 32% 24%, var(--ai-metal-hi) 0%, var(--ai-metal-mid) 40%, var(--ai-metal-lo) 92%);
  /* 霓虹灯强调色: 基于 accent 但强制饱和可见 (accent 可能是半透明白, 直接发光会不可见) */
  --ai-neon: color-mix(in srgb, var(--ai-accent) 55%, #7c3aed);

  /* ========== 官方对齐: 纯色层级表面 + hairline 细边 (无模糊/无玻璃) ========== */
  /* base = 聊天底色; layer01 = 卡片/工具表面 (比 base 微亮一档); layer02 = hover/输入 */
  --ai-surface: var(--ai-bg);
  --ai-surface-1: color-mix(in srgb, var(--ai-fg) 4%, var(--ai-bg));
  --ai-surface-2: color-mix(in srgb, var(--ai-fg) 7%, var(--ai-bg));
  /* hairline: 0.5px 主题边框 */
  --ai-hairline: color-mix(in srgb, var(--ai-fg) 10%, transparent);
  --ai-hairline-strong: color-mix(in srgb, var(--ai-fg) 18%, transparent);
  --ai-radius-card: 8px;
  --ai-radius-dock: 12px;

  display: flex; flex-direction: column; height: 100%;
  /* 会话面板底色: 官方 = 纯白面板 (bg-base); 不取编辑器灰底.
     用 editorWidget-background (浅色主题 = #fff, 深色 = 深弹层色), 明暗自适应 */
  background: var(--editorWidget-background, var(--ai-bg));
  color: var(--ai-fg);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif);
  font-size: var(--ai-font-size, var(--editor-font-size, 13px));
  overflow: hidden;
}

/* Topbar — 透明 (无背景, 露出下层主题色) + 底部投影分隔 (无顶部白色高光) */
.chat__topbar {
  height: 36px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px;
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow:
    0 3px 10px color-mix(in srgb, #000 22%, transparent);
  flex-shrink: 0;
}
.chat__brand { display: flex; align-items: center; gap: 8px; }
.chat__logo {
  width: 22px; height: 22px; border-radius: 7px;
  background: var(--ai-metal-accent);
  color: var(--ai-accent-fg); font-weight: 700; font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 2px 6px color-mix(in srgb, #000 35%, transparent);
  text-shadow: 0 1px 1px color-mix(in srgb, #000 30%, transparent);
}
.chat__brand-name { font-weight: 600; font-size: 13px; }
.chat__top-actions { display: flex; align-items: center; gap: 2px; }
.chat__icon-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 7px;
  color: var(--ai-fg-muted);
  cursor: pointer;
  transition: background .12s, box-shadow .12s;
}
.chat__icon-btn:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__icon-btn:active { box-shadow: var(--ai-press-shadow); }
.chat__login-btn {
  height: 26px; padding: 0 12px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--ai-accent, #0e639c); border: none; border-radius: 7px;
  color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer;
  transition: opacity .12s, background .12s;
}
.chat__login-btn:hover { opacity: .9; }
.chat__login-gate {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  padding: 24px;
}
.chat__login-title { font-size: 20px; font-weight: 700; color: var(--ai-fg); }
.chat__login-desc { font-size: 13px; color: var(--ai-fg-muted); }

/* Todos bar */
/* Todos dock (above composer, OpenCode style) */
.chat__todos-dock {
  margin: 8px 8px 0;
  padding: 0;
  background: var(--ai-input-bg);
  border: none;
  border-radius: 10px;
  flex-shrink: 0;
  overflow: hidden;
}
.chat__todos-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}
.chat__todos-title {
  font-size: 12px; color: var(--ai-fg-muted);
}
.chat__todos-caret {
  font-size: 10px; color: var(--ai-fg-muted);
}
.chat__todos-list {
  list-style: none; margin: 0; padding: 0 12px 8px 32px;
}
.chat__todo-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 4px 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ai-fg);
}
.chat__todo-item.is-completed {
  color: var(--ai-fg-muted);
  text-decoration: line-through;
  opacity: 0.7;
}
.chat__todo-item.is-in_progress {
  font-weight: 500;
  color: var(--ai-fg);
}
.chat__todo-check {
  flex-shrink: 0;
  margin-left: -22px;
  font-size: 12px;
  color: var(--ai-fg-muted);
  width: 14px;
  text-align: center;
}
.chat__todo-item.is-in_progress .chat__todo-check { color: var(--ai-warning); }
.chat__todo-item.is-completed .chat__todo-check { color: var(--ai-success); }

/* ========== Followup dock (busy 时排队消息, 输入框上方) ========== */
.chat__followup-dock {
  margin: 8px 8px 0;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border-radius: 10px;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 2px 8px color-mix(in srgb, #000 18%, transparent);
}
.chat__followup-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  cursor: pointer; user-select: none;
}
.chat__followup-label {
  flex-shrink: 0;
  font-size: 12.5px; font-weight: 600; color: var(--ai-fg);
}
.chat__followup-label.is-paused { color: var(--ai-warning); }
.chat__followup-preview {
  flex: 1; min-width: 0;
  font-size: 12.5px; color: var(--ai-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__followup-caret {
  margin-left: auto; flex-shrink: 0;
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); font-size: 10px; cursor: pointer;
}
.chat__followup-caret:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__followup-list {
  display: flex; flex-direction: column; gap: 4px;
  padding: 0 12px 10px;
  max-height: 168px; overflow-y: auto;
}
.chat__followup-item {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 0; min-width: 0;
}
.chat__followup-text {
  flex: 1; min-width: 0;
  font-size: 12.5px; color: var(--ai-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  user-select: text;
}
.chat__followup-send {
  flex-shrink: 0;
  padding: 3px 10px; border-radius: 6px;
  background: var(--ai-hover); border: none;
  color: var(--ai-fg); font-size: 11.5px; font-family: inherit;
  cursor: pointer;
  transition: background .12s;
}
.chat__followup-send:hover:not(:disabled) { background: var(--ai-active); }
.chat__followup-send:disabled { opacity: 0.5; cursor: default; }
.chat__followup-x {
  flex-shrink: 0;
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); font-size: 11px; cursor: pointer;
}
.chat__followup-x:hover:not(:disabled) { background: var(--ai-danger-bg); color: var(--ai-danger); }
.chat__followup-x:disabled { opacity: 0.5; cursor: default; }

/* Messages area */
.chat__messages {
  flex: 1; overflow-y: auto; overflow-x: hidden; min-width: 0;
  padding: 16px 20px;
  display: flex; flex-direction: column; min-width: 0;
  /* 保留滚动能力, 隐藏滚动条视觉 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.chat__messages::-webkit-scrollbar { width: 0; height: 0; display: none; }
.chat__msg { margin: 12px 0; display: flex; min-width: 0; max-width: 100%; }
.chat__msg.is-user { justify-content: flex-end; }
.chat__msg.is-assistant { justify-content: flex-start; }
/* assistant 消息体撑满消息列宽, 卡片宽度统一适配 */
.chat__msg.is-assistant > .chat__msg-body { flex: 1; min-width: 0; }
.chat__msg-user-col { display: flex; flex-direction: column; align-items: flex-end; max-width: 100%; min-width: 0; }
 .chat__msg-body {
  max-width: 100%; min-width: 0;
  color: var(--ai-fg);
  font-size: 13px; line-height: 1.65;
  overflow-wrap: anywhere;
  user-select: text;
 }
 /* 中断后无内容的 assistant 消息占位 */
  .chat__msg-aborted {
   color: var(--ai-fg-muted);
   font-size: 12.5px;
   font-style: italic;
   padding: 2px 0;
  }
/* 等待首个 token: 骨架屏 shimmer 条 (首字到达后由真实内容替换) */
.chat__msg-waiting {
  display: flex; flex-direction: column; gap: 8px;
  padding: 4px 0 2px;
}
.chat__msg-waiting-bar {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ai-fg) 7%, transparent) 0%,
    color-mix(in srgb, var(--ai-fg) 15%, transparent) 50%,
    color-mix(in srgb, var(--ai-fg) 7%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: chat-shimmer 1.4s ease-in-out infinite;
}
.chat__msg-waiting-bar:nth-child(1) { width: 46%; }
.chat__msg-waiting-bar:nth-child(2) { width: 82%; animation-delay: .12s; }
.chat__msg-waiting-bar:nth-child(3) { width: 64%; animation-delay: .24s; }
@keyframes chat-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.chat__msg-body > * { min-width: 0; max-width: 100%; }
/* 卡片/文本统一占满消息体宽度 */
.chat__msg-body > div,
.chat__msg-body > section,
.chat__msg-body > aside,
.chat__msg-body > .chat-md,
.chat__msg-body > .tool,
.chat__msg-body > .todo,
.chat__msg-body > .reason,
.chat__msg-body > .sub,
.chat__msg-body > .q {
  width: 100%; box-sizing: border-box;
}
.chat__msg-body pre, .chat__msg-body code {
  max-width: 100%;
  overflow-x: auto;
  word-break: break-all;
  white-space: pre-wrap;
  box-sizing: border-box;
}
.chat__msg-bubble.is-user {
  display: inline-block;
  background: var(--ai-hover);
  color: var(--ai-fg);
  padding: 7px 12px;
  border-radius: 12px;
  word-wrap: break-word; overflow-wrap: anywhere; white-space: pre-wrap;
  font-size: 13px; line-height: 1.5;
  max-width: 100%;
}
.chat__msg-user-text { white-space: pre-wrap; user-select: text; }
.chat__part-file--image {
  display: block; max-width: 240px; max-height: 240px;
  border-radius: 8px; margin-top: 6px;
  object-fit: contain;
}
.chat__part-file {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 6px; max-width: 100%;
}
.chat__part-file a {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--ai-hover);
  border: none;
  border-radius: 8px;
  color: var(--ai-fg);
  text-decoration: none;
  font-size: 12.5px;
  max-width: 100%;
}
.chat__part-file-icon { flex-shrink: 0; color: var(--ai-fg-muted); display: inline-flex; }
.chat__part-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 强制: 消息列内所有容器不要溢出 (thinking / tool / reason / q-card 卡片都靠这条) */
.chat__msg-body > div,
.chat__msg-body > pre,
.chat__msg-body > section,
.chat__msg-body > aside {
  min-width: 0; max-width: 100%; overflow-x: auto;
  box-sizing: border-box;
}
.chat__msg-meta {
  display: flex;
  align-items: center; gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--ai-fg-muted);
}
.chat__msg-meta.is-user { justify-content: flex-end; }
.chat__msg-copy {
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); cursor: pointer; padding: 0;
}
.chat__msg-copy:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__msg-sep { opacity: 0.5; }
.chat__msg-model { font-weight: 500; }

/* Error */
.chat__error {
  margin: 0 12px 8px;
  padding: 8px 12px;
  background: var(--ai-danger-bg);
  border: 1px solid var(--ai-danger-border);
  border-radius: 8px;
  color: var(--ai-danger); font-size: 12px;
  display: flex; align-items: center; gap: 10px;
}
.chat__error button {
  margin-left: auto;
  background: var(--ai-hover); border: none; color: var(--ai-danger);
  padding: 3px 10px; border-radius: 5px; cursor: pointer; font-size: 11px;
}

/* 信息/成功提示 (非错误) — 蓝色调, 与红色错误区分 */
.chat__notice {
  margin: 0 12px 8px;
  padding: 8px 12px;
  background: var(--ai-accent-soft);
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  color: var(--ai-fg); font-size: 12px;
  display: flex; align-items: center; gap: 10px;
  white-space: pre-wrap; word-break: break-word;
}
.chat__notice-text { flex: 1; min-width: 0; }
.chat__notice button {
  flex-shrink: 0;
  background: transparent; border: none; color: var(--ai-fg-muted);
  cursor: pointer; font-size: 13px; line-height: 1; padding: 2px 4px;
}
.chat__notice button:hover { color: var(--ai-fg); }

/* Session status bar: 只承载非 busy/idle 状态 (retry 退避/限额) — 琥珀警示调 */
.chat__status {
  margin: 0 12px 8px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--ai-warning) 14%, var(--ai-bg-elev));
  border: 1px solid color-mix(in srgb, var(--ai-warning) 35%, transparent);
  border-radius: 8px;
  color: var(--ai-fg);
  font-size: 12px;
  display: flex; align-items: flex-start; gap: 8px;
  white-space: pre-wrap; word-break: break-word;
}
.chat__status-spin {
  flex-shrink: 0; margin-top: 2px;
  color: var(--ai-warning);
  animation: chat-status-rotate 1.4s linear infinite;
}
@keyframes chat-status-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.chat__status-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.chat__status-title { font-weight: 600; color: var(--ai-warning); line-height: 1.35; }
.chat__status-next { margin-left: 6px; font-weight: 400; opacity: 0.85; }
.chat__status-msg { line-height: 1.45; }
.chat__status-link {
  flex-shrink: 0;
  margin-top: 1px;
  background: var(--ai-hover);
  border: 1px solid var(--ai-border);
  color: var(--ai-fg);
  text-decoration: none;
  padding: 3px 10px; border-radius: 5px;
  font-size: 11px; line-height: 1.4;
  white-space: nowrap;
}
.chat__status-link:hover { background: var(--ai-active); color: var(--ai-accent); }

/* Composer — 官方 prompt input 卡片风: rounded-12 + hairline 边框 + 无霓虹/无金属渐变 */
.chat__composer {
  padding: 8px 12px 12px;
  flex-shrink: 0;
  position: relative;
}
.chat__input-wrap {
  position: relative;
  background: var(--ai-bg-elev, var(--editorWidget-background));
  border: 1px solid var(--ai-border);
  border-radius: 12px;
  padding: 6px 10px 4px;
  box-shadow: none;
  transition: border-color .15s, background .15s;
  display: flex; flex-direction: column;
}
.chat__input-wrap:focus-within {
  border-color: color-mix(in srgb, var(--ai-accent) 45%, var(--ai-border));
  background: var(--ai-bg-elev);
}
.chat__input-wrap textarea {
  width: 100%; resize: none;
  background: transparent; border: none; outline: none;
  color: var(--ai-fg);
  font-family: inherit; font-size: 16px; line-height: 1.55;
  padding: 10px 4px 10px; min-height: 56px; max-height: 220px;
  overflow-y: auto; display: block;
}
.chat__input-wrap textarea::placeholder { color: var(--ai-fg-muted); }

/* Context chips (编辑器选区 / 终端选区 / 文件树挂载) */
.chat__input-chips {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  padding: 0 2px 6px;
  min-width: 0;
}
.chat__ctx-chip {
  position: relative;
  display: inline-flex; align-items: center; gap: 4px;
  max-width: 220px; height: 22px;
  margin: 0; padding: 0 4px 0 5px;
  box-sizing: border-box;
  background: var(--ai-surface-muted, var(--ai-bg-elev));
  border: 1px solid var(--ai-border, rgba(0,0,0,0.12));
  border-radius: 4px;
  font-size: 12px; line-height: 1; color: var(--ai-fg);
  font-family: inherit; cursor: pointer; text-align: left;
  flex: 0 0 auto;
  user-select: none;
}
.chat__ctx-chip:hover { border-color: var(--ai-accent); }
.chat__ctx-chip-ic {
  flex-shrink: 0; width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ai-fg-muted);
}
.chat__ctx-chip-name {
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__ctx-chip-range {
  flex-shrink: 0; color: var(--ai-fg-muted); font-size: 11px;
}
.chat__ctx-chip-x {
  flex-shrink: 0;
  background: transparent; border: none; color: var(--ai-fg-muted);
  font-size: 12px; cursor: pointer; line-height: 1; padding: 0 1px;
}
.chat__ctx-chip-x:hover { color: var(--ai-danger); }

/* Attachment cards */
.chat__attach {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 0 2px 8px;
}
.chat__attach-card {
  position: relative;
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 180px;
  padding: 4px 6px;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 8px;
  font-size: 11px;
  color: var(--ai-fg);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset;
  transition: border-color .15s, background .15s;
}
.chat__attach-card:hover { border-color: var(--ai-accent); }
.chat__attach-name {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__attach-thumb {
  width: 26px; height: 26px; object-fit: cover;
  border-radius: 5px; flex-shrink: 0;
}
.chat__attach-progress {
  position: absolute; left: 4px; right: 4px; bottom: 4px;
  height: 3px; background: color-mix(in srgb, var(--ai-fg) 12%, transparent);
  border-radius: 2px; overflow: hidden;
}
.chat__attach-progress-bar {
  display: block; height: 100%;
  background: linear-gradient(90deg, var(--ai-accent), color-mix(in srgb, var(--ai-accent) 60%, #ffffff));
  transition: width 0.15s ease-out;
}
.chat__attach-ic {
  flex-shrink: 0; width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 5px;
  background: var(--ai-input-bg);
  color: var(--ai-fg-muted);
}
.chat__attach-ic--lg { width: 52px; height: 52px; border-radius: 12px; }
.chat__attach-x {
  flex-shrink: 0;
  background: transparent; border: none; color: var(--ai-fg-muted);
  font-size: 13px; cursor: pointer; line-height: 1; padding: 0 2px;
}
.chat__attach-x:hover { color: var(--ai-danger); }

/* 附件预览 */
.chat__preview {
  width: min(680px, 100%);
  max-height: min(calc(100vh - 72px), 720px);
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 16px;
  box-shadow: var(--ai-pop-shadow);
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: chat-pop .14s ease-out;
}
.chat__preview-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 0 var(--ai-divider);
}
.chat__preview-name {
  flex: 1; min-width: 0;
  font-size: 13px; font-weight: 600; color: var(--ai-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__preview-body {
  flex: 1; overflow: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  min-height: 200px;
}
.chat__preview-body img {
  max-width: 100%; max-height: calc(100vh - 220px);
  object-fit: contain;
  border-radius: 8px;
}
.chat__preview-file {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: var(--ai-fg-muted);
}
.chat__preview-path {
  font-size: 12.5px;
  word-break: break-all;
  text-align: center;
}

.chat__input-bar {
  display: flex; align-items: center; gap: 4px;
}
.chat__select { position: relative; min-width: 0; flex: 0 1 auto; }
.chat__bar-spacer { flex: 1; }
.chat__bar-btn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 28px; padding: 0 8px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--ai-fg-muted);
  font-family: inherit; font-size: 13px;
  cursor: pointer; transition: background .12s, color .12s;
  max-width: 100%;
  min-width: 0;
  flex: 0 1 auto;
}
.chat__bar-btn > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto;
}
.chat__bar-btn:hover {
  background: var(--ai-hover);
  color: var(--ai-fg);
}
.chat__bar-plus { width: 28px; padding: 0; justify-content: center; }
.chat__spark { color: var(--ai-accent); }
.chat__send {
  width: 32px; height: 32px; border-radius: 10px;
  border: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--ai-metal-accent); color: var(--ai-accent-fg);
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 3px 10px color-mix(in srgb, #000 35%, transparent);
  transition: filter .15s, opacity .15s, transform .06s;
  flex-shrink: 0;
}
.chat__send:hover:not(:disabled) { filter: brightness(1.12); }
.chat__send:active:not(:disabled) { transform: translateY(1px); }
.chat__send:disabled {
  opacity: 0.35; cursor: not-allowed;
  background: var(--ai-hover); color: var(--ai-fg-muted);
  box-shadow: none;
}
.chat__send--stop {
  background: var(--ai-danger-bg); color: var(--ai-danger);
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 2px 6px color-mix(in srgb, #000 25%, transparent);
}
.chat__stop-square {
  width: 9px; height: 9px;
  background: currentColor; border-radius: 2px;
}

/* 上传中 spinner (取代发送箭头, 表示正在上传) */
.chat__send--uploading {
  cursor: wait; opacity: 0.85;
}
.chat__upload-spinner {
  display: block; width: 14px; height: 14px;
  border: 2px solid var(--ai-accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: chat-spin 0.8s linear infinite;
}
@keyframes chat-spin {
  to { transform: rotate(360deg); }
}
/* 附件卡: 上传中脉动 */
.chat__attach-card.is-uploading {
  animation: chat-pulse 1s ease-in-out infinite;
}
@keyframes chat-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ai-accent) 40%, transparent); }
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ai-accent) 12%, transparent); }
}

/* Model picker — 居中全局模态框 + 遮罩 */
.chat__modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--vscode-overlay-background, rgba(0,0,0,0.45));
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: chat-fade .12s ease-out;
}
@keyframes chat-fade { from { opacity: 0; } to { opacity: 1; } }

.chat__modal {
  width: 560px; max-width: 100%;
  max-height: min(calc(100vh - 72px), 600px);
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 16px;
  box-shadow: var(--ai-pop-shadow);
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: chat-pop .14s ease-out;
}
@keyframes chat-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Header */
.chat__modal-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; padding: 20px 22px 12px;
}
.chat__modal-header--page {
  align-items: center; gap: 10px;
  padding: 18px 22px 8px;
}
.chat__modal-header-text { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.chat__modal-title {
  font-size: 17px; font-weight: 600; color: var(--ai-fg);
  display: inline-flex; align-items: center; gap: 8px;
}
.chat__modal-title-icon { color: var(--ai-accent); display: inline-flex; }
.chat__modal-count {
  font-size: 12px; font-weight: 400; color: var(--ai-fg-muted);
  margin-left: 2px;
}
.chat__modal-subtitle {
  font-size: 13px; color: var(--ai-fg-muted);
}
.chat__modal-back {
  width: 30px; height: 30px;
  background: transparent; border: none;
  color: var(--ai-fg-muted);
  cursor: pointer; padding: 0; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
}
.chat__modal-back:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__modal-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 14px;
  background: var(--ai-hover);
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px; font-weight: 500;
  cursor: pointer; flex-shrink: 0;
}
.chat__modal-btn-primary:hover { background: var(--ai-hover); }

/* Search */
.chat__modal-search {
  display: flex; align-items: center; gap: 10px;
  margin: 16px 16px 4px;
  padding: 9px 14px;
  background: var(--ai-input-bg);
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  color: var(--ai-fg-muted);
}
.chat__modal-search:focus-within {
  border-color: var(--ai-accent);
  background: var(--ai-accent-soft);
}
.chat__modal-search input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px;
}
.chat__modal-search input::placeholder { color: var(--ai-fg-muted); }

/* Body */
.chat__modal-body {
  flex: 1; overflow-y: auto;
  padding: 16px 12px 16px;
}
.chat__modal-body--apikey {
  padding: 8px 22px 22px;
}

.chat__modal-error {
  margin: 8px 6px;
  padding: 8px 12px;
  background: var(--ai-danger-bg);
  border: 1px solid var(--ai-danger-border);
  border-radius: 8px;
  color: var(--ai-danger); font-size: 13px;
}

/* select view: 分组模型列表 */
.chat__modal-group { padding: 2px 0; }
.chat__modal-group-title {
  padding: 12px 14px 6px;
  font-size: 11.5px; font-weight: 600; color: var(--ai-fg-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
  user-select: none;
}
.chat__modal-item {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 8px 12px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
  transition: background .1s;
}
.chat__modal-item:hover { background: var(--ai-hover); }
.chat__modal-item.is-active {
  background: var(--ai-active);
  color: var(--ai-fg);
}
.chat__modal-item.is-highlighted {
  background: var(--ai-hover);
  outline: 1px solid var(--ai-accent);
  outline-offset: -1px;
}
.chat__modal-item.is-highlighted.is-active {
  background: var(--ai-active);
}
/* 多行 layout (icon + title + desc + check) — 比紧凑行高 4px, 适合 agent/skill 等带描述 */
.chat__modal-item--row {
  padding: 9px 12px;
  align-items: flex-start;
  gap: 12px;
}
.chat__modal-item--row .chat__modal-item-icon {
  margin-top: 1px;
}
/* 单行 item (跟 ModelPicker 一致: icon + name + tag + check) */
.chat__modal-item-emoji {
  font-size: 16px; line-height: 1; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; flex-shrink: 0;
}
.chat__modal-item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.chat__modal-item-icon { font-size: 16px; line-height: 1; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 22px; }
.chat__modal-item-icon--lg { font-size: 18px; width: 28px; height: 28px; background: var(--ai-accent-soft); border-radius: 8px; }
.chat__modal-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.chat__modal-item-desc { font-size: 11.5px; color: var(--ai-fg-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.chat__modal-item-check { color: var(--ai-accent); display: inline-flex; flex-shrink: 0; }

/* Header close (icon SVG) */
.chat__modal-x {
  width: 30px; height: 30px;
  background: transparent; border: none;
  color: var(--ai-fg-muted);
  cursor: pointer; padding: 0; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px;
  transition: all .12s;
}
.chat__modal-x:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__skill-item { align-items: flex-start; }
.chat__skill-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 3px;
}
.chat__skill-name { font-weight: 600; color: var(--ai-fg); }
.chat__skill-desc {
  font-size: 12px; font-weight: 400; color: var(--ai-fg-muted);
  line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.chat__skill-loc {
  font-size: 10.5px; color: var(--ai-fg-muted); opacity: .7;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__modal-tag {
  flex-shrink: 0;
  font-size: 10.5px; padding: 2px 7px; border-radius: 4px;
  background: var(--ai-success-bg);
  color: var(--ai-success);
}
.chat__modal-check { flex-shrink: 0; }
.chat__modal-empty {
  padding: 28px 16px; text-align: center;
  color: var(--ai-fg-muted); font-size: 13px;
}

.chat__modal-foot {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  box-shadow: 0 -1px 0 var(--ai-divider);
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px; font-weight: 500;
  cursor: pointer; text-align: left;
}
.chat__modal-foot:hover { background: var(--ai-input-bg); }

/* providers view: catalog 列表 */
.chat__modal-cat { padding: 2px 4px 12px; }
.chat__modal-cat-title {
  padding: 8px 12px;
  font-size: 13px; color: var(--ai-fg-muted);
  font-weight: 500;
}
.chat__modal-catrow {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 8px 14px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
}
.chat__modal-catrow:hover { background: var(--ai-hover); }
.chat__modal-catrow.is-highlighted {
  background: var(--ai-hover);
  outline: 1px solid var(--ai-accent);
  outline-offset: -1px;
}
.chat__modal-catrow.is-connected { opacity: 0.65; }
.chat__modal-catrow.is-highlighted.is-connected { opacity: 1; }
.chat__modal-caticon {
  width: 24px; height: 24px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ai-fg-muted);
}
.chat__modal-catname { flex: 1; min-width: 0; font-size: 13px; }

/* apikey view */
.chat__modal-apikey-desc {
  margin: 4px 0 18px;
  font-size: 14px; line-height: 1.6;
  color: var(--ai-fg-muted);
}
.chat__modal-apikey-label {
  display: block;
  font-size: 14px; font-weight: 600;
  color: var(--ai-fg);
  margin-bottom: 8px;
}
.chat__modal-apikey-input {
  width: 100%;
  padding: 11px 14px;
  background: var(--ai-input-bg);
  border: 1px solid var(--ai-accent);
  border-radius: 10px;
  color: var(--ai-fg);
  font-family: inherit; font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.chat__modal-apikey-input:focus {
  border-color: var(--ai-accent);
  background: var(--ai-accent-soft);
}
.chat__modal-apikey-actions {
  display: flex; justify-content: flex-start;
  margin-top: 18px;
}
.chat__modal-btn-continue {
  height: 38px; padding: 0 26px;
  background: var(--button-background, #3a3a42);
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  color: var(--ai-accent-fg);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer;
  box-shadow: var(--ai-shadow);
}
.chat__modal-btn-continue:hover:not(:disabled) { filter: brightness(1.12); }
.chat__modal-btn-continue:disabled { opacity: 0.5; cursor: not-allowed; }


/* Sessions modal — 历史会话 */
.chat__sess-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.chat__sess-clear {
  background: transparent; border: 1px solid var(--ai-border); border-radius: 6px;
  color: var(--ai-danger); font-size: 12px; cursor: pointer; padding: 4px 10px;
}
.chat__sess-clear:hover { background: var(--ai-danger-bg); }
.chat__sess-item { padding-right: 8px; }
.chat__sess-dir {
  flex-shrink: 0; max-width: 130px;
  font-size: 10.5px; color: var(--ai-fg-muted); opacity: .75;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__sess-del {
  flex-shrink: 0; width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); cursor: pointer; padding: 0;
  opacity: 0;
}
.chat__modal-item:hover .chat__sess-del { opacity: 1; }
.chat__sess-del:hover { background: var(--ai-danger-bg); color: var(--ai-danger); }


/* ========== 命令 / 提及 弹层 (输入框上方, 与 agent-pop 风格统一) ========== */
.chat__cmd-pop {
  position: absolute; bottom: calc(100% + 6px); left: 12px; right: 12px;
  max-height: 280px; overflow-y: auto;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 12px;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 12px 32px color-mix(in srgb, #000 40%, transparent);
  padding: 4px;
  z-index: 70;
}
.chat__cmd-list { display: flex; flex-direction: column; gap: 1px; }
.chat__cmd-item {
  display: flex; align-items: baseline; gap: 10px;
  width: 100%; padding: 6px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--ai-fg); font-family: inherit; text-align: left;
  cursor: pointer;
}
.chat__cmd-item--mention { align-items: center; }
.chat__cmd-item:hover { background: var(--ai-hover); }
.chat__cmd-item.active { background: var(--ai-active); }
.chat__cmd-cmd {
  flex: 0 1 auto; min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; font-weight: 600;
  color: var(--ai-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__cmd-name {
  flex: 1; min-width: 0;
  font-size: 12px; color: var(--ai-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chat__cmd-hint {
  flex-shrink: 0; max-width: 40%;
  font-size: 10.5px; color: var(--ai-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-left: auto;
  opacity: .8;
}
.chat__cmd-empty {
  padding: 18px 12px; text-align: center;
  color: var(--ai-fg-muted); font-size: 12px;
}

/* ========== Agent 选择下拉 (与 ModelPicker 风格统一) ========== */
.chat__agent-pop {
  position: absolute; bottom: calc(100% + 8px); left: 0;
  width: 320px; max-height: 380px; overflow-y: auto;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 12px;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 12px 32px color-mix(in srgb, #000 40%, transparent);
  padding: 6px;
  z-index: 60;
}
.chat__agent-pop-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px 8px;
}
.chat__agent-pop-title { font-size: 12px; font-weight: 600; color: var(--ai-fg); }
.chat__agent-pop-close {
  width: 22px; height: 22px;
  background: transparent; border: none;
  color: var(--ai-fg-muted); font-size: 13px; line-height: 1;
  cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 5px;
}
.chat__agent-pop-close:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__agent-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 10px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--ai-fg); font-family: inherit; text-align: left;
  cursor: pointer;
}
.chat__agent-item:hover { background: var(--ai-hover); }
.chat__agent-item.active { background: var(--ai-active); }
.chat__agent-item.active .chat__agent-name { color: var(--ai-fg); }
.chat__agent-icon {
  width: 28px; height: 28px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px;
  background: var(--ai-hover);
  border-radius: 7px;
}
.chat__agent-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.chat__agent-name { font-size: 12.5px; font-weight: 600; }
.chat__agent-desc { font-size: 11px; color: var(--ai-fg-muted); line-height: 1.4; }
.chat__agent-check { flex-shrink: 0; color: var(--ai-accent); display: inline-flex; }

/* ========== Tool call card (OpenCode style) ========== */
.tool {
  margin: 8px 0;
  background: var(--ai-surface-1);
  border: 0.5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-card);
  overflow: hidden;
  min-width: 0;
}
.tool__head {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--ai-fg); font-family: inherit; font-size: 12.5px;
  text-align: left;
  min-width: 0;
  transition: background .12s;
}
.tool__head:hover { background: var(--ai-hover); }
.tool.is-open > .tool__head { background: var(--ai-active); }
.tool__icon {
  width: 20px; height: 20px; border-radius: 5px;
  background: var(--ai-hover);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
}
.tool.is-open > .tool__head .tool__icon { background: var(--ai-accent-soft); }
.tool__name {
  font-weight: 600; font-size: 12px;
  color: var(--ai-fg);
  flex-shrink: 0;
}
.tool__summary {
  flex: 1; min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px; color: var(--ai-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 0 4px;
}
.tool__caret {
  margin-left: auto;
  color: var(--ai-fg-muted); font-size: 11px; flex-shrink: 0;
  padding: 0 6px; min-width: 14px; text-align: center;
  transition: transform .15s;
}
.tool.is-open > .tool__head .tool__caret { color: var(--ai-fg); }
.tool__body { padding: 0 10px 10px; min-width: 0; }
.tool__section {
  margin-top: 4px;
  min-width: 0;
  box-shadow: -2px 0 0 var(--ai-divider);
  padding-left: 10px;
}
.tool__section pre {
  margin: 0; padding: 8px 10px;
  background: var(--ai-bg); border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.6;
  max-width: 100%; min-width: 0;
  overflow-x: auto; overflow-y: auto;
  white-space: pre-wrap; word-break: break-all;
  max-height: 260px;
}
.tool__section.is-error pre { color: var(--ai-danger); background: color-mix(in srgb, var(--ai-danger-bg) 30%, var(--ai-bg)); }
.tool__section-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 4px 0 2px;
}
.tool__section-label {
  font-size: 10.5px; font-weight: 600;
  color: var(--ai-fg-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.tool__copy {
  font-size: 10.5px; padding: 2px 6px;
  background: var(--ai-hover); border: none; border-radius: 4px;
  color: var(--ai-fg-muted); cursor: pointer;
  font-family: inherit;
  transition: background .12s, color .12s;
}
.tool__copy:hover { background: var(--ai-active); color: var(--ai-fg); }
.tool__code {
  margin: 0; padding: 8px 10px;
  background: var(--ai-bg); border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.6;
  max-width: 100%; min-width: 0;
  user-select: text;
  overflow-x: auto; overflow-y: auto;
  white-space: pre-wrap; word-break: break-all;
  max-height: 260px;
}
.tool__status {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; padding: 1px 6px; border-radius: 4px;
  background: var(--ai-hover); color: var(--ai-fg-muted);
  flex-shrink: 0;
}
.tool__status.is-completed { color: var(--ai-success, #16a34a); background: color-mix(in srgb, var(--ai-success, #16a34a) 12%, var(--ai-hover)); }
.tool__status.is-error { color: var(--ai-danger); background: color-mix(in srgb, var(--ai-danger) 12%, var(--ai-hover)); }
.tool__status.is-running { color: var(--ai-accent); background: color-mix(in srgb, var(--ai-accent) 12%, var(--ai-hover)); }
.tool__status-icon { font-size: 10px; }
.tool__attach-list {
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 4px 0;
}
.tool__attach {
  font-size: 11px; padding: 2px 6px;
  background: var(--ai-bg); border-radius: 4px;
  color: var(--ai-fg-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ========== Question card (OpenCode style) ========== */
.q {
  margin: 8px 0;
  background: var(--ai-surface-1);
  border: 0.5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-card);
  overflow: hidden;
  min-width: 0;
}
.q__head {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: transparent; border: none; cursor: pointer;
  user-select: none; font-family: inherit;
  font-size: 12.5px; text-align: left;
}
.q__head:hover { background: var(--ai-hover); }
.q__caret {
  font-size: 10px; color: var(--ai-fg-muted); flex-shrink: 0;
  margin-left: auto;
}
.q__badge {
  font-size: 11px; color: var(--ai-fg-muted);
  display: inline-flex; align-items: center; justify-content: center;
}
.q__head-title { flex: 1; font-weight: 500; }
/* 多问题 tab: 单条不显示, 多条时显示可切换 */
.q__tabs { display: flex; gap: 3px; flex-shrink: 0; }
.q__tab {
  min-width: 24px; padding: 2px 7px;
  background: transparent; border: 1px solid transparent; border-radius: 5px;
  color: var(--ai-fg-muted); font-size: 11.5px; font-family: inherit;
  cursor: pointer; text-align: center;
}
.q__tab:hover { background: var(--ai-hover); color: var(--ai-fg); }
.q__tab.is-active {
  background: var(--ai-active); color: var(--ai-fg);
}
.q__summary {
  padding: 2px 10px 8px 26px;
  font-size: 12.5px; color: var(--ai-fg);
  line-height: 1.5;
}
.q.is-cancelled .q__summary { color: var(--ai-fg-muted); font-style: italic; }
.q__item { padding: 4px 10px 8px; }
.q__q {
  font-size: 13px; line-height: 1.5;
  margin-bottom: 6px;
}
.q__opts { display: flex; flex-direction: column; gap: 4px; }
.q__opt {
  display: flex; align-items: flex-start; gap: 8px;
  width: 100%; padding: 7px 10px;
  background: transparent; border: 1px solid transparent; border-radius: 6px;
  color: var(--ai-fg); font-family: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
}
.q__opt:hover { background: var(--ai-input-bg); }
.q__opt.is-active { background: var(--ai-active); }
.q__opt-mark {
  flex-shrink: 0; font-size: 13px; line-height: 1.4;
  color: var(--ai-fg-muted);
}
.q__opt.is-active .q__opt-mark { color: var(--ai-accent); }
.q__opt-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.q__opt-label { font-size: 13px; }
.q__opt-desc { font-size: 11.5px; color: var(--ai-fg-muted); line-height: 1.4; }
.q__custom {
  width: 100%; resize: none;
  background: transparent; border: none; outline: none;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px;
  padding: 2px 0;
}
.q__custom::placeholder { color: var(--ai-fg-muted); }
.q__custom-opt { cursor: text; }
.q__foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 0 10px 10px;
}
.q__foot-start { display: flex; gap: 8px; margin-right: auto; }
.q__foot-end { display: flex; gap: 8px; }
.q__nav {
  padding: 5px 14px; border-radius: 6px; cursor: pointer;
  background: transparent;
  color: var(--ai-fg);
  border: 1px solid var(--ai-border);
  font-size: 12px; font-weight: 500;
}
.q__nav:hover { background: var(--ai-hover); }
.q__cancel { color: var(--ai-danger, #e5534b); border-color: color-mix(in srgb, var(--ai-danger, #e5534b) 40%, transparent); }
.q__cancel:hover { background: color-mix(in srgb, var(--ai-danger, #e5534b) 12%, transparent); }
.q__submit {
  padding: 5px 14px; border-radius: 6px; cursor: pointer;
  background: var(--ai-hover);
  color: var(--ai-fg);
  border: none;
  font-size: 12px; font-weight: 500;
}
.q__submit:hover { background: var(--ai-hover); }
.q__submit:disabled { opacity: 0.5; cursor: default; }
.q--waiting {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  color: var(--ai-fg-muted);
  font-size: 12.5px;
}

/* ========== Question modal (dock above composer) ========== */
.chat__qmodal {
  margin-bottom: 8px;
  background: var(--ai-input-bg);
  border: none;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}
.chat__qmodal-head {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  box-shadow: 0 1px 0 var(--ai-divider);
  cursor: pointer; user-select: none;
  background: transparent; border: none; width: 100%; font-family: inherit; text-align: left;
}
.chat__qmodal-head:hover { background: var(--ai-hover); }
.chat__qmodal-caret {
  font-size: 10px; color: var(--ai-fg-muted); flex-shrink: 0;
}
.chat__qmodal-count { font-size: 12px; font-weight: 500; }
.chat__qmodal-tabs { display: flex; gap: 4px; flex: 1; }
.chat__qmodal-tab {
  padding: 3px 10px;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); font-size: 11.5px;
  cursor: pointer;
}
.chat__qmodal-tab:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__qmodal-tab.is-active {
  background: var(--ai-active); color: var(--ai-fg);
}
.chat__qmodal-min {
  width: 24px; height: 24px;
  background: transparent; border: none; border-radius: 5px;
  color: var(--ai-fg-muted); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.chat__qmodal-min:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__qmodal-body { padding: 10px 12px; }
.chat__qmodal-q { font-size: 13px; line-height: 1.5; }
.chat__qmodal-hint { font-size: 11.5px; color: var(--ai-fg-muted); margin: 4px 0 8px; }
.chat__qmodal-opts { display: flex; flex-direction: column; gap: 4px; }
.chat__qmodal-opt {
  display: flex; align-items: flex-start; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: transparent; border: 1px solid transparent; border-radius: 6px;
  color: var(--ai-fg); font-family: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
}
.chat__qmodal-opt:hover { background: var(--ai-input-bg); }
.chat__qmodal-opt.is-active { background: var(--ai-active); }
.chat__qmodal-opt.is-custom { cursor: text; }
.chat__qmodal-radio {
  width: 15px; height: 15px; border-radius: 50%;
  border: 1.5px solid var(--descriptionForeground);
  flex-shrink: 0; margin-top: 1px;
  display: inline-flex; align-items: center; justify-content: center;
}
.chat__qmodal-opt.is-active .chat__qmodal-radio { border-color: var(--ai-accent); }
.chat__qmodal-radio-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: transparent;
}
.chat__qmodal-opt.is-active .chat__qmodal-radio-dot { background: var(--ai-accent); }
.chat__qmodal-opt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.chat__qmodal-opt-label { font-size: 13px; }
.chat__qmodal-opt-desc { font-size: 11.5px; color: var(--ai-fg-muted); line-height: 1.4; }
.chat__qmodal-opt textarea {
  width: 100%; resize: none;
  background: transparent; border: none; outline: none;
  color: var(--ai-fg);
  font-family: inherit; font-size: 13px;
  padding: 2px 0;
}
.chat__qmodal-opt textarea::placeholder { color: var(--ai-fg-muted); }
.chat__qmodal-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 4px 12px 10px;
  border-top: none;
}
.chat__qmodal-foot-start { display: flex; gap: 8px; }
.chat__qmodal-foot-end { display: flex; gap: 8px; margin-left: auto; }
.chat__qmodal-btn {
  padding: 4px 10px; border-radius: 5px; cursor: pointer;
  background: transparent; border: none;
  color: var(--ai-fg-muted);
  font-size: 12px; font-weight: 500;
}
.chat__qmodal-btn:hover { background: var(--ai-hover); color: var(--ai-fg); }
.chat__qmodal-btn--primary {
  background: var(--ai-hover);
}
.chat__qmodal-btn--primary:hover { background: var(--ai-hover); }
.chat__qmodal-btn:disabled { opacity: 0.5; cursor: default; }

/* ========== Todo card (OpenCode style) ========== */
.todo {
  margin: 8px 0;
  background: var(--ai-surface-1);
  border: 0.5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-card);
  overflow: hidden;
  min-width: 0;
}
.todo__head {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--ai-fg); font-size: 12.5px; font-family: inherit;
  text-align: left; min-width: 0;
}
.todo__head:hover { background: var(--ai-hover); }
.todo.is-open > .todo__head { background: var(--ai-active); }
.todo__status {
  width: 20px; height: 20px; border-radius: 5px;
  background: var(--ai-hover);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
  color: var(--ai-fg);
}
.todo__status--completed { color: var(--ai-success); }
.todo__status--cancelled { color: var(--ai-danger); }
.todo__title {
  font-weight: 600; font-size: 12px;
  color: var(--ai-fg); flex: 1; min-width: 0;
}
.todo__caret {
  margin-left: auto;
  color: var(--ai-fg-muted); font-size: 11px; flex-shrink: 0;
  padding: 0 4px; min-width: 14px; text-align: center;
}
.todo.is-open > .todo__head .todo__caret { color: var(--ai-fg); }
.todo__list {
  list-style: none; margin: 0; padding: 0 10px 8px;
}
.todo__item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 4px 0 4px 28px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ai-fg);
}
.todo__item.is-completed,
.todo__item.is-cancelled {
  color: var(--ai-fg-muted);
  text-decoration: line-through;
  opacity: 0.7;
}
.todo__item.is-cancelled .todo__check { color: var(--ai-danger); }
.todo__item.is-in_progress { font-weight: 500; color: var(--ai-fg); }
.todo__check {
  flex-shrink: 0;
  margin-left: -22px;
  font-size: 12px;
  color: var(--ai-fg-muted);
}
.todo__item.is-completed .todo__check,
.todo__item.is-in_progress .todo__check { color: var(--ai-fg); }
.todo__content { flex: 1; min-width: 0; word-break: break-word; }
.todo__pri {
  flex-shrink: 0;
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 4px;
  background: var(--ai-hover);
}
.todo__pri.is-high { color: var(--ai-danger); }
.todo__pri.is-low { color: var(--ai-fg-muted); }
.todo__icon { color: var(--ai-fg-muted); }
.todo__icon--spin { display: inline-block; animation: todoSpin 1s linear infinite; }
@keyframes todoSpin { to { transform: rotate(360deg); } }

/* ========== Sub-agent (委派子任务) ========== */
.sub {
  margin: 8px 0;
  background: var(--ai-surface-1);
  border: 0.5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-card);
  overflow: hidden;
  min-width: 0;
  font-size: 12.5px;
}
.sub__head {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  min-width: 0;
  color: var(--ai-fg);
}
.sub__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--ai-fg-muted); flex-shrink: 0;
}
.sub__dot.is-completed { background: var(--ai-success, #16a34a); }
.sub__dot.is-running { background: var(--ai-accent); animation: subPulse 1.4s ease-in-out infinite; }
.sub__dot.is-error { background: var(--ai-danger); }
@keyframes subPulse { 50% { opacity: .35; } }
.sub__name { font-weight: 600; }
.sub__status {
  font-size: 10.5px; color: var(--ai-fg-muted);
  padding: 1px 6px; border-radius: 4px;
  background: var(--ai-hover);
  flex-shrink: 0;
}
.sub__id {
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px; color: var(--ai-fg-muted);
  opacity: .7;
}
.sub__prompt {
  padding: 0 10px 6px 26px;
  font-size: 11.5px; color: var(--ai-fg-muted);
  line-height: 1.5;
}
.sub__out {
  padding: 0 10px 8px 26px;
}
.sub__out > summary {
  font-size: 11.5px; color: var(--ai-fg-muted);
  cursor: pointer; user-select: none;
  padding: 2px 0;
}
.sub__out > pre {
  margin: 4px 0 0;
  font-size: 11.5px; color: var(--ai-fg);
  background: var(--ai-bg);
  padding: 6px 8px; border-radius: 6px;
  overflow-x: auto; white-space: pre-wrap;
}

/* ========== Reasoning (OpenCode style) ========== */
.reason {
  margin: 8px 0;
  background: var(--ai-surface-1);
  border: 0.5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-card);
  overflow: hidden;
  min-width: 0;
}
.reason__head {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--ai-fg-muted); font-family: inherit;
  font-size: 12.5px; text-align: left;
}
.reason__head:hover { background: var(--ai-input-bg); color: var(--ai-fg); }
.reason__icon {
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ai-fg-muted);
}
.reason__caret {
  margin-left: auto;
  color: var(--ai-fg-muted); font-size: 9px;
}
.reason__body {
  padding: 2px 10px 10px 30px;
}
.reason__body pre {
  margin: 0;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ai-fg-muted);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* Gate (logged out) */
.chat__gate {
  margin: auto; text-align: left;
  max-width: 340px; padding: 32px 20px;
  display: flex; flex-direction: column; gap: 14px;
  color: var(--ai-fg);
}
.chat__gate-logo {
  width: 64px; height: 64px; border-radius: 18px;
  background: var(--ai-metal-accent);
  color: var(--button-foreground, #fff);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 700;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 10px 28px color-mix(in srgb, var(--ai-accent) 40%, transparent);
  text-shadow: 0 1px 2px color-mix(in srgb, #000 30%, transparent);
}
.chat__gate-title { margin: 0; font-size: 19px; font-weight: 600; line-height: 1.4; color: var(--ai-fg); }
.chat__gate-brand {
  background: linear-gradient(135deg, var(--ai-accent), var(--ai-accent));
  -webkit-background-clip: text; background-clip: text; color: var(--ai-accent);
}
.chat__gate-features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.chat__gate-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: var(--ai-fg); line-height: 1.5; }
.chat__gate-features svg { color: var(--ai-fg); flex-shrink: 0; margin-top: 2px; }
.chat__gate-user {
  margin-top: 6px;
  font-size: 11.5px; color: var(--ai-fg-muted);
  padding-top: 12px; box-shadow: 0 -1px 0 var(--ai-divider);
}

/* Welcome */
.chat__welcome {
  margin: auto;
  text-align: center;
  max-width: 420px; padding: 32px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.chat__welcome-logo {
  width: 60px; height: 60px; border-radius: 18px;
  background: var(--ai-metal-accent);
  color: var(--ai-accent-fg); font-size: 28px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 10px 28px color-mix(in srgb, var(--ai-accent) 40%, transparent);
  text-shadow: 0 1px 2px color-mix(in srgb, #000 30%, transparent);
}
.chat__welcome-title { margin: 6px 0 0; font-size: 17px; font-weight: 600; color: var(--ai-fg); }
.chat__welcome-sub { margin: 0 0 12px; font-size: 12.5px; color: var(--ai-fg-muted); }
.chat__welcome-agents {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;
  margin-bottom: 12px;
}
.chat__agent-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 12px;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 10px;
  color: var(--ai-fg); font-family: inherit;
  cursor: pointer; text-align: left;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 2px 8px color-mix(in srgb, #000 16%, transparent);
  transition: background .12s, box-shadow .12s;
}
.chat__agent-card:hover { background: var(--ai-hover); }
.chat__agent-card.is-active {
  background: var(--ai-active);
  border-color: var(--ai-accent);
}
.chat__agent-card-icon { font-size: 16px; }
.chat__agent-card-name { font-size: 13px; font-weight: 600; }
.chat__agent-card-desc { font-size: 10.5px; color: var(--ai-fg-muted); line-height: 1.4; }

.chat__welcome-suggest {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;
}
.chat__suggest {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px;
  background: var(--ai-glass-bg);
  -webkit-backdrop-filter: var(--ai-glass-blur);
  backdrop-filter: var(--ai-glass-blur);
  border: none;
  border-radius: 10px;
  color: var(--ai-fg); font-family: inherit;
  cursor: pointer; text-align: left;
  box-shadow: 0 1px 0 var(--ai-metal-edge) inset, 0 2px 8px color-mix(in srgb, #000 16%, transparent);
}
.chat__suggest:hover { background: var(--ai-hover); }
.chat__suggest-icon { font-size: 16px; flex-shrink: 0; }
.chat__suggest-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.chat__suggest-title { font-size: 12px; font-weight: 500; }
.chat__suggest-desc { font-size: 10.5px; color: var(--ai-fg-muted); line-height: 1.4; }

/* ============================================================
   官方对齐 (opencode web v2): 无框触发行, 展开才有 hairline 盒
   颜色全部走 IDE 主题变量
   ============================================================ */

/* ---------- 消息行 (官方节奏: turn 分隔 24px, 同轮 user→assistant 12px, part 间距 24px) ---------- */
.oc-msg { display: flex; margin: 0; min-width: 0; }
.oc-msg.is-user { justify-content: flex-end; }
.oc-msg.is-assistant { justify-content: flex-start; }
.oc-msg__body { flex: 1; min-width: 0; }
/* 正文视觉: 官方消息正文 14px / 1.65 (markdown 全局 13 仅非对话场景保留) */
.oc-msg__body .chat-md__body { font-size: 14px; line-height: 1.65; }
/* 官方: 新一轮 (assistant→user) 间距 TurnGap h-6 = 24px */
.oc-msg.is-assistant + .oc-msg.is-user { margin-top: 24px; }
/* 同轮 user pill 与 assistant 回答间距 12px (官方 pt-3) */
.oc-msg.is-user + .oc-msg.is-assistant { margin-top: 12px; }
/* 连续 assistant 消息 (同一轮多个部分) 间距 24px (官方 text-part gap) */
.oc-msg.is-assistant + .oc-msg.is-assistant { margin-top: 24px; }
.oc-msg__user-col { display: flex; flex-direction: column; align-items: flex-end; max-width: 80%; min-width: 0; }
/* assistant 正文 block 垂直节奏: 对齐官方 text-part margin-top 24px */
.oc-msg__body > .chat-md { margin-top: 24px; }
.oc-msg__body > .chat-md:first-child { margin-top: 0; }
/* 工具/思考行与正文间隔 (官方 part 组节奏) */
.oc-msg__body > .oc-tool,
.oc-msg__body > .oc-reason,
.oc-msg__body > .oc-sub,
.oc-msg__body > .oc-msg__aborted { margin-top: 16px; }
.oc-msg__body > .oc-tool:first-child,
.oc-msg__body > .oc-reason:first-child,
.oc-msg__body > .oc-sub:first-child { margin-top: 0; }


/* 用户气泡: 截图同款, 圆角灰/强调底 */
.oc-msg__user-bubble {
  background: color-mix(in srgb, var(--ai-fg) 4%, var(--ai-bg-elev));
  border-radius: 12px;
  padding: 8px 13px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

/* hover 浮现操作行 */
.oc-msg__actions {
  display: flex; align-items: center; gap: 2px;
  margin-top: 3px; min-height: 22px;
  opacity: 0; pointer-events: none;
  transition: opacity .15s ease;
}
.oc-msg__user-col:hover .oc-msg__actions,
.oc-msg__body:hover .oc-msg__actions,
.oc-msg__actions:focus-within { opacity: 1; pointer-events: auto; }
.oc-icon-btn {
  width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 6px; color: var(--ai-fg-muted);
  cursor: pointer; padding: 0;
}
.oc-icon-btn:hover { background: var(--ai-hover); color: var(--ai-fg); }

/* assistant 底部 meta (官方 hover 浮现): 复制回复 + "Build · 模型 · 7.5秒" 13px 弱灰 */
.oc-msg__meta {
  display: flex; align-items: center;
  margin-top: 4px; min-height: 24px;
}
.oc-msg__meta-inner {
  display: flex; align-items: center; gap: 10px;
  opacity: 0; pointer-events: none;
  transition: opacity .15s ease;
}
.oc-msg__body:hover .oc-msg__meta-inner,
.oc-msg__meta-inner:focus-within { opacity: 1; pointer-events: auto; }
.oc-msg__meta-item {
  font-size: 12px; line-height: 1.5; color: var(--ai-fg-muted, #8f8f8f);
  user-select: none; white-space: nowrap;
}

/* 中断 / 等待 — 官方「思考中」shimmer 文本 (TextShimmer 同款效果) */
.oc-msg__aborted { color: var(--ai-fg-muted); font-style: italic; font-size: 12.5px; padding: 2px 0; }
/* 官方「问题已忽略」弱灰右对齐行 (question.reject 后) */
.oc-msg__qignored { width: 100%; display: flex; justify-content: flex-end; padding: 4px 0 2px; }
.oc-msg__qignored span { font-size: 13px; color: var(--ai-fg-muted); user-select: none; }
.oc-msg__waiting { display: inline-flex; align-items: center; padding: 6px 2px; }
.oc-msg__waiting-text {
  font-size: 14px; line-height: 1.4; font-weight: 450;
  background: linear-gradient(90deg, var(--ai-fg-muted) 0%, var(--ai-fg) 50%, var(--ai-fg-muted) 100%);
  background-size: 200% 100%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; animation: oc-shimmer 1.6s linear infinite;
}

/* ---------- 工具卡: 无框触发行 ---------- */
.oc-tool { width: 100%; min-width: 0; margin: 2px 0; }
.oc-tool__trigger {
  display: flex; align-items: center; gap: 6px;
  width: 100%; min-height: 22px;
  background: none; border: none; padding: 2px 0; margin: 0;
  text-align: left; cursor: pointer; color: inherit;
  font-family: inherit;
}
.oc-tool__trigger.is-static { cursor: default; }
.oc-tool__title {
  flex-shrink: 0; font-size: 14px; font-weight: 500; line-height: 1.5;
  color: var(--ai-fg); user-select: none;
}
.oc-tool.is-error .oc-tool__title { color: var(--ai-danger); }
.oc-tool__sep { flex-shrink: 0; font-size: 12px; color: var(--ai-fg-muted); user-select: none; }
.oc-tool__subtitle {
  min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--ai-fg-muted); user-select: none;
}
.oc-tool__dir { opacity: .7; }
.oc-tool__chevron {
  margin-left: 2px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; color: var(--ai-fg-muted); user-select: none;
}
.oc-tool__chevron svg { display: block; transition: transform .15s ease-out; }
.oc-tool__chevron.is-open svg { transform: rotate(180deg); }

/* 运行中 spinner (官方 indicator 16 槽) */
.oc-tool__spinner {
  flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%;
  border: 1.5px solid var(--ai-hairline-strong);
  border-top-color: var(--ai-fg);
  animation: oc-spin .7s linear infinite;
}
.oc-tool__indicator {
  flex-shrink: 0; width: 16px; height: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ai-fg-muted);
}
@keyframes oc-spin { to { transform: rotate(360deg); } }
.oc-tool__trigger.is-pending .oc-tool__title {
  background: linear-gradient(90deg, var(--ai-fg-muted) 0%, var(--ai-fg) 50%, var(--ai-fg-muted) 100%);
  background-size: 200% 100%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; animation: oc-shimmer 1.6s linear infinite;
}
@keyframes oc-shimmer { to { background-position: -200% 0; } }

/* 展开内容盒 (唯一有框的地方) */
.oc-tool__box, .oc-tool__error {
  position: relative; width: 100%; margin: 6px 0 8px;
  border: .5px solid var(--ai-hairline); border-radius: 8px;
  background: transparent; overflow: hidden;
}
.oc-tool__error { border-color: var(--ai-danger-border, var(--ai-danger)); }
.oc-tool__scroll {
  max-height: 240px; overflow: auto; padding: 10px 12px;
  scrollbar-width: thin;
}
.oc-tool__box .chat-md { padding: 10px 12px; }
.oc-tool__box .chat-md .chat-md__body pre {
  background: transparent !important; border: none !important; padding: 0 !important;
}
.oc-tool__pre {
  margin: 0; font-family: var(--monaco-monospace-font, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12.5px; line-height: 1.55; color: var(--ai-fg);
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.oc-tool__error .oc-tool__pre { color: var(--ai-danger); padding: 10px 12px; }
.oc-copy-ghost {
  position: absolute; top: 4px; right: 4px; z-index: 2;
  width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--ai-bg-elev) 80%, transparent);
  border: .5px solid var(--ai-hairline); border-radius: 6px;
  color: var(--ai-fg-muted); cursor: pointer; opacity: 0;
  transition: opacity .15s ease, color .15s ease;
}
.oc-tool__box:hover .oc-copy-ghost,
.oc-tool__box:focus-within .oc-copy-ghost,
.oc-tool__error:hover .oc-copy-ghost,
.oc-tool__error:focus-within .oc-copy-ghost { opacity: 1; }
.oc-copy-ghost:hover { color: var(--ai-fg); }

/* ---------- 思考: 无框折叠行 ---------- */
.oc-reason { width: 100%; min-width: 0; margin: 2px 0; }
.oc-reason__trigger {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: none; padding: 2px 0; margin: 0;
  cursor: pointer; color: var(--ai-fg-muted); font-family: inherit; font-size: 12.5px;
}
.oc-reason__trigger:hover { color: var(--ai-fg); }
.oc-reason__caret { display: inline-flex; margin-left: 2px; color: var(--ai-fg-muted); transition: transform .15s ease-out; }
.oc-reason__caret.is-open { transform: rotate(180deg); }
.oc-reason__body {
  margin: 4px 0 6px; padding-left: 4px;
  border-left: 2px solid var(--ai-hairline); padding-left: 10px;
  font-size: 12.5px; line-height: 1.6; color: var(--ai-fg-muted);
}
.oc-reason__body .chat-md__body { font-size: 12.5px; color: var(--ai-fg-muted); }
.oc-reason__body .chat-md__body strong,
.oc-reason__body .chat-md__body b { color: var(--ai-fg-muted); }

/* ---------- Todos: 无框行 + checkbox ---------- */
.oc-todo__list { display: flex; flex-direction: column; gap: 5px; margin: 6px 0 8px; }
.oc-todo__item { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.4; cursor: default; }
.oc-todo__box {
  flex-shrink: 0; width: 15px; height: 15px; margin-top: 1px;
  border: 1px solid var(--ai-hairline-strong); border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center; color: var(--ai-accent-fg, #fff);
}
.oc-todo__box[data-state="checked"] { background: var(--ai-accent); border-color: var(--ai-accent); }
.oc-todo__box[data-state="progress"] { border-color: var(--ai-accent); }
.oc-todo__bar { width: 7px; height: 7px; border-radius: 50%; background: var(--ai-accent); animation: oc-pulse 1s infinite ease-in-out; }
@keyframes oc-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
.oc-todo__content { color: var(--ai-fg); }
.oc-todo__item.is-completed .oc-todo__content { color: var(--ai-fg-muted); text-decoration: line-through; }
.oc-todo__item.is-cancelled .oc-todo__content { color: var(--ai-fg-muted); text-decoration: line-through; }

/* ---------- 子 Agent task 行 ---------- */
.oc-sub { width: 100%; min-width: 0; margin: 2px 0; }
.oc-sub__indicator {
  flex-shrink: 0; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--ai-accent);
}
.oc-sub__indicator.is-error { color: var(--ai-danger); }
.oc-sub__indicator.is-completed { color: var(--ai-fg-muted); }
.oc-sub__dots { display: inline-flex; gap: 2.5px; align-items: center; }
.oc-sub__dots span {
  width: 3.5px; height: 3.5px; border-radius: 50%; background: var(--ai-accent);
  animation: oc-sub-pulse 1.1s infinite ease-in-out;
}
.oc-sub__dots span:nth-child(2) { animation-delay: .15s; }
.oc-sub__dots span:nth-child(3) { animation-delay: .3s; }
@keyframes oc-sub-pulse { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }

/* ---------- 附件 ---------- */
.oc-att { display: flex; flex-wrap: wrap; gap: 8px; }
.oc-att--row { margin: 4px 0; }
.oc-att--user { justify-content: flex-end; }
.oc-att__img {
  max-width: 220px; max-height: 180px; border-radius: 8px;
  border: .5px solid var(--ai-hairline); object-fit: cover; cursor: pointer;
}
.oc-att__file {
  display: inline-flex; align-items: center; gap: 8px;
  max-width: 240px; padding: 8px 10px; border-radius: 8px;
  background: var(--ai-surface-1); border: .5px solid var(--ai-hairline);
  color: var(--ai-fg); text-decoration: none; font-size: 12.5px;
}
.oc-att__file:hover { background: var(--ai-surface-2); }
.oc-att__file-ic { flex-shrink: 0; display: inline-flex; color: var(--ai-fg-muted); }
.oc-att__file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 输入框附件: 官方 160px 卡 */
.oc-att-bar {
  display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px 0;
  scrollbar-width: none;
}
.oc-att-bar::-webkit-scrollbar { display: none; }
.oc-att-card {
  position: relative; flex: 0 0 auto; width: 132px; box-sizing: border-box;
  padding: 6px; border-radius: 8px; background: var(--ai-surface-1);
  box-shadow: inset 0 0 0 .5px var(--ai-hairline); cursor: default;
}
.oc-att-card__thumb {
  width: 100%; height: 74px; border-radius: 5px; object-fit: cover; display: block;
  background: var(--ai-surface-2);
}
.oc-att-card__ic {
  width: 100%; height: 74px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  color: var(--ai-fg-muted); background: var(--ai-surface-2);
}
.oc-att-card__name {
  display: block; margin-top: 5px; font-size: 11px; line-height: 13px;
  color: var(--ai-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.oc-att-card__x {
  position: absolute; top: 3px; right: 3px; width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; cursor: pointer;
  background: color-mix(in srgb, #000 55%, transparent); color: #fff;
}
.oc-att-card.is-uploading { opacity: .75; }
.oc-att-card__progress { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 3px; border-radius: 2px; background: var(--ai-hairline); overflow: hidden; }
.oc-att-card__progress-bar { display: block; height: 100%; background: var(--ai-accent); }

/* ---------- Followup dock ---------- */
.oc-followup {
  margin-bottom: 8px; border: .5px solid var(--ai-hairline);
  border-radius: var(--ai-radius-dock); background: var(--ai-bg-elev);
  overflow: hidden;
}
.oc-followup__tray {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 12px; background: none; border: none; cursor: pointer;
  color: var(--ai-fg-muted); font-family: inherit; font-size: 12.5px; text-align: left;
}
.oc-followup__tray:hover { background: var(--ai-hover); }
.oc-followup__count { font-weight: 600; color: var(--ai-fg); white-space: nowrap; }
.oc-followup__preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-followup__chevron { transition: transform .15s ease; flex-shrink: 0; }
.oc-followup.is-open .oc-followup__chevron { transform: rotate(180deg); }
.oc-followup__items { display: flex; flex-direction: column; gap: 4px; padding: 2px 8px 8px; }
.oc-followup__item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 8px; background: var(--ai-surface-1); min-width: 0;
}
.oc-followup__item.is-paused { opacity: .7; }
.oc-followup__item-text { flex: 1; min-width: 0; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-followup__send, .oc-followup__x {
  flex-shrink: 0; border: none; background: none; cursor: pointer;
  color: var(--ai-fg-muted); border-radius: 6px; padding: 3px; display: inline-flex;
}
.oc-followup__send:hover:not(:disabled), .oc-followup__x:hover { color: var(--ai-fg); background: var(--ai-hover); }
.oc-followup__send:disabled { opacity: .4; cursor: default; }

/* ---------- Question dock (输入框上方) — 官方 DockPrompt: DockShell + DockTray ---------- */
.oc-qd {
  position: relative; z-index: 70;
  margin-bottom: 8px;
  border-radius: 12px;
}
/* ============================================================
   Question dock (DockPrompt) — 结构抄官方 DockShell+DockTray,
   颜色全部主题变量推导 (明暗自适应), 不写死.
   语义层级 (官方 light 值作设计参照):
     shell #fff / tray #f8f8f8 / option #fafafa / ring ≈ #c1c0c0
   映射: 基准 --oc-bg=--ai-bg-elev, --oc-fg=--ai-fg,
    每级灰 = color-mix(fg N%, bg) → 浅色主题近官方, 深色主题自动反转.
   ============================================================ */
.oc-qd {
  --oc-bg: var(--ai-bg-elev, var(--editorWidget-background, #ffffff));
  --oc-fg: var(--ai-fg, #1f2328);
  --oc-muted: var(--ai-fg-muted, var(--descriptionForeground, #6e7681));
  --oc-strong: color-mix(in srgb, var(--oc-fg) 88%, #000000);
  --oc-hairline: color-mix(in srgb, var(--oc-fg) 12%, transparent);
  --oc-line: color-mix(in srgb, var(--oc-fg) 16%, var(--oc-bg));
  --oc-tray: color-mix(in srgb, var(--oc-fg) 3.5%, var(--oc-bg));
  --oc-opt: color-mix(in srgb, var(--oc-fg) 2.5%, var(--oc-bg));
  --oc-opt-hover: color-mix(in srgb, var(--oc-fg) 6%, var(--oc-bg));
  --oc-accent: var(--focusBorder, var(--button-background, #2563eb));
  --oc-accent-soft: color-mix(in srgb, var(--oc-accent) 9%, var(--oc-bg));
  --oc-accent-fg: var(--button-foreground, #ffffff);
  position: relative; z-index: 70;
  margin-bottom: 8px;
  border-radius: 12px;
}
.oc-qd__shell {
  position: relative; z-index: 10;
  background: var(--oc-bg);
  border-radius: 12px; overflow: clip;
  padding: 12px 12px 0;
  box-shadow:
    0 0 0 1px var(--oc-hairline),
    0 1px 2px -1px rgba(19, 16, 16, 0.04),
    0 1px 2px 0 rgba(19, 16, 16, 0.06),
    0 12px 28px rgba(19, 16, 16, 0.09);
}
.oc-qd__header { display: flex; align-items: center; gap: 12px; min-height: 26px; padding: 4px 12px 16px; }
.oc-qd__title { font-size: 14px; font-weight: 600; color: var(--oc-strong); min-width: 0; white-space: nowrap; }
.oc-qd__header-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.oc-qd__progress { display: flex; gap: 4px; }
.oc-qd__seg {
  width: 18px; height: 4px; padding: 0; border: none; border-radius: 2px;
  background: var(--oc-line); cursor: pointer;
}
.oc-qd__seg[data-active] { background: var(--oc-accent); }
.oc-qd__seg[data-answered]:not([data-active]) { background: var(--oc-fg); opacity: .5; }
.oc-qd__hint { font-size: 13px; line-height: 1.5; color: var(--oc-muted); padding: 8px 12px 20px; }
.oc-qd__options { display: flex; flex-direction: column; gap: 10px; padding: 0 4px; }
.oc-qd__option {
  display: flex; align-items: flex-start; gap: 9px; width: 100%;
  padding: 12px 12px 12px 14px; border-radius: 8px;
  border: .5px solid var(--oc-line);
  background: var(--oc-opt);
  cursor: pointer; text-align: left; font-family: inherit; color: var(--oc-strong);
  font-size: 13px; line-height: 1.45;
  transition: background .1s ease, border-color .1s ease;
}
.oc-qd__option:hover { background: var(--oc-opt-hover); }
.oc-qd__option[data-picked] { border-color: var(--oc-accent); background: var(--oc-accent-soft); }
.oc-qd__option:disabled { opacity: .55; cursor: default; }
.oc-qd-check { flex-shrink: 0; margin-top: 3px; display: inline-flex; }
.oc-qd-box {
  width: 16px; height: 16px; border-radius: 999px;
  border: .5px solid color-mix(in srgb, var(--oc-fg) 22%, transparent);
  background: var(--oc-bg);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--oc-accent-fg);
  box-sizing: border-box;
  transition: background .1s ease, border-color .1s ease;
}
.oc-qd-box[data-type="checkbox"] { border-radius: 5px; }
.oc-qd-box[data-picked] { background: var(--oc-accent); border-color: var(--oc-accent); }
.oc-qd-dot { width: 6px; height: 6px; border-radius: 999px; background: transparent; }
.oc-qd-box[data-picked] .oc-qd-dot { background: var(--oc-accent-fg); }
.oc-qd__option-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.oc-qd__label { font-size: 13px; color: var(--oc-strong); user-select: none; }
.oc-qd__desc { font-size: 12px; color: var(--oc-muted); line-height: 1.4; }
.oc-qd__custom textarea {
  flex: 1; min-width: 0; background: transparent; border: none; outline: none;
  color: var(--oc-strong); font-family: inherit; font-size: 13px; padding: 0; resize: none;
  line-height: 1.45;
}
.oc-qd__custom textarea::placeholder { color: var(--oc-muted); }
/* DockTray: footer 按钮行 — 与 shell 交叠 (官方 -24px / 上 32px 垫高) */
.oc-qd__tray {
  position: relative; z-index: 0;
  margin-top: -24px;
  padding: 36px 12px 12px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  border-radius: 12px;
  background: var(--oc-tray);
  border: 1px solid var(--oc-line);
}
.oc-qd__footer-actions { display: flex; gap: 8px; margin-left: auto; }
.oc-qd__btn {
  height: 32px; padding: 6px 12px; border-radius: 6px;
  font-size: 13px; font-family: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: none; color: var(--oc-strong);
  transition: background .1s ease;
}
.oc-qd__btn--ghost { color: var(--oc-strong); }
.oc-qd__btn--ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--oc-fg) 7%, transparent); }
.oc-qd__btn--secondary {
  border: 1px solid var(--oc-line); background: var(--oc-bg); color: var(--oc-strong);
}
.oc-qd__btn--secondary:hover:not(:disabled) { background: var(--oc-opt-hover); }
.oc-qd__btn--primary {
  background: var(--button-background, var(--oc-accent)); color: var(--button-foreground, var(--oc-accent-fg));
  border: 1px solid var(--oc-line); font-weight: 600;
}
.oc-qd__btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
.oc-qd__btn:disabled { opacity: .5; cursor: default; }

/* 已回答提问摘要 (消息流内) */
.oc-qanswers { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 8px; }
.oc-qanswers__item {
  border: .5px solid var(--ai-hairline); border-radius: 8px; padding: 8px 10px;
  background: var(--ai-surface-1);
}
.oc-qanswers__q { font-size: 12.5px; color: var(--ai-fg); margin-bottom: 3px; }
.oc-qanswers__a { font-size: 12.5px; color: var(--ai-fg-muted); }


/* Permission dock (官方 kind=permission): pattern 代码行 */
.oc-qd--permission .oc-qd__hint { padding: 8px 10px 10px; }
.oc-perm__patterns { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 10px 8px; }
.oc-perm__pattern {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; line-height: 1.5;
  background: color-mix(in srgb, var(--oc-fg, #333) 6%, var(--oc-bg, #fff));
  color: var(--oc-strong, inherit);
  border: .5px solid var(--oc-line, rgba(0,0,0,.1));
  border-radius: 6px;
  padding: 2px 8px;
  word-break: break-all;
}


/* todo 行图标 (官方 checklist 图标位) */
.oc-todo__icon {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  color: var(--oc-muted, var(--ai-fg-muted)); margin-right: 2px;
}


/* 用户消息底部 (官方 user-message-copy-wrapper): meta + actions 整行 hover 浮现 */
.oc-msg__user-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  width: 100%; margin-top: 4px; min-height: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity .15s ease;
}
.oc-msg__user-col:hover .oc-msg__user-foot,
.oc-msg__user-foot:focus-within { opacity: 1; pointer-events: auto; }
.oc-msg__user-meta {
  font-size: 13px; line-height: 20px; color: var(--ai-fg-muted, #8f8f8f);
  white-space: nowrap; user-select: none;
  flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  text-align: end; margin-right: 2px;
}
.oc-msg__user-foot .oc-msg__actions { margin-top: 0; }


`;
export {};
