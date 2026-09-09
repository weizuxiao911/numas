/**
 * infra/url.ts — 单一工作目录 (workdir) + opencode baseUrl + secure URL 升级.
 *
 * 只有一个目录概念: **workdir** (当前工作目录 / 项目).
 *
 * 解析 (取值) 链:
 *   1. URL `?directory=` — 一次性入口: 首次访问时读到即视为"选择项目", 写入 localStorage
 *      并立即从地址栏抹掉 (replaceState, 不 reload), 之后地址栏保持干净.
 *   2. localStorage `NUMAS_WORKDIR` — 跨刷新记住上次选择.
 *   3. 都没有 → '' (未选择项目, UI 显示「选择项目」).
 *
 * 后端 `/path` 响应的 directory **只作技术兜底** (解析 home 锚点 + 未选项目时让发消息/
 * 请求仍能带上 header), **不会成为"已选项目"**: 已选与否只看 getWorkdir().
 */

import { normalizeCwdPath } from './path';

/** opencode serve 地址 (去尾 /, 直连无中间层).
 *  来源: window.__APP_CONFIG__.appBaseUrl. '/' → window.location.origin; 显式 → 直连. */
export function appBaseUrl(): string {
  const injected = (typeof window !== 'undefined' ? (window as any).__APP_CONFIG__?.appBaseUrl : '') || '';
  if (injected === '/') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/+$/, '');
    }
    return '';
  }
  return injected.replace(/\/+$/, '');
}

// ============================================================
// workdir (唯一目录概念)
// ============================================================

const STORAGE_KEY = 'NUMAS_WORKDIR';

let _initialized = false;
let _workdir = '';
/** /path.directory 技术兜底 (不当已选项目) */
let _fallbackDir = '';

/** 读 URL `?directory=` (一次性入口). 跨平台 normalize; 截断误拼的 `?` 后续. */
function urlWorkdir(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = new URL(window.location.href).searchParams.get('directory');
    if (!raw) return '';
    const cleaned = raw.split('?')[0];
    return cleaned ? normalizeCwdPath(cleaned) : '';
  } catch {
    return '';
  }
}

function readStored(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeCwdPath(window.localStorage.getItem(STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

function writeStored(dir: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (dir) window.localStorage.setItem(STORAGE_KEY, dir);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* privacy mode / quota */ }
}

/** 首次取值时初始化: URL ?directory= 优先 (消费后清地址栏), 否则 localStorage. */
function ensureInit(): void {
  if (_initialized) return;
  _initialized = true;
  const fromUrl = urlWorkdir();
  if (fromUrl) {
    _workdir = fromUrl;
    writeStored(fromUrl);
    stripDirectoryFromUrl();
    return;
  }
  _workdir = readStored();
}

/** 把地址栏的 ?directory= 抹掉 (保留其他 query), replaceState 不 reload. */
function stripDirectoryFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('directory')) return;
    u.searchParams.delete('directory');
    window.history.replaceState(null, '', u.toString());
  } catch { /* ignore */ }
}

/** 当前已选 workdir (项目); 未选择返回 ''. 不包含 /path 兜底值. */
export function getWorkdir(): string {
  ensureInit();
  return _workdir;
}

/** 是否已显式选择项目 (URL 入口或 localStorage). /path 兜底不算. */
export function isWorkdirSelected(): boolean {
  return !!getWorkdir();
}

/** 设定 workdir (选择项目). 写 localStorage, 派 'workdir:changed', 不 reload.
 *  传空 = 清除选择 (回「选择项目」空态). */
export function setWorkdir(dir: string): void {
  ensureInit();
  const next = dir ? normalizeCwdPath(dir) : '';
  if (next === _workdir) return;
  _workdir = next;
  writeStored(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workdir:changed', { detail: { workdir: next } }));
  }
}

/** 订阅 workdir 变化 (返回 unsubscribe). */
export function subscribeWorkdir(cb: (next: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<{ workdir: string }>).detail?.workdir ?? getWorkdir());
  window.addEventListener('workdir:changed', handler);
  return () => window.removeEventListener('workdir:changed', handler);
}

/** /path.directory 技术兜底注入 (home 锚点解析 / 未选项目时 header 兜底).
 *  不改变已选 workdir, 也不派发 workdir:changed. */
export function setFallbackDirectory(dir: string): void {
  _fallbackDir = dir ? normalizeCwdPath(dir) : '';
}

export function getFallbackDirectory(): string {
  return _fallbackDir;
}

/** 发请求时实际使用的目录 = 已选 workdir. 未选项目返回 '' (业务请求一律不带目录,
 *  由 server 决定落点; /path.directory 兜底**不**进入业务请求). */
