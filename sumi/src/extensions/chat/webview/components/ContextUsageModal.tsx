/**
 * ContextUsageModal — 上下文用量弹层 (对齐官方 opencode web app SessionContextTab)
 *
 * 数据源: 从 `GET /provider` 拿 model limit (跟官方 getSessionContext 同款,
 *   不依赖项目 opencode.json 是否配了 provider); `GET /session/{id}/message` 拿 messages
 *   拆 5 段; server 实际报的 `info.tokens` 用于总用量 (含 subagent + cache).
 *
 * 5 段 (跟官方 BREAKDOWN_COLOR 同款):
 *   - system   蓝
 *   - user     绿
 *   - assistant 橙
 *   - tool     紫
 *   - other    灰
 *
 * 触发: stats bar 底部 tokens 文本点击. 视觉/框架跟 numas 自有 chat__modal-* 一致
 * (跟 ModelPicker / Settings 同款), ESC + 点击 overlay 关闭.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { onEventType } from '@/service/event/eventBus';
import { formatCost, formatDurationHMS, sumMessagesStats } from '../helpers';

interface BreakdownSegment {
  key: 'system' | 'user' | 'assistant' | 'tool' | 'other';
  tokens: number;
  /** 相对 server 报 total 的百分比 (跟官方 estimateSessionContextBreakdown 公式一致) */
  percent: number;
  /** 相对 limit 的宽度百分比 (进度条用) */
  width: number;
}

interface ContextUsage {
  /** server 报的最后一条 assistant tokens 总合 (跟官方 tokenTotal 公式) */
  total: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  /** 5 段细分 (跟官方 BREAKDOWN_KEY 顺序) */
  breakdown: BreakdownSegment[];
  userMsgCount: number;
  assistantMsgCount: number;
  /** system prompt 字符串 (从 agent prompt 拼, numas 端点拿不到 V2 user.system) */
  systemPrompt: string;
  /** 消息数 */
  messageCount: number;
  /** 会话创建时间 (session.info.time.created, ms epoch) — 跟官方 app "创建时间" 字段一致 */
  timeCreated: number;
  /** 会话最后活动时间 (session.info.time.updated, ms epoch) — 跟官方 app "最后活动" 字段一致 */
  timeUpdated: number;
  /** 会话总成本 (USD, 消息累加) — 跟官方 app "总成本" 字段一致 */
  cost: number;
  /** context window limit (server-known, 拿不到 → 0) */
  limit: number;
  /** 百分比 (0-100), 拿不到 limit 时为 null (跟官方 usage 一致) */
  usage: number | null;
  /** 主会话累计 token (所有消息 input+output+reasoning 求和; 开销分项用) */
  mainTokens: number;
  /** 主会话墙钟 (time.updated - time.created; 开销分项用) */
  mainDuration: number;
  /** 主会话 token 分项累计 (输入/输出/缓存读) */
  mainInput: number;
  mainOutput: number;
  mainCacheRead: number;
}

// ===== 5 段颜色 (跟官方 BREAKDOWN_COLOR 一致, 适配 numas CSS 变量) =====
const BREAKDOWN_COLOR: Record<BreakdownSegment['key'], string> = {
  system: 'var(--ai-blue, #4f7cff)',
  user: 'var(--ai-green, #3ec484)',
  assistant: 'var(--ai-orange, #ff9b40)',
  tool: 'var(--ai-purple, #b06bff)',
  other: 'var(--ai-fg-muted, #8f8f8f)',
};

const BREAKDOWN_LABEL: Record<BreakdownSegment['key'], string> = {
  system: '系统',
  user: '用户',
  assistant: '助手',
  tool: '工具',
  other: '其他',
};

// ===== 跟官方同款 token 估算公式 =====
/** chars/4 (跟官方 estimateTokens 公式; numas 之前用 /3 略激进) */
const estTokens = (chars: number) => Math.ceil(chars / 4);

const charsFromUserPart = (p: any): number => {
  if (p?.type === 'text') return p.text?.length || 0;
  if (p?.type === 'file') return p.source?.text?.value?.length || 0;
  if (p?.type === 'agent') return p.source?.value?.length || 0;
  return 0;
};

