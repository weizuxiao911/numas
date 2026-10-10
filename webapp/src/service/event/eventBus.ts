/**
 * service/event/eventBus.ts — 客户端消息总线 (框架无关单例)
 *
 * 全客户端**唯一**对接 opencode `/global/event` SSE 的地方.
 * 数据流: opencode -sse-> service (eventBus) -event-> extensions.
 *
 * - 内部持有一条 EventSource('/global/event') (全局总线, 不按 workspace 路由,
 *   一条连接即可收到所有 instance 的会话事件 + directory:"global" 的端口事件).
 * - 引用计数: 首个订阅者连接, 0 订阅者关闭; EventSource 网络错误由浏览器自动重连.
 * - 帧归一化为 { type, properties, directory, raw } 后 fan-out 给所有订阅者.
 * - 不进 DI: DI service (ports) / 命令式纯函数 (ask) / React 组件 (chat) 都能直接 import.
 *
 * 订阅 API:
 *   onEvent(cb)              全量帧
 *   onEventType(types, cb)   按事件 type 过滤 (单个/多个)
 *   onSessionEvent(sid, cb)  按 properties.sessionID 过滤
 *   均返回 unsubscribe () => void.
 *
 * 详见 docs/消息总线服务设计与测试用例.md.
 */

import { appBaseUrl, secureUrl } from '../../infra/url';

export interface NormalizedEvent {
  /** payload.type */
  type: string;
  /** payload.properties || payload.data */
  properties: Record<string, any>;
  /** 总线信封 directory (会话=工作区绝对路径, 端口事件="global") */
  directory?: string;
  /** 原始帧 (调试用) */
  raw: any;
}

type Listener = (ev: NormalizedEvent) => void;
type Unsub = () => void;

/** SSE 连接状态: connecting=建连中, open=已连通, error=断开重连中(浏览器自动), closed=已关闭(需手动重建) */
export type BusStatus = 'connecting' | 'open' | 'error' | 'closed';
let _status: BusStatus = 'closed';
const statusListeners = new Set<(s: BusStatus) => void>();

function setStatus(s: BusStatus): void {
  if (_status === s) return;
  _status = s;
  statusListeners.forEach((l) => {
    try { l(s); } catch { /* ignore */ }
  });
}

/** 当前 SSE 连接状态 */
export function getBusStatus(): BusStatus {
  return _status;
}

/** 订阅 SSE 连接状态 (opencode 挂/断线恢复的 UI 反馈用); 立即回调当前值. */
export function subscribeBusStatus(cb: (s: BusStatus) => void): Unsub {
  statusListeners.add(cb);
  try { cb(_status); } catch { /* ignore */ }
  return () => { statusListeners.delete(cb); };
}

const listeners = new Set<Listener>();
let es: EventSource | null = null;
/** 手动重连定时器 (EventSource CLOSED 后浏览器不再自动重连, 需自己重建) */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** 归一化一帧 SSE 数据; 无效帧返回 null. */
function normalize(msgData: string): NormalizedEvent | null {
  let raw: any;
  try {
    raw = JSON.parse(msgData);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  // /global/event 信封: { directory, payload: { id, type, properties } };
  // 兜底裸帧: { id, type, properties|data }.
  const envelope = raw.payload ?? raw;
  const type = envelope?.type as string | undefined;
  if (!type) return null;
  const properties = envelope?.properties ?? envelope?.data ?? {};
  if (!properties || typeof properties !== 'object') return null;
  return {
    type,
    properties: properties as Record<string, any>,
    directory: typeof raw.directory === 'string' ? raw.directory : undefined,
    raw,
  };
}

/** 引用计数 +1 并确保 SSE 已连接 (0→1 时建连). */
function connect(): void {
  if (es) return;
  const base = appBaseUrl();
  if (!base) { setStatus('closed'); return; } // opencode 未起; 下次订阅时再尝试建连
  setStatus('connecting');
  try {
    const source = new EventSource(secureUrl(`${base.replace(/\/+$/, '')}/global/event`), { withCredentials: false });
    es = source;
    source.onopen = () => setStatus('open');
    source.onmessage = (msg) => {
      setStatus('open'); // 收到帧 = 连接活跃 (防御性: onopen 偶发缺失)
      const ev = normalize(msg.data);
      if (!ev) return;
      listeners.forEach((l) => {
        try {
          l(ev);
        } catch (e) {
          console.warn('[eventBus] listener error:', e);
        }
      });
    };
    source.onerror = () => {
      // readyState: 0=CONNECTING (浏览器自动重连中), 2=CLOSED (不再自动重连, 需手动重建)
      if (source.readyState === EventSource.CLOSED) {
        setStatus('closed');
        es = null;
        scheduleReconnect();
      } else {
        setStatus('error'); // 浏览器自动重连中
      }
    };
  } catch (e) {
    console.warn('[eventBus] SSE start failed:', e);
    es = null;
    setStatus('closed');
    scheduleReconnect();
  }
}

/** EventSource CLOSED 后浏览器不再自动重连 → 2s 后手动重建 (仍有订阅者时). */
function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (listeners.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0 && !es) connect();
  }, 2000);
}

/** 引用计数 -1; 归 0 时关闭 SSE. */
function disconnect(): void {
  if (listeners.size > 0) return;
  try { es?.close(); } catch { /* ignore */ }
  es = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  setStatus('closed');
}

/** 全量订阅: 每一帧都回调. */
export function onEvent(cb: Listener): Unsub {
  listeners.add(cb);
  connect();
  return () => {
    listeners.delete(cb);
    disconnect();
  };
}

/** 按事件 type 订阅 (单个字符串或数组). */
export function onEventType(types: string | string[], cb: Listener): Unsub {
  const set = new Set(Array.isArray(types) ? types : [types]);
  return onEvent((ev) => {
    if (set.has(ev.type)) cb(ev);
  });
}

/** 按会话 ID 订阅 (匹配 properties.sessionID). */
export function onSessionEvent(sessionID: string, cb: Listener): Unsub {
  return onEvent((ev) => {
    if (ev.properties?.sessionID === sessionID) cb(ev);
  });
}
