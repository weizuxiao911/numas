/**
 * infra/session.ts — 登录态文件 (session.yaml) 读写 (基础设施层)
 *
 * 分层铁律 (AGENTS §2.2): infra → service → extensions.
 * extensions 禁止直接 import 本文件, 必须经 service/session (DI 注入) 消费.
 *
 * 文件位置: `<HOME>/.numas/cache/session.yaml` (容器内 HOME=/home → /home/.numas/cache/…).
 *   HOME 取 /path 接口的 home 锚点 (infra/host.ts), 不硬编码.
 *
 * 为什么能读写 workspace 之外的路径 (关键):
 *   opencode fork 的 fs 沙箱 (packages/core/src/filesystem.ts resolve) 要求
 *   `contains(location.directory, path.resolve(location.directory, input))`,
 *   所以 path 传 workspace 外的绝对路径必被 die → 裸 500.
 *   既有解法 (codeblitz storage 写 ~/.codeblitz 用的就是它, 见 infra/http.ts headerPath):
 *   **把父目录作为 x-opencode-directory header, path 只给 basename**,
 *   于是对服务端而言 location.directory 就是该父目录, contains 天然成立 —— 不需要
 *   改后端沙箱, 也不需要 allow 参数放宽全局越权.
 *
 * 内容格式 (用户约定):
 *   user:
 *     - userId: {用户标识}
 *     - token: {登录令牌}
 *     - partner: {应用标识}
 *     - sign: {防伪签名}
 */
import { apiGet, apiPost, bytesToBase64 } from './http';
import { whenHostAnchors } from './host';
import { normalizeCwdPath, pathBase, pathDirname, pathJoin } from './path';

/** session.yaml 承载的用户信息字段 (4 个, 缺一不写盘). */
export interface SessionUser {
  userId: string;
  token: string;
  partner: string;
  sign: string;
}

export const SESSION_USER_KEYS = ['userId', 'token', 'partner', 'sign'] as const;

/** session.yaml 的宿主机绝对路径 (父目录, 文件名) — HOME 锚点来自 /path 接口. */
async function sessionFileLoc(): Promise<{ dir: string; name: string } | null> {
  const anchors = await whenHostAnchors().catch(() => null);
  const home = normalizeCwdPath(anchors?.home || '');
  if (!home) return null;
  // 跨平台: pathJoin 按 home 的根形态拼 (POSIX '/home' / Windows 'D:'), 不硬编码分隔符
  return { dir: pathJoin(home, '.numas', 'cache'), name: 'session.yaml' };
}

/** 读 session.yaml → SessionUser; 文件不存在/字段缺失返回 null. */
export async function readSessionUser(): Promise<SessionUser | null> {
  const loc = await sessionFileLoc();
  if (!loc) return null;
  try {
    const text = await apiGet<string>(`/api/fs/read/${encodeURIComponent(loc.name)}`, loc.dir);
    if (typeof text !== 'string' || !text) return null;
    return parseSessionYaml(text);
  } catch {
    return null;
  }
}

/** 覆盖写 session.yaml (调用方保证 4 字段齐全). 返回是否写成功. */
export async function writeSessionUser(user: SessionUser): Promise<boolean> {
  const loc = await sessionFileLoc();
  if (!loc) return false;
  try {
    // mkdir -p: header 用 .numas 父目录, path 给 cache (同 headerPath 机制).
    // 父目录/叶子名走 infra/path 工具, 跨平台 (§2.3 禁止手写正则切路径).
    await apiPost('/api/fs/mkdir', { path: pathBase(loc.dir) }, pathDirname(loc.dir));
    await apiPost('/api/fs/write', { path: loc.name, content: bytesToBase64(stringifySessionYaml(user)) }, loc.dir);
    return true;
  } catch {
    return false;
  }
}

/** 生成约定格式的 yaml (user: 下 4 条 `- key: value`). */
export function stringifySessionYaml(user: SessionUser): string {
  const lines = SESSION_USER_KEYS.map((k) => `  - ${k}: ${user[k] ?? ''}`);
  return `user:\n${lines.join('\n')}\n`;
}

/** 解析约定格式的 yaml; 任一字段缺失返回 null (不做通用 yaml 解析, 只认本格式). */
export function parseSessionYaml(text: string): SessionUser | null {
  const found: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*-\s*([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    found[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  const user = {
    userId: found.userId || '',
    token: found.token || '',
    partner: found.partner || '',
    sign: found.sign || '',
  };
  return SESSION_USER_KEYS.every((k) => user[k]) ? user : null;
}
