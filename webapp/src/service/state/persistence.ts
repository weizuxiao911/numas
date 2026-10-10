/**
 * service/state/persistence.ts
 *
 * localStorage 持久化 adapter.
 * 当前 storage: 'WORKSPACE_RECENT' (JSON RecentWorkspace[] { path, lastOpenedAt }).
 *
 * 旧 schema 兼容: 历史数据是 string[], 读到后自动转 { path, lastOpenedAt: 0 }.
 *
 * 后续重设计: 替换为 IndexedDB / 服务器, 持久化层 abstraction 保持不变.
 */

import type { RecentWorkspace } from './state.interface';

const KEY = 'WORKSPACE_RECENT';

export function loadRecent(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 兼容旧 schema (string[])
    const seen = new Set<string>();
    return arr
      .map((item): RecentWorkspace | null => {
        if (typeof item === 'string') {
          return { path: item, lastOpenedAt: 0 };
        }
        if (item && typeof item === 'object' && typeof item.path === 'string') {
          return {
            path: item.path,
            lastOpenedAt: typeof item.lastOpenedAt === 'number' ? item.lastOpenedAt : 0,
          };
        }
        return null;
      })
      .filter((r): r is RecentWorkspace => {
        if (!r) return false;
        if (seen.has(r.path)) return false;
        seen.add(r.path);
        return true;
      })
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  } catch {
    return [];
  }
}

export function saveRecent(list: RecentWorkspace[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); }
  catch { /* quota / privacy mode */ }
}