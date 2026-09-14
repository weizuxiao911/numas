import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import markedShiki from 'marked-shiki';

// shiki 懒加载: 首次渲染代码块时才拉取 (含 ~3MB oniguruma wasm), 不拖启动
let shikiModule: Promise<typeof import('shiki')> | null = null;
const loadShiki = (): Promise<typeof import('shiki')> => (shikiModule ??= import('shiki'));

/**
 * Markdown 渲染 — 对齐官方 packages/web content-markdown.tsx 实现
 *
 * 管线:
 *   marked 7 + markedShiki 插件 (shiki codeToHtml 双主题高亮)
 *   - link 自动 target=_blank rel=noopener noreferrer
 *   - strip(): 剥离首尾 <tag>...</tag> wrapper (如 <text>)
 *   - 溢出折叠: 默认 3 行截断 (line-clamp) + "显示更多/收起" 按钮
 *   - 右上角复制按钮
 */

const markedWithShiki = marked.use(
  {
    renderer: {
      // marked 7 renderer 为旧式签名 (href, title, text); 早期按 v9+ token 解构导致链接渲染成 undefined
      link(href: string, title: string | null | undefined, text: string) {
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      },
    },
  },
  markedShiki({
    highlight(code: string, lang: string) {
      const language = String(lang || 'text').replace(/[^a-zA-Z0-9#+._-]/g, '') || 'text';
      return loadShiki()
        .then(({ codeToHtml }) => codeToHtml(code, {
          lang: language,
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        }))
        .then((html) => (
          // 注入 data-lang: CSS 在 macOS 窗口风标题栏里展示语言标签 (text 不标)
          language === 'text' ? html : html.replace('<pre ', `<pre data-lang="${language}" `)
        ));
    },
  }),
);

function strip(text: string): string {
  const wrappedRe = /^\s*<([A-Za-z]\w*)>\s*([\s\S]*?)\s*<\/\1>\s*$/;
  const match = text.match(wrappedRe);
  return match ? match[2] : text;
}

export const Markdown: React.FC<{ content: string; streaming?: boolean; expand?: boolean }> = ({
  content,
  streaming,
}) => {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      Promise.resolve(markedWithShiki.parse(strip(content || '')))
        .then((h: string) => { if (!cancelled) setHtml(h); })
        .catch(() => { if (!cancelled) setHtml(String(content || '')); });
    };
    // 流式中防抖 120ms: 避免每个 token 触发一次全量 parse + 代码高亮 (长消息/代码块卡顿根源)
    if (streaming) {
      const t = setTimeout(run, 120);
      return () => { cancelled = true; clearTimeout(t); };
    }
    run();
    return () => { cancelled = true; };
  }, [content, streaming]);

  return (
    <div className={`chat-md${streaming ? ' chat-md--streaming' : ''}`}>
      <div className="chat-md__body" dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .chat-md { position: relative; }
        .chat-md__body {
          font-size: 13px;
          line-height: 1.6;
          color: var(--editor-foreground, var(--vscode-editor-foreground));
          word-break: break-word;
        }
        .chat-md__body p, .chat-md__body blockquote, .chat-md__body ul, .chat-md__body ol,
        .chat-md__body dl, .chat-md__body table, .chat-md__body pre { margin-bottom: 0.75rem; }
        .chat-md__body ul, .chat-md__body ol { padding-left: 1.4rem; margin-bottom: 0.5rem; }
        .chat-md__body ol > li { margin-bottom: 0.35rem; }
        .chat-md__body li ul, .chat-md__body li ol { margin-top: 0.2rem; margin-bottom: 0; }
        .chat-md__body h1, .chat-md__body h2, .chat-md__body h3, .chat-md__body h4,
        .chat-md__body h5, .chat-md__body h6 {
          font-size: 1em; font-weight: 600; margin-bottom: 0.5rem;
          color: var(--editor-foreground, var(--vscode-editor-foreground)) !important;
        }
        .chat-md__body > *:last-child { margin-bottom: 0; }
        .chat-md__body pre {
          /* 无背景色: 代码区透出消息底色 (只保留 macOS 窗口标题栏 + 边框) */
          --shiki-dark-bg: transparent !important;
          background: transparent !important;
          color: var(--editor-foreground, var(--vscode-editor-foreground));
          border: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(255,255,255,0.06)));
          border-radius: 10px;
          padding: 36px 0.75rem 0.7rem;
          line-height: 1.6;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-x: auto;
          position: relative;
        }
        /* macOS 窗口风: 顶部标题栏 (三色交通灯) + 居中语言标签 */
        .chat-md__body pre::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 28px;
          border-bottom: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(255,255,255,0.06)));
          border-radius: 10px 10px 0 0;
          background:
            radial-gradient(circle at 13px 14px, #ff5f56 4.5px, transparent 4.6px),
            radial-gradient(circle at 29px 14px, #ffbd2e 4.5px, transparent 4.6px),
            radial-gradient(circle at 45px 14px, #27c93f 4.5px, transparent 4.6px),
            color-mix(in srgb, var(--editor-foreground, #ffffff) 7%, var(--editor-background, #1e1e1e));
          pointer-events: none;
        }
        .chat-md__body pre::after {
          content: attr(data-lang);
          position: absolute; top: 5px; left: 50%; transform: translateX(-50%);
          height: 18px; line-height: 18px;
          font-size: 11px; letter-spacing: 0.02em;
          color: var(--descriptionForeground, var(--vscode-descriptionForeground, #9ca3af));
          user-select: none; pointer-events: none;
        }
        .design-dark .chat-md__body pre,
        .design-dark .chat-md__body pre span {
          color: var(--shiki-dark) !important;
          background-color: var(--shiki-dark-bg) !important;
        }
        .chat-md__body pre code { background: transparent !important; }
        .chat-md__body code { font-weight: 500; }
        .chat-md__body :not(pre) > code {
          background: var(--textCodeBlock-background, rgba(255,255,255,0.07));
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.92em;
        }
        .chat-md__body table { border-collapse: collapse; width: 100%; }
        .chat-md__body th, .chat-md__body td {
          border: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(255,255,255,0.08)));
          padding: 0.4rem 0.6rem;
          text-align: left;
        }
        .chat-md__body th { border-bottom: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(255,255,255,0.12))); font-weight: 600; }
        .chat-md__body blockquote {
          border-left: 3px solid var(--panel-border, var(--vscode-panel-border, rgba(255,255,255,0.15)));
          padding-left: 0.75rem;
          color: var(--descriptionForeground, var(--vscode-descriptionForeground));
        }
        .chat-md__body a { color: var(--textLink-foreground, var(--vscode-textLink-foreground, var(--button-background))); text-decoration: none; }
        .chat-md__body a:hover { text-decoration: underline; }
        /* 流式输出: 内容淡入 (无末尾闪烁光标) */
        .chat-md--streaming .chat-md__body {
          animation: chat-md-fade .18s ease-out;
        }
        @keyframes chat-md-fade {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