const charsFromAssistantPart = (p: any): { assistant: number; tool: number } => {
  if (p?.type === 'text') return { assistant: p.text?.length || 0, tool: 0 };
  if (p?.type === 'reasoning') return { assistant: p.text?.length || 0, tool: 0 };
  if (p?.type !== 'tool') return { assistant: 0, tool: 0 };
  // tool: 跟官方一致 - input keys 数量 * 16 + output length
  const inputKeys = Object.keys(p.state?.input || {}).length;
  let bodyLen = 0;
  if (p.state?.status === 'pending') bodyLen = p.state.raw?.length || 0;
  else if (p.state?.status === 'completed') bodyLen = p.state.output?.length || 0;
  else if (p.state?.status === 'error') bodyLen = p.state.error?.length || 0;
  return { assistant: 0, tool: inputKeys * 16 + bodyLen };
};

const computeBreakdown = (
  messages: any[],
  input: number,
  systemPrompt: string,
): BreakdownSegment[] => {
  const counts = { system: systemPrompt.length, user: 0, assistant: 0, tool: 0 };
  for (const m of messages) {
    const role = m?.info?.role || m?.role;
    for (const p of m?.parts || []) {
      if (role === 'user') counts.user += charsFromUserPart(p);
      else if (role === 'assistant') {
        const next = charsFromAssistantPart(p);
        counts.assistant += next.assistant;
        counts.tool += next.tool;
      }
    }
  }
  const tokens = {
    system: estTokens(counts.system),
    user: estTokens(counts.user),
    assistant: estTokens(counts.assistant),
    tool: estTokens(counts.tool),
  };
  const estimated = tokens.system + tokens.user + tokens.assistant + tokens.tool;

  // 跟官方一致: estimated <= input 时 other = input - estimated; 否则按比例缩放 + other = max(0, input - total)
  let segments: { key: BreakdownSegment['key']; tokens: number }[];
  if (estimated <= input) {
    segments = [
      { key: 'system', tokens: tokens.system },
      { key: 'user', tokens: tokens.user },
      { key: 'assistant', tokens: tokens.assistant },
      { key: 'tool', tokens: tokens.tool },
      { key: 'other', tokens: input - estimated },
    ];
  } else {
    const scale = input / estimated;
    const scaled = {
      system: Math.floor(tokens.system * scale),
      user: Math.floor(tokens.user * scale),
      assistant: Math.floor(tokens.assistant * scale),
      tool: Math.floor(tokens.tool * scale),
    };
    const total = scaled.system + scaled.user + scaled.assistant + scaled.tool;
    segments = [
      { key: 'system', tokens: scaled.system },
      { key: 'user', tokens: scaled.user },
      { key: 'assistant', tokens: scaled.assistant },
      { key: 'tool', tokens: scaled.tool },
      { key: 'other', tokens: Math.max(0, input - total) },
    ];
  }
  return segments
    .filter((s) => s.tokens > 0)
    .map((s) => ({
      key: s.key,
      tokens: s.tokens,
      // percent 跟官方: tokens / input * 100 (相对总用量)
      percent: input > 0 ? (s.tokens / input) * 100 : 0,
      // width 跟官方: same as percent (相对 input, 进度条宽度)
      width: input > 0 ? (s.tokens / input) * 100 : 0,
    }));
};

// ===== 跟官方 tokenTotal: input + output + reasoning + cache.read + cache.write =====
const tokenTotal = (msg: any): number => {
  const t = msg?.info?.tokens || msg?.tokens || {};
  const c = t.cache || {};
  return (t.input || 0) + (t.output || 0) + (t.reasoning || 0) + (c.read || 0) + (c.write || 0);
};

const lastAssistantWithTokens = (messages: any[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const role = m?.info?.role || m?.role;
    if (role !== 'assistant') continue;
    if (tokenTotal(m) <= 0) continue;
    return m;
  }
};

// ===== 端点调用 =====
async function fetchEndpoint(baseUrl: string, path: string): Promise<any> {
  try {
    const r = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-opencode-directory': encodeURI(window.__APP_OPENCODE_RUNTIME__?.cwd || '') },
    });
    if (!r.ok) return null;
    return r.json().catch(() => null);
  } catch { return null; }
}

