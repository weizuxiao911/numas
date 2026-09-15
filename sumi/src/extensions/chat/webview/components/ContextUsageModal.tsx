/**
 * ContextUsageModal — 上下文用量弹层 (对齐 chat 模型选择 modal 风格)
 *
 * 数据源: 从 `GET /session/{id}/message` 拿完整消息, server 实际报的 `info.tokens`
 *   (含 subagent + cache.read); 5 分类 (系统/工具/对话/MCP/技能) 前端估算 (chars/3).
 *
 * 触发: stats bar 底部 tokens 文本点击. 视觉/框架跟 numas 自有的 chat__modal-* 一致
 * (跟 ModelPicker 同款, 用 chat__modal-overlay + chat__modal). ESC + 点击 overlay 关闭.
 */
import React, { useEffect, useState } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';

interface ContextUsage {
  /** 各分类估算 (chars/3) */
  system: number;
  toolsAndAgents: number;
  messages: number;
  connectors: number;
  skills: number;
  /** server 实际报的 last assistant tokens (含 subagent + cache) */
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  /** 消息计数 */
  userMsgCount: number;
  assistantMsgCount: number;
  /** 总用量 (= input + cacheRead; 跟官方 app SessionContextUsage 同口径) */
  total: number;
  limit: number;
}

function est(s: string | undefined | null): number {
  return Math.ceil((s || '').length / 3);
}

function partText(p: any): string {
  if (!p) return '';
  if (typeof p.text === 'string') return p.text;
  if (p.type === 'tool') {
    return [p.tool || '', JSON.stringify(p.state?.input || ''), JSON.stringify(p.state?.output || '')].join(' ');
  }
  if (p.type === 'reasoning') return typeof p.text === 'string' ? p.text : '';
  if (p.type === 'agent' || p.type === 'subtask' || p.type === 'skill') {
    return JSON.stringify(p);
  }
  if (p.type === 'file') return p.url || p.path || '';
  return JSON.stringify(p || '').slice(0, 200);
}

