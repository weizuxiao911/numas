/**
 * Markdown 渲染管线 — 复刻 Trae/VS Code markdown 预览的渲染栈
 *
 *   marked (GFM) + marked-shiki (shiki 双主题代码高亮) + marked-katex-extension (数学)
 *   mermaid 代码块: 高亮阶段输出占位 div, 组件侧动态 import mermaid 渲染 (避免主包体积)
 *
 * 与 chatbot 的 Markdown.tsx 同一套栈 (marked 7 + markedShiki + shiki), 但预览场景:
 *   - 不做行数截断/复制按钮 (那是聊天消息的场景)
 *   - 支持 mermaid / katex
 */
import { marked } from 'marked';
import { codeToHtml } from 'shiki';
import markedShiki from 'marked-shiki';
import markedKatex from 'marked-katex-extension';

export const MERMAID_BLOCK_CLASS = 'md-preview__mermaid';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const pipeline = marked.use(
  {
    gfm: true,
    renderer: {
      // marked 7 renderer 为旧式签名 (href, title, text); 链接统一新窗口打开
      link(href: string, title: string | null | undefined, text: string) {
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      },
    },
  },
  markedKatex({ throwOnError: false, nonStandard: true }),
  markedShiki({
    highlight(code: string, lang: string) {
      const language = String(lang || 'text').replace(/[^a-zA-Z0-9#+._-]/g, '') || 'text';
      return codeToHtml(code, {
        lang: language,
        themes: { light: 'github-light', dark: 'github-dark' },
      }).then((html) => (language === 'text' ? html : html.replace('<pre ', `<pre data-lang="${language}" `)));
    },
  }),
);

/** markdown 源码 → HTML (含代码高亮; mermaid 块由 renderMermaidBlocks 后处理) */
export async function renderMarkdown(source: string): Promise<string> {
  const out = pipeline.parse(source) as string | Promise<string>;
  return typeof out === 'string' ? out : await out;
}

let mermaidSeq = 0;

/** 渲染容器内 mermaid 代码块 (pre[data-lang=mermaid] → svg; 动态加载 mermaid, 失败降级为错误文本) */
export async function renderMermaidBlocks(container: HTMLElement, dark: boolean): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre[data-lang="mermaid"]'));
  if (!blocks.length) return;
  let mermaid: any;
  try {
    // @ts-ignore tsconfig module=ES2015 不支持 dynamic import 类型; webpack 侧正常切 chunk
    mermaid = (await import('mermaid')).default;
  } catch (e: any) {
    for (const pre of blocks) pre.textContent = `mermaid 加载失败: ${e?.message || e}`;
    return;
  }
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: dark ? 'dark' : 'default' });
  for (const pre of blocks) {
    const src = pre.textContent || '';
    if (!src.trim()) continue;
    const holder = document.createElement('div');
    holder.className = MERMAID_BLOCK_CLASS;
    try {
      const { svg } = await mermaid.render(`md-mermaid-${Date.now()}-${mermaidSeq++}`, src);
      holder.innerHTML = svg;
    } catch (e: any) {
      holder.innerHTML = `<pre class="md-preview__mermaid-error">mermaid 渲染失败: ${escapeHtml(String(e?.message || e))}</pre>`;
    }
    pre.replaceWith(holder);
  }
}
