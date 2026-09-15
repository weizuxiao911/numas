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
    </div>
  );
};
