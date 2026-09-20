/**
 * infra/cookie.ts — 浏览器 cookie 读取 (基础设施层)
 *
 * 分层铁律 (AGENTS §2.2): infra → service → extensions.
 * extensions 禁止直接 import 本文件, 必须经 service (DI 注入) 消费.
 *
 * 只提供读: 登录态由外部宿主 (门户/网关) 通过 cookie 下发, numas 侧不写 cookie.
 */

/** 读单个 cookie 值 (已 decodeURIComponent); 不存在或空返回 ''. */
export function getCookie(name: string): string {
  if (typeof document === 'undefined' || !name) return '';
  const target = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const item = part.trim();
    if (!item.startsWith(target)) continue;
    const raw = item.slice(target.length);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
}

/** 批量读 cookie, 返回 name → value (缺失为 ''). */
export function getCookies<K extends string>(names: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const n of names) out[n] = getCookie(n);
  return out;
}