/** 跟官方同款: 从 /provider 拿 model limit (server-known 全集, 跟 numas 端点同款) */
async function fetchModelLimit(baseUrl: string, providerID: string, modelID: string): Promise<number> {
  if (!baseUrl || !providerID || !modelID) return 0;
  try {
    const r = await fetch(`${baseUrl}/provider`);
    if (!r.ok) return 0;
    const j = await r.json();
    const targetMid = modelID.toLowerCase();
    const targetPid = providerID.toLowerCase();
    // 先精确匹配 provider
    let p = j.all?.[providerID];
    if (!p) {
      for (const [pid, pp] of Object.entries(j.all || {})) {
        if (pid.toLowerCase() === targetPid) { p = pp; break; }
      }
    }
    if (p?.models) {
      const m = p.models[modelID] || p.models[targetMid];
      if (m?.limit?.context) return m.limit.context;
    }
    // 全局搜 (model id 可能跨 provider 重名)
    for (const [, pp] of Object.entries(j.all || {})) {
      const m = pp?.models?.[modelID] || pp?.models?.[targetMid];
      if (m?.limit?.context) return m.limit.context;
    }
  } catch { /* ignore */ }
  return 0;
}

/** numas 端点拿不到 V2 的 user.system, 改用 agents API 拼 system prompt */
async function fetchSystemPrompt(baseUrl: string, currentAgent: string): Promise<string> {
  try {
    const r = await fetch(`${baseUrl}/agent`);
    if (!r.ok) return '';
    const arr = await r.json();
    // 优先当前 agent prompt; 拼所有 mode=primary agent 作 fallback
    if (Array.isArray(arr) && arr.length > 0) {
      const cur = arr.find((a) => a?.name === currentAgent || a?.id === currentAgent);
      if (cur?.prompt) return cur.prompt;
      const primary = arr.find((a) => a?.mode === 'primary' || a?.mode === 'all');
      if (primary?.prompt) return primary.prompt;
      const any = arr.find((a) => a?.prompt);
      if (any?.prompt) return any.prompt;
    }
  } catch { /* ignore */ }
  return '';
}

/** token 数字格式化: 跟 stats bar 完全一致 (千分位 + " tok" 后缀, 不缩写) */
function fmtTok(n: number): string {
  return `${(n || 0).toLocaleString()} tok`;
}