export function getEffectiveCwd(): string {
  return getWorkdir();
}

/** x-opencode-directory header: 有选 workdir 才带, 未选返回 {} (不带目录).
 *  必须 encodeURI — 浏览器 fetch 限制 header 值必须 ISO-8859-1 (中文路径会抛错).
 *  Windows 路径绝不带 '/' 前缀 (server 端按 POSIX 根解析会 500/错目录). */
export function workdirHeader(): Record<string, string> {
  const dir = normalizeCwdPath(getWorkdir());
  return dir ? { 'x-opencode-directory': encodeURI(dir) } : {};
}

// ---- 兼容别名 (单 workdir 模型后语义相同, 供既有调用点平滑迁移) ----

/** @deprecated 单目录模型: 等同 getWorkdir(). */
export function getWorkspace(): string {
  return getWorkdir();
}

/** @deprecated 单目录模型: 等同 setWorkdir(). */
export function setWorkspace(dir: string): void {
  setWorkdir(dir);
}

/** @deprecated 单目录模型: 等同 subscribeWorkdir(). */
export function subscribeWorkspace(cb: (next: string, prev: string) => void): () => void {
  return subscribeWorkdir((next) => cb(next, next));
}

/** @deprecated 历史别名: 实际请求目录 (workdir 或 /path 兜底). */
export const effectiveCwd = getEffectiveCwd;

/** @deprecated 名不对实, 新代码用 workdirHeader. */
export const workspaceHeader = workdirHeader;

/** @deprecated 历史别名, 新代码用 workdirHeader. */
export const cwdHeader = workdirHeader;

/** 启动时向后端探测 /path, 仅取 directory 作技术兜底 (不当已选项目) + 返回 home.
 *  App 启动门控用: 至少等 /path 返回一次 (拿到 home 锚点), 但即使未选项目也不阻塞.
 *  幂等: 并发调用共享同一次请求. */
let _resolving: Promise<void> | null = null;
export function resolveFallback(): Promise<void> {
  if (_fallbackDir) return Promise.resolve();
  if (_resolving) return _resolving;
  const base = appBaseUrl();
  if (!base) return Promise.resolve();
  _resolving = (async () => {
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/path`, { headers: { Accept: 'application/json' } });
      const json: any = await res.json().catch(() => null);
      const dir = (typeof json?.directory === 'string' && json.directory)
        || (typeof json?.worktree === 'string' && json.worktree)
        || '';
      if (dir) setFallbackDirectory(dir);
    } catch {
      /* 未选项目且 /path 不可用: 纯空态 */
    } finally {
      _resolving = null;
    }
  })();
  return _resolving;
}

/** 启动是否就绪: 至少跑过一次 /path 探测 (拿到 home 锚点). 未选项目也判定就绪
 *  (允许纯「选择项目」空态挂载 AppRenderer). */
export function isBootReady(): boolean {
  return _bootReady;
}
let _bootReady = false;

/** 启动就绪解析: 消费 URL ?directory= (已在 getWorkdir 首次调用时完成) + 探一次 /path.
 *  /path 的 directory 只作技术兜底, 不成为已选项目. */
export function resolveBoot(): Promise<void> {
  return (async () => {
    getWorkdir(); // 触发 URL ?directory= 一次性消费 + localStorage 初始化
    await resolveFallback();
    _bootReady = true;
  })();
}

/** 错误是否表示 "路径不存在" (ENOENT / not found / no such file).
 *  用于 stale workdir 检测分流:
 *    - 真删: 清 workdir + reload
 *    - 其他 (connection / timeout / 5xx): 短暂不可用, 保留 workdir
 *  跨 opencode SDK / node fs / shell 错误信息匹配. */
export function isPathNotFoundError(e: any): boolean {
  const msg = (e?.message || e?.err || String(e || '')).toString();
  return /not\s*found|ENOENT|no\s*such\s*file|cannot\s*find|路径不存在/i.test(msg);
}

/** workdir 变更事件名 (供 SSE / watcher 等需要时引用). */
export const WORKDIR_CHANGED_EVENT = 'workdir:changed';

/** URL 协议升级: 页面 https 时, http→https / ws→wss (mixed content 浏览器拒绝)
 *  单一 helper, 所有自建 ws/sse 入口统一走, 避免散落 */
export function secureUrl(url: string): string {
  if (typeof window === 'undefined' || !url) return url;
  if (window.location.protocol !== 'https:') return url;
  return url.replace(/^http:/i, 'https:').replace(/^ws:/i, 'wss:');
}
