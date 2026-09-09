import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Markdown } from './Markdown';

function safeStringify(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function contentToText(content: any): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  return content
    .map((c: any) => {
      if (!c) return '';
      if (typeof c === 'string') return c;
      if (c.type === 'text' && typeof c.text === 'string') return c.text;
      if (c.type === 'file') return `[file] ${c.name || c.uri || ''} (${c.mime || ''})`;
      return safeStringify(c);
    })
    .filter(Boolean)
    .join('\n');
}

function pickOutStr(state: any): string {
  if (!state) return '';
  const direct = state.output;
  if (direct != null && direct !== '') return safeStringify(direct);
  const fromContent = contentToText(state.content);
  if (fromContent) return fromContent;
  if (state.result != null) return safeStringify(state.result);
  return '';
}

function pickErrStr(state: any): string {
  const e = state?.error;
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (e?.message) return String(e.message);
  return safeStringify(e);
}

function basename(p: string): string {
  if (!p) return '';
  const parts = String(p).split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}
function dirname(p: string): string {
  const s = String(p);
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i > 0 ? s.slice(0, i) : '';
}

interface ToolMeta {
  title: string;
  subtitle?: string;
  /** 输出渲染方式 */
  kind: 'shell' | 'markdown' | 'raw' | 'none';
  /** shell 命令 */
  command?: string;
}

function describe(tool: string, state: any): ToolMeta {
  const input = state?.input || {};
  switch (tool) {
    case 'bash':
    case 'shell':
      return { title: 'Shell', command: input.command ?? state?.metadata?.command ?? '', kind: 'shell' };
    case 'read':
      return { title: 'Read', subtitle: input.filePath ? basename(input.filePath) : '', kind: 'markdown' };
    case 'write':
      return { title: 'Write', subtitle: input.filePath ? basename(input.filePath) : '', kind: 'none' };
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return { title: 'Edit', subtitle: input.filePath ? basename(input.filePath) : '', kind: 'none' };
    case 'list':
    case 'ls':
      return { title: 'List', subtitle: dirname(input.path || '/') || '/', kind: 'markdown' };
    case 'glob':
      return { title: 'Glob', subtitle: dirname(input.path || '/') || '/', kind: 'markdown' };
    case 'grep':
      return { title: 'Grep', subtitle: input.pattern ? String(input.pattern) : '', kind: 'markdown' };
    case 'webfetch':
      return { title: 'Fetch', subtitle: input.url ? String(input.url) : '', kind: 'markdown' };
    case 'websearch':
      return { title: 'Search', subtitle: input.query ? String(input.query) : '', kind: 'markdown' };
    default:
      return { title: tool.charAt(0).toUpperCase() + tool.slice(1), kind: 'raw' };
  }
}

function CopyGhost({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="oc-copy-ghost"
      title={copied ? '已复制' : '复制'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        try {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`oc-tool__chevron${open ? ' is-open' : ''}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    </span>
  );
}

/** 官方 BasicTool icon 槽: 16x16 服务工具图标 (官方 icon set 子集) */
const TOOL_ICONS: Record<string, React.ReactNode> = {
  read: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>,
  list: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  glob: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>,
  grep: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  bash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
  write: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>,
  webfetch: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>,
  websearch: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8a3 3 0 0 0-3 3" /></svg>,
  task: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
};

function ToolIcon({ tool }: { tool: string }) {
  const key = String(tool || '').toLowerCase();
  return (
    <span className="oc-tool__indicator" aria-hidden>
      {TOOL_ICONS[key] || (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      )}
    </span>
  );
}

/**
 * 官方 opencode 工具卡: 无边框触发行 (标题 · 副标题), 完成后才出现 chevron,
 * 点击展开 hairline 内容盒. 运行中 shimmer 不可展开 (Shell 例外).
 */
export const ToolView: React.FC<{ part: any; done?: boolean }> = ({ part, done }) => {
  const tool: string = part?.tool || 'tool';
  const status: string = part?.state?.status || 'pending';
  const state = part?.state;

  const pending = status === 'pending' || status === 'running';
  const isError = status === 'error';
  const meta = useMemo(() => describe(tool, state), [tool, state]);

  const outStr = useMemo(() => pickOutStr(state), [state]);
  const errStr = useMemo(() => pickErrStr(state), [state]);
  const inputStr = useMemo(() => safeStringify(state?.input), [state]);

  // 默认折叠 (含 shell). 错误强制展开.
  const [open, setOpen] = useState(false);
  const forceOpenedRef = useRef(false);
  useEffect(() => {
    if (isError && !forceOpenedRef.current) { setOpen(true); forceOpenedRef.current = true; }
  }, [isError]);

  // 可展开: 非运行中 且 有内容
  const shellText = meta.kind === 'shell'
    ? `$ ${meta.command || ''}${outStr ? `\n\n${outStr}` : ''}`
    : '';
  const hasContent = isError
    ? !!errStr
    : meta.kind === 'shell'
      ? !!(meta.command || outStr)
      : meta.kind === 'markdown'
        ? !!outStr
        : meta.kind === 'raw'
          ? !!(outStr || inputStr)
          : false;
  const canExpand = !pending && hasContent;

  const dir = meta.subtitle && meta.subtitle.includes('/') ? dirname(meta.subtitle) : '';
  const file = meta.subtitle && meta.subtitle.includes('/') ? basename(meta.subtitle) : meta.subtitle;

  return (
    <div className={`oc-tool${isError ? ' is-error' : ''}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`oc-tool__trigger${canExpand ? '' : ' is-static'}${pending ? ' is-pending' : ''}`}
        onClick={() => canExpand && setOpen((v) => !v)}
      >
        {pending ? (
          <span className="oc-tool__spinner" />
        ) : (
          <ToolIcon tool={tool} />
        )}
        <span className="oc-tool__title">{meta.title}</span>
        {meta.subtitle && (
          <>
            <span className="oc-tool__sep">·</span>
            <span className="oc-tool__subtitle" title={meta.subtitle}>
              {dir && <span className="oc-tool__dir">{dir}/</span>}
              {file}
            </span>
          </>
        )}
        {canExpand && <Chevron open={open} />}
      </button>

      {canExpand && open && (
        isError ? (
          <div className="oc-tool__error">
            <CopyGhost text={errStr} />
            <pre className="oc-tool__pre">{errStr}</pre>
          </div>
        ) : meta.kind === 'shell' ? (
          <div className="oc-tool__box" dir="ltr">
            <CopyGhost text={shellText} />
            <div className="oc-tool__scroll">
              <pre className="oc-tool__pre oc-tool__pre--shell">
                <code>{shellText}</code>
              </pre>
            </div>
          </div>
        ) : meta.kind === 'markdown' ? (
          <div className="oc-tool__box">
            <CopyGhost text={outStr} />
            <div className="oc-tool__scroll">
              <Markdown content={outStr} />
            </div>
          </div>
        ) : (
          <div className="oc-tool__box" dir="ltr">
            <CopyGhost text={outStr || inputStr} />
            <div className="oc-tool__scroll">
              <pre className="oc-tool__pre">{outStr || inputStr}</pre>
            </div>
          </div>
        )
      )}
    </div>
  );
};
