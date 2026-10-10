/**
 * 常量 + helpers — extensions/chat/webview/helpers.ts
 * UI 不变, 仅搬迁位置 (类型/常量/纯函数, 无 hooks).
 */

import { extractAssistantTodos } from './parts/TodoCard';

/** 字节 → base64（浏览器端, 分块避免栈溢出） */
export function bytesToBase64(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export interface Row {
  id: string;
  role: 'user' | 'assistant';
  parts: any[];
  error?: any;
  /** 消息时间戳 (created/completed), 用于 meta 展示耗时 */
  time?: { created?: number; completed?: number };
  /** 当次对话模型 (assistant 消息 info 级, step-finish part 常缺 modelID 时兜底) */
  modelID?: string;
  providerID?: string;
  /** 专家/模式名 (assistant 消息 info.agent / info.mode) */
  agent?: string;
  mode?: string;
  /** 该消息消耗 tokens (输入/输出/推理/缓存读) — 服务端每条 assistant 消息累计 */
  tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } };
  /** 该消息费用 (USD, 服务端按模型定价计算) */
  cost?: number;
}

export function formatTokens(tokens?: Row['tokens']): string {
  const t = tokens || {};
  const input = t.input || 0;
  const output = t.output || 0;
  const reasoning = t.reasoning || 0;
  const total = input + output + reasoning;
  if (!total) return '';
  const parts = [`${total.toLocaleString()} tok`];
  return parts.join(' · ');
}

export function formatCost(cost?: number): string {
  if (!cost || !Number.isFinite(cost) || cost <= 0) return '';
  if (cost < 0.01) return `$${(cost).toFixed(4)}`;
  return `$${(cost).toFixed(2)}`;
}

/** 会话累计统计 — 由会话内所有消息逐条求和得到 (非 session 级墙钟时间/累计字段) */
export interface SessionStats {
  cost: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  /** 会话内所有对话消息的时间消耗累计 (每条 time.completed - time.created 求和) */
  durationMs: number;
}

/** 消息数组 → 逐条统计求和: { cost, tokens 各项, durationMs }.
 *  每条取 m.info.tokens/cost/time; 单条缺失/非法字段跳过, 不影响其它条. */
export function sumMessagesStats(msgs: any[]): SessionStats {
  const out: SessionStats = { cost: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, durationMs: 0 };
  for (const m of msgs || []) {
    const info = m?.info || m;
    if (!info) continue;
    const t = info.tokens || {};
    const cache = t.cache || {};
    if (typeof info.cost === 'number' && Number.isFinite(info.cost)) out.cost += info.cost;
    out.input += t.input || 0;
    out.output += t.output || 0;
    out.reasoning += t.reasoning || 0;
    out.cacheRead += cache.read || 0;
    const time = info.time || {};
    if (time.created && time.completed && time.completed >= time.created) {
      out.durationMs += time.completed - time.created;
    }
  }
  return out;
}



export const HIDDEN_AGENTS = new Set(['compaction', 'title', 'summary']);

export const AGENT_ICONS: Record<string, string> = {
  build: '🔨',
  plan: '🗺',
  general: '✨',
  explore: '🔭',
};

export const AGENT_DESC: Record<string, string> = {
  build: '执行任务 · 文件操作 · 命令执行',
  plan: '规划方案 · 任务拆解 (只读工具)',
  general: '通用问答 · 多步任务并行执行',
  explore: '信息检索 · 上下文探索',
};

export const CLIENT_COMMANDS: Array<{ cmd: string; desc: string; hint?: string }> = [
  { cmd: 'models',    desc: '选择模型', hint: '打开模型选择' },
  { cmd: 'connect',   desc: '选择服务商', hint: '搜索服务商 · 输入 API Key 连接' },
  { cmd: 'compact',   desc: '压缩上下文', hint: 'AI summary, 释放 tokens' },
  { cmd: 'new',       desc: '创建新会话', hint: '新建一个空白会话' },
  { cmd: 'skills',    desc: '选择技能', hint: '打开技能选择弹层' },
  { cmd: 'agents',    desc: '选择角色', hint: '切换 agent 角色' },
];

export function findCurrentTodos(parts: any[]): Array<{ content: string; status: string; priority?: string }> {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p?.type === 'tool' && String(p.tool || '').toLowerCase() === 'todowrite') {
      const todos = extractAssistantTodos(p?.state?.output)
        .concat(extractAssistantTodos(p?.state?.input));
      if (todos.length) return todos;
    }
  }
  return [];
}

export function extractText(parts: any[] | undefined): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => p?.type === 'text' && !p?.synthetic && !p?.ignored)
    .map((p: any) => p.text || '')
    .join('');
}

export function formatDuration(start?: number, end?: number): string {
  if (!start || !end) return '';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 100) / 10;
  return `${sec}秒`;
}

/** 耗时 → "x时x分x秒": 时/分只在达到时显示, 秒恒显示 (会话累计统计用) */
export function formatDurationHMS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}时`);
  if (m > 0) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join('');
}

const questionStore = new Map<string, { requestID: string; questions: any[] }>();
const questionSubscribers = new Set<() => void>();
const QUESTION_STORAGE = 'chat.question.v1';

// 从 sessionStorage 恢复 (question.asked 事件是实时的, 重载后会丢, 需要持久化 que_xxx)
function hydrateQuestionStore(): void {
  try {
    const raw = sessionStorage.getItem(QUESTION_STORAGE);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, { requestID: string; questions: any[] }>;
    for (const [k, v] of Object.entries(obj)) {
      if (v?.requestID) questionStore.set(k, v);
    }
  } catch { /* ignore */ }
}
hydrateQuestionStore();

export function notifyQuestionChange() { questionSubscribers.forEach((fn) => fn()); }

/** 记录某会话的待答问题 (que_xxx), 持久化到 sessionStorage 供重载后继续作答 */
export function setQuestion(sessionID: string, data: { requestID: string; questions: any[] }): void {
  questionStore.set(sessionID, data);
  try {
    sessionStorage.setItem(QUESTION_STORAGE, JSON.stringify(Object.fromEntries(questionStore)));
  } catch { /* ignore */ }
  notifyQuestionChange();
}

export function getQuestionStore(): Map<string, { requestID: string; questions: any[] }> {
  return questionStore;
}

/** 清除某会话的待答问题 (回答/忽略后调用, 避免切回重复弹窗) */
export function clearQuestion(sessionID: string): void {
  questionStore.delete(sessionID);
  try {
    sessionStorage.setItem(QUESTION_STORAGE, JSON.stringify(Object.fromEntries(questionStore)));
  } catch { /* ignore */ }
  notifyQuestionChange();
}

export function subscribeQuestionChange(fn: () => void): () => void {
  questionSubscribers.add(fn);
  return () => { questionSubscribers.delete(fn); };
}