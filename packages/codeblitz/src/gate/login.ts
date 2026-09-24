/**
 * gate/login.ts — 访问门槛: 未登录跳转登录页
 *
 * 仅独立部署 (:7788 等) 生效: 编译期经 DefinePlugin 注入 __APP_LOGIN_REDIRECT__
 * (来自 .env.{DEPLOY_ENV} 的 LOGIN_REDIRECT). 未注入 (桌面/CLI/内嵌/本地 dev) → 不门槛.
 *
 * 判定: cookie 无 `token` 且无 `authorization` → 未登录.
 * 跳转: `{LOGIN_REDIRECT}{encodeURIComponent(当前URL)}`
 *   例: https://beta.cloudlab.top/login?redirect=http%3A%2F%2Fhost%3A7788%2F
 *
 * 部署与登录页同根域名 (cloudlab.top), 故只做跳转, 不涉及跨域.
 */

import { getCookie } from '../infra/cookie';

/** 编译期注入的登录地址前缀 (含 `?redirect=`); 未配置为 '' */
declare const __APP_LOGIN_REDIRECT__: string;

/** 是否已登录: cookie 有 token 或 authorization 即视为已登录. */
export function isLoggedIn(): boolean {
  return !!getCookie('token') || !!getCookie('authorization');
}

/** 未登录则跳转登录页 (带 redirect=自身URL). 应在渲染前调用. */
export function enforceLogin(): void {
  const base = typeof __APP_LOGIN_REDIRECT__ === 'string' ? __APP_LOGIN_REDIRECT__ : '';
  if (!base || isLoggedIn()) return;
  if (typeof window === 'undefined') return;
  const here = window.location.href;
  window.location.replace(`${base}${encodeURIComponent(here)}`);
}
