/**
 * infra/repo.ts — 远程仓库 (repo) 归一化 + 项目关联判定 (节点 1).
 *
 * 职责: URL 携带 `?repo=` (原仓库地址) 时, 判断当前选中的 workdir 项目是否
 * 是该 repo 的衍生项目 (宽松口径: workdir 的任意 git remote 归一化后 == repo).
 * 归一化规则与 opencode core `Project.url()` 一致:
 *   https://github.com/antgroup/vsag.git  →  github.com/antgroup/vsag
 *   git@github.com:antgroup/vsag.git     →  github.com/antgroup/vsag
 */

import { apiGet } from './http';

/** 归一化远程仓库地址 (host + 路径, 去协议/去 .git/去尾斜杠). 无法解析返回 '' */
export function normalizeRepoUrl(raw: string): string {
  const value = (raw || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'file:') return '';
    const pathname = parsed.pathname
      .replace(/^\/+/, '')
      .replace(/\.git\/?$/, '')
      .replace(/\/+$/, '');
    if (!parsed.hostname || !pathname) return '';
    return `${parsed.hostname.toLowerCase()}/${pathname}`;
  } catch {
    // scp 风格: git@github.com:antgroup/vsag.git
    const m = value.match(/^([^@/:]+@)?([^/:]+):(.+)$/);
    if (m) {
      const pathname = m[3].replace(/\.git\/?$/, '').replace(/\/+$/, '');
      if (!m[2] || !pathname) return '';
      return `${m[2].toLowerCase()}/${pathname}`;
    }
    return '';
  }
}

/** 宽松匹配: 目标 repo 归一化后, 与任意 remote url 归一化结果相等. */
function matchesRepo(remotes: Array<{ name: string; url: string }>, repoUrl: string): boolean {
  const target = normalizeRepoUrl(repoUrl);
  if (!target) return false;
  return remotes.some((r) => normalizeRepoUrl(r.url) === target);
}

/**
 * 取当前 workdir 项目的 git remotes (走 opencode /project/current/remotes,
 * header 自动带当前 workdir). 返回 [] = 非 git 或读取失败.
 */
export async function fetchWorkdirRemotes(): Promise<Array<{ name: string; url: string }>> {
  try {
    const data = await apiGet<Array<{ name: string; url: string }>>('/project/current/remotes');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 节点 1: 判断当前 workdir 是否与目标 repo 关联 (宽松口径).
 *  true = 关联 (保留项目); false = 不关联 (应重置回未选择).
 *  任何读取失败 / 非 git 一律视为不关联 (保守重置, 避免旧项目误导).
 */
export async function isWorkdirLinkedToRepo(repoUrl: string): Promise<boolean> {
  const remotes = await fetchWorkdirRemotes();
  return matchesRepo(remotes, repoUrl);
}