/** token 数字缩写 (K/M, 无单位; 会话统计用 — 用户要求 tok 单位不显示) */
function fmtTokShort(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

/** 时间戳 → 本地化时间字符串 (创建时间 / 最后活动行用) */
function fmtTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

/** 耗时格式化 (跟 stats bar 同款 "x时x分x秒"; 0 → '0秒') */
function fmtHMS(ms: number): string {
  return ms > 0 ? formatDurationHMS(ms) : '0秒';
}

export const ContextUsageModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  sessionID: string;
  providerID?: string;
  modelID?: string;
  currentAgent?: string;
  /** 子代理开销 (父组件 BFS 统计; 主/子分项展示用) */
  subagentStats?: { count: number; tokens: number; cost: number; durationMs: number; input: number; output: number; cacheRead: number };
}> = ({ visible, onClose, sessionID, providerID, modelID, currentAgent, subagentStats }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [data, setData] = useState<ContextUsage | null>(null);
  const [loading, setLoading] = useState(false);
  /** token 明细折叠/展开 (入口 = 摘要区"使用率"行) */
  const [showDetails, setShowDetails] = useState(false);

  // 实时刷新: 跟官方 app SessionContextTab 同款 (SolidJS store 自动响应), numas React 手动订阅事件
  // numas fork 的 /global/event SSE 已支持: session.updated / message.updated / message.part.updated / session.diff
  const loadData = useCallback(async () => {
    const baseUrl = (window as any).__APP_OPENCODE_RUNTIME__?.baseUrl || '';
    const [messages, limit, systemPrompt, session] = await Promise.all([
      fetchEndpoint(baseUrl, '/session/' + encodeURIComponent(sessionID) + '/message'),
      fetchModelLimit(baseUrl, providerID || '', modelID || ''),
      fetchSystemPrompt(baseUrl, currentAgent || ''),
      fetchEndpoint(baseUrl, '/session/' + encodeURIComponent(sessionID)),
    ]);
    const arr = Array.isArray(messages) ? messages : [];
    const last = lastAssistantWithTokens(arr);
    const t = last?.info?.tokens || {};
    const c = t.cache || {};
    const input = t.input || 0;
    const output = t.output || 0;
    const reasoning = t.reasoning || 0;
    const cacheRead = c.read || 0;
    const cacheWrite = c.write || 0;
    const total = input + output + reasoning + cacheRead + cacheWrite;
    const userMsgCount = arr.filter((m) => (m?.info?.role || m?.role) === 'user').length;
    const assistantMsgCount = arr.filter((m) => (m?.info?.role || m?.role) === 'assistant').length;
    const breakdown = input > 0
      ? computeBreakdown(arr, input, systemPrompt)
      : [];
    const time = session?.time || {};
    // 主会话累计 (跟 stats bar sumMessagesStats 同源): 成本 + token 分项 (输入/输出/缓存读) + 合计
    let cumCost = 0;
    let mainTokens = 0;
    let mainInput = 0;
    let mainOutput = 0;
    let mainCacheRead = 0;
    for (const m of arr) {
      const cst = m?.info?.cost;
      if (typeof cst === 'number' && Number.isFinite(cst)) cumCost += cst;
      const tk = m?.info?.tokens || {};
      const cache = tk.cache || {};
      mainInput += tk.input || 0;
      mainOutput += tk.output || 0;
      mainCacheRead += cache.read || 0;
      mainTokens += (tk.input || 0) + (tk.output || 0) + (tk.reasoning || 0);
    }
    // 时间口径 (用户要求): 主会话所有消息耗时累计 (每条 time.completed - time.created)
    const mainDuration = sumMessagesStats(arr).durationMs;
    setData({
      total, input, output, reasoning, cacheRead, cacheWrite,
      breakdown, userMsgCount, assistantMsgCount,
      systemPrompt, messageCount: arr.length,
      timeCreated: time.created || 0,
      timeUpdated: time.updated || 0,
      cost: cumCost,
      limit, usage: limit > 0 ? Math.round((total / limit) * 100) : null,
      mainTokens, mainDuration, mainInput, mainOutput, mainCacheRead,
    });
  }, [sessionID, providerID, modelID, currentAgent]);

  // 用 ref 持最新 loadData, 避免事件订阅 effect deps 变化反复重订阅
  const loadRef = useRef(loadData);
  loadRef.current = loadData;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void loadData().finally(() => setLoading(false));
  }, [visible, loadData]);

  // 事件订阅: visible 时监听当前 session 变化, 触发 reload (跟官方 SolidJS store 自动 reactive 同款效果)
  useEffect(() => {
    if (!visible) return;
    const off = onEventType(
      ['session.updated', 'message.updated', 'message.part.updated', 'session.diff', 'session.idle'],
      (ev) => {
        // 只响应当前 session 的事件 (server 在 V1 端点不强制带 sessionID, 兜底全量)
        const sid = (ev.properties as any)?.sessionID;
        if (sid && sid !== sessionID) return;
        void loadRef.current();
      },
    );
    return off;
  }, [visible, sessionID]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="chat__modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="chat__modal chat__modal--context"
        role="dialog"
        aria-modal="true"
        style={{ width: 560 }}
      >
        <div className="chat__modal-header chat__modal-header--page">
          <div className="chat__modal-title">
            上下文
            <span
              className="chat__context-help"
              title="当前对话窗口的占用: 最后一次 LLM 调用看到的 token (输入+输出+推理+缓存) 与模型上限之比。反映「窗口还剩多少可用」。注意与底部「会话统计」的区别: 本项是当前快照, 会话统计是多轮累计开销 (每轮 input 都含历史, 故累计值更大)。"
            >?</span>
          </div>
        </div>
        <div className="chat__modal-body chat__modal-body--context">
          {loading && !data ? (
            <div className="chat__modal-empty">加载中…</div>
          ) : data ? (
            <>
              {/* 上下文限制 / 总 token / 使用率 (跟官方 app 字段一致) */}
              <div className="chat__context-summary">
                <div className="chat__context-summary-row">
                  <span className="chat__context-summary-key">上下文限制</span>
                  <span className="chat__context-summary-val">
                    {data.limit > 0 ? fmtTok(data.limit) : '—'}
                  </span>
                </div>
                {/* 总 token = token 明细折叠/展开入口 (点击切换; 默认折叠) */}
                <div
                  className="chat__context-summary-row chat__context-summary-row--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDetails((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDetails((v) => !v); } }}
                  title={showDetails ? '收起 token 明细' : '展开 token 明细'}
                >
                  <span className="chat__context-summary-key">总 token</span>
                  <span className="chat__context-summary-val">
                    {fmtTok(data.total)}
                    <svg
                      className={`chat__context-chevron${showDetails ? ' is-open' : ''}`}
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>

                {/* token 明细 (折叠/展开; 紧跟"总 token"行) */}
                {showDetails && (
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
                    {data.cost > 0 && (
                      <div className="chat__context-detail-row">
                        <span className="chat__context-detail-key">成本</span>
                        <span className="chat__context-detail-val">{formatCost(data.cost) || '$0.00'}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="chat__context-summary-row">
                  <span className="chat__context-summary-key">使用率</span>
                  <span className="chat__context-summary-val">
                    {data.usage != null ? `${data.usage}%` : '—'}
                  </span>
                </div>
              </div>

              {/* 上下文细分 (5 段堆叠进度条 + legend, 跟官方 session-context-tab 一致) */}
              {data.breakdown.length > 0 && (
                <div className="chat__context-section">
                  <div className="chat__context-section-title">上下文细分</div>
                  <div className="chat__context-bar" title="">
                    {data.breakdown.map((s) => (
                      <div
                        key={s.key}
                        className="chat__context-bar-seg"
                        style={{
                          width: `${Math.max(0.4, s.width)}%`,
                          background: BREAKDOWN_COLOR[s.key],
                        }}
                        title={`${BREAKDOWN_LABEL[s.key]}: ${fmtTok(s.tokens)} (${s.percent.toFixed(1)}%)`}
                      />
                    ))}
                  </div>
                  <ul className="chat__context-legend">
                    {data.breakdown.map((s) => (
                      <li key={s.key}>
                        <span className="chat__context-dot" style={{ background: BREAKDOWN_COLOR[s.key] }} />
                        <span className="chat__context-legend-label">{BREAKDOWN_LABEL[s.key]}</span>
                        <span className="chat__context-legend-val">{s.percent.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 会话统计 (累计开销, 含子会话; 放最后 — 与上方"上下文"是不同概念, ? 解释) */}
              <div className="chat__context-section">
                <div className="chat__context-section-title">
                  会话统计
                  <span
                    className="chat__context-help"
                    title="整个会话的累计开销 (含子会话): 主/子会话所有 LLM 调用的 token 累加 + 费用。与顶部「上下文」的区别: 上下文 = 当前窗口占用快照 (最后一次调用); 本项 = 多轮调用累计 (每轮 input 都含历史, 故数值更大)。"
                  >?</span>
                </div>
                {/* 用摘要区 item 样式 (跟"上下文限制"同级, 非子 item) */}
                <div className="chat__context-summary">
                  {/* 主/子会话各自 3 种 tok (输入/输出/缓存); 耗时单独一行 (总耗时 = 主+子) */}
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">主会话</span>
                    <span className="chat__context-summary-val">
                      输入 {fmtTokShort(data.mainInput)} / 输出 {fmtTokShort(data.mainOutput)} / 缓存 {fmtTokShort(data.mainCacheRead)}
                    </span>
                  </div>
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">子会话</span>
                    <span className="chat__context-summary-val">
                      输入 {fmtTokShort(subagentStats?.input || 0)} / 输出 {fmtTokShort(subagentStats?.output || 0)} / 缓存 {fmtTokShort(subagentStats?.cacheRead || 0)}
                    </span>
                  </div>
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">总耗时</span>
                    <span className="chat__context-summary-val">
                      {fmtHMS(data.mainDuration + (subagentStats?.durationMs || 0))}
                    </span>
                  </div>
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">总成本</span>
                    <span className="chat__context-summary-val">
                      {formatCost((data.cost || 0) + (subagentStats?.cost || 0)) || '$0.00'}
                    </span>
                  </div>
                  {/* 创建时间 / 最后活动 (会话级时间信息, 归入会话统计) */}
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">创建时间</span>
                    <span className="chat__context-summary-val">{fmtTime(data.timeCreated)}</span>
                  </div>
                  <div className="chat__context-summary-row">
                    <span className="chat__context-summary-key">最后活动</span>
                    <span className="chat__context-summary-val">{fmtTime(data.timeUpdated)}</span>
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="chat__modal-empty">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
};


