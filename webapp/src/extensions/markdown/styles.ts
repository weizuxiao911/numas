/**
 * Markdown 预览样式 — 文档级排版 (标题分级/表格/代码块/引用), 主题变量自适应
 */
export const styles = `
.md-preview {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--editor-background, var(--vscode-editor-background, #fff));
  color: var(--editor-foreground, var(--vscode-editor-foreground, #1f2328));
  overflow: hidden;
}
.md-preview__body {
  flex: 1; min-height: 0;
  overflow: auto;
  padding: 20px 28px 40px;
  font-size: 14px; line-height: 1.7;
  word-break: break-word;
}
.md-preview__error {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: var(--errorForeground, #e5484d); font-size: 13px;
}
.md-preview__body > *:first-child { margin-top: 0; }
.md-preview__body h1, .md-preview__body h2, .md-preview__body h3,
.md-preview__body h4, .md-preview__body h5, .md-preview__body h6 {
  font-weight: 600; line-height: 1.3;
  margin: 1.4em 0 0.6em;
}
.md-preview__body h1 { font-size: 1.8em; border-bottom: 1px solid var(--panel-border, rgba(0,0,0,.1)); padding-bottom: 0.3em; }
.md-preview__body h2 { font-size: 1.45em; border-bottom: 1px solid var(--panel-border, rgba(0,0,0,.1)); padding-bottom: 0.25em; }
.md-preview__body h3 { font-size: 1.2em; }
.md-preview__body h4 { font-size: 1.05em; }
.md-preview__body p, .md-preview__body blockquote, .md-preview__body ul,
.md-preview__body ol, .md-preview__body table, .md-preview__body pre { margin: 0 0 0.9em; }
.md-preview__body ul, .md-preview__body ol { padding-left: 1.6em; }
.md-preview__body li { margin: 0.25em 0; }
.md-preview__body a { color: var(--textLink-foreground, var(--vscode-textLink-foreground, #2563eb)); text-decoration: none; }
.md-preview__body a:hover { text-decoration: underline; }
.md-preview__body blockquote {
  padding: 0.4em 1em;
  border-left: 3px solid var(--panel-border, rgba(0,0,0,.15));
  color: var(--descriptionForeground, #6b7280);
  background: color-mix(in srgb, currentColor 4%, transparent);
  border-radius: 0 6px 6px 0;
}
.md-preview__body hr { border: none; border-top: 1px solid var(--panel-border, rgba(0,0,0,.12)); margin: 1.6em 0; }
.md-preview__body table { border-collapse: collapse; display: block; overflow-x: auto; }
.md-preview__body th, .md-preview__body td {
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  padding: 6px 12px; text-align: left;
}
.md-preview__body th { background: color-mix(in srgb, currentColor 5%, transparent); font-weight: 600; }
.md-preview__body img { max-width: 100%; border-radius: 6px; }
.md-preview__body code { font-family: var(--monaco-monospace-font, ui-monospace, SFMono-Regular, Menlo, monospace); font-weight: 500; }
.md-preview__body :not(pre) > code {
  background: var(--textCodeBlock-background, rgba(128,128,128,.15));
  border-radius: 4px; padding: 1px 5px; font-size: 0.9em;
}
/* 代码块: macOS 窗口风 (与 chatbot 一致) + shiki 双主题 */
.md-preview__body pre {
  --shiki-dark-bg: transparent !important;
  background: color-mix(in srgb, currentColor 4%, transparent) !important;
  color: var(--editor-foreground, #1f2328);
  border: 1px solid var(--panel-border, rgba(0,0,0,.1));
  border-radius: 10px;
  padding: 36px 0.9rem 0.8rem;
  line-height: 1.6; font-size: 12.5px;
  overflow-x: auto;
  position: relative;
}
.md-preview__body pre::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 28px;
  border-bottom: 1px solid var(--panel-border, rgba(0,0,0,.1));
  border-radius: 10px 10px 0 0;
  background:
    radial-gradient(circle at 13px 14px, #ff5f56 4.5px, transparent 4.6px),
    radial-gradient(circle at 29px 14px, #ffbd2e 4.5px, transparent 4.6px),
    radial-gradient(circle at 45px 14px, #27c93f 4.5px, transparent 4.6px),
    color-mix(in srgb, var(--editor-foreground, #1f2328) 7%, transparent);
  pointer-events: none;
}
.md-preview__body pre::after {
  content: attr(data-lang);
  position: absolute; top: 5px; left: 50%; transform: translateX(-50%);
  height: 18px; line-height: 18px; font-size: 11px;
  color: var(--descriptionForeground, #8f8f8f);
  user-select: none; pointer-events: none;
}
.design-dark .md-preview__body pre,
.design-dark .md-preview__body pre span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}
.md-preview__body pre code { background: transparent !important; }
/* 数学 (katex) */
.md-preview__body .katex-display { overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
/* mermaid */
.md-preview__mermaid { display: flex; justify-content: center; margin: 0 0 0.9em; }
.md-preview__mermaid svg { max-width: 100%; height: auto; }
.md-preview__mermaid-pending { color: var(--descriptionForeground, #8f8f8f); font-size: 12px; }
.md-preview__mermaid-error { color: var(--errorForeground, #e5484d); font-size: 12px; }
`;