async function fetchEndpoint(baseUrl: string, path: string): Promise<any> {
  const url = baseUrl + path;
  const r = await fetch(url, {
    headers: { 'x-opencode-directory': encodeURI(window.__APP_OPENCODE_RUNTIME__?.cwd || '') },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function computeContextUsage(baseUrl: string, sessionID: string, modelLimit: number): Promise<ContextUsage> {
  const empty: ContextUsage = {
    system: 0, toolsAndAgents: 0, messages: 0, connectors: 0, skills: 0,
    input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0,
    userMsgCount: 0, assistantMsgCount: 0,
    total: 0, limit: modelLimit,
  };
  if (!baseUrl || !sessionID) return empty;
  const messages = await fetchEndpoint(baseUrl, '/session/' + encodeURIComponent(sessionID) + '/message');
  if (!Array.isArray(messages)) return empty;

  // V1 端点不返回 system; 经验值 8000 (跟 Claude/GPT 实际 system prompt 字符数近似)
  const system = 8000;

  let toolAgentText = '';
  let skillsText = '';
  let msgText = '';
  let userMsgCount = 0;
  let assistantMsgCount = 0;
  for (const m of messages) {
    const role = m?.info?.role || m?.role;
    if (role === 'user') userMsgCount++;
    if (role === 'assistant') assistantMsgCount++;
    for (const p of m?.parts || []) {
      if (p?.type === 'tool') {
        const tn = String(p.tool || '').toLowerCase();
        if (tn === 'task') toolAgentText += partText(p); // subagent
        else if (tn === 'skill') skillsText += partText(p);
        else toolAgentText += partText(p);
      } else if (p?.type === 'agent' || p?.type === 'subtask') {
        toolAgentText += partText(p);
      } else if (p?.type === 'skill') {
        skillsText += partText(p);
      } else if ((role === 'user' || role === 'assistant') && (p?.type === 'text' || p?.type === 'reasoning')) {
        msgText += partText(p);
      }
    }
  }
  const toolsAndAgents = est(toolAgentText);
  const messages_tokens = est(msgText);
  const skills = est(skillsText);
  const connectors = 0;

  const last = messages[messages.length - 1];
  const t = last?.info?.tokens || {};
  const input = t.input || 0;
  const output = t.output || 0;
  const reasoning = t.reasoning || 0;
  const cacheRead = t.cache?.read || 0;
  const cacheWrite = t.cache?.write || 0;
  const total = input + cacheRead;

  return {
    system, toolsAndAgents, messages: messages_tokens, connectors, skills,
    input, output, reasoning, cacheRead, cacheWrite,
    userMsgCount, assistantMsgCount,
    total, limit: modelLimit,
  };
}

async function fetchModelLimit(baseUrl: string, providerID: string, modelID: string): Promise<number> {
  const FALLBACK = 200000;
  if (!baseUrl || !providerID || !modelID) return FALLBACK;
  try {
    const cfg = await fetchEndpoint(baseUrl, '/config');
    const n = cfg?.provider?.[providerID]?.models?.[modelID]?.limit?.context;
    if (typeof n === 'number' && n > 0) return n;
  } catch { /* ignore */ }
  return FALLBACK;
}

const fmtTok = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toLocaleString()}`;
};

interface Category {
  key: keyof Omit<ContextUsage, 'total' | 'limit' | 'input' | 'output' | 'reasoning' | 'cacheRead' | 'cacheWrite' | 'userMsgCount' | 'assistantMsgCount'>;
  label: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { key: 'system', label: '系统', color: 'var(--ai-blue, #4f7cff)' },
  { key: 'toolsAndAgents', label: '工具', color: 'var(--ai-green, #3ec484)' },
  { key: 'messages', label: '对话', color: 'var(--ai-orange, #ff9b40)' },
  { key: 'connectors', label: '连接器', color: 'var(--ai-purple, #b06bff)' },
  { key: 'skills', label: '技能', color: 'var(--ai-pink, #ff5fa2)' },
];

export const ContextUsageModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  sessionID: string;
  providerID?: string;
  modelID?: string;
}> = ({ visible, onClose, sessionID, providerID, modelID }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [data, setData] = useState<ContextUsage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const baseUrl = (window as any).__APP_OPENCODE_RUNTIME__?.baseUrl || '';
      const limit = await fetchModelLimit(baseUrl, providerID || '', modelID || '');
      const u = await computeContextUsage(baseUrl, sessionID, limit);
      if (!cancelled) {
        setData(u);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, sessionID, providerID, modelID]);

  // ESC 关闭 (跟 ModelPicker 一致)
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const usedPct = data && data.limit > 0 ? (data.total / data.limit) * 100 : 0;
  const segments = data ? CATEGORIES.map((c) => ({
    ...c,
    pct: data.limit > 0 ? (data[c.key] / data.limit) * 100 : 0,
    relPct: data.total > 0 ? (data[c.key] / data.total) * 100 : 0,
    n: data[c.key],
  })) : [];

  return (
    <div
      className="chat__modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="chat__modal chat__modal--context" role="dialog" aria-modal="true" style={{ width: 460 }}>
        <div className="chat__modal-header chat__modal-header--page">
          <div className="chat__modal-title">上下文</div>
        </div>
        <div className="chat__modal-body chat__modal-body--context">
          {loading && !data ? (
            <div className="chat__modal-empty">加载中…</div>
          ) : data ? (
            <>
              {/* 顶部摘要: 限制 / 总 token / 使用率 (跟官方 app 同款字段) */}
              <div className="chat__context-summary">
                <div className="chat__context-summary-row">
                  <span className="chat__context-summary-key">上下文限制</span>
                  <span className="chat__context-summary-val">{fmtTok(data.limit)}</span>
                </div>
                <div className="chat__context-summary-row">
                  <span className="chat__context-summary-key">总 token</span>
                  <span className="chat__context-summary-val">{fmtTok(data.total)}</span>
                </div>
                <div className="chat__context-summary-row">
                  <span className="chat__context-summary-key">使用率</span>
                  <span className="chat__context-summary-val">{usedPct.toFixed(0)}%</span>
                </div>
              </div>

              {/* token 细分: input / output / reasoning / cache / 用户消息 / 助手消息 */}
              <div className="chat__context-details">
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">输入 token</span>
                  <span className="chat__context-detail-val">{fmtTok(data.input)}</span>
                </div>
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">输出 token</span>
                  <span className="chat__context-detail-val">{fmtTok(data.output)}</span>
                </div>
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">推理 token</span>
                  <span className="chat__context-detail-val">{fmtTok(data.reasoning)}</span>
                </div>
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">缓存 token (读/写)</span>
                  <span className="chat__context-detail-val">{fmtTok(data.cacheRead)} / {fmtTok(data.cacheWrite)}</span>
                </div>
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">用户消息</span>
                  <span className="chat__context-detail-val">{data.userMsgCount}</span>
                </div>
                <div className="chat__context-detail-row">
                  <span className="chat__context-detail-key">助手消息</span>
                  <span className="chat__context-detail-val">{data.assistantMsgCount}</span>
                </div>
              </div>

              {/* 上下文细分: 多色进度条 + legend (跟官方 app 同款) */}
              <div className="chat__context-section-title">上下文细分</div>
              <div className="chat__context-bar">
                {segments.filter((s) => s.pct > 0).map((s) => (
                  <div
                    key={s.key}
                    className="chat__context-bar-seg"
                    style={{ width: `${Math.max(0.4, s.pct)}%`, background: s.color }}
                  />
                ))}
              </div>
              <ul className="chat__context-legend">
                {segments.map((s) => (
                  <li key={s.key}>
                    <span className="chat__context-dot" style={{ background: s.color }} />
                    <span className="chat__context-legend-label">{s.label}</span>
                    <span className="chat__context-legend-val">{s.relPct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="chat__modal-empty">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
};
