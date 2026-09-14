/**
 * 系统机制初始化 — core/config/app.ts
 *
 * 模块加载时（App 渲染前, index.tsx import）完成全局机制挂载:
 *   - window.__APP_CONFIG__: 编译期注入配置（opencode/registry 地址, 其余协议地址由 agent runtime 注入）
 */

import { APP_CHAT_CONFIG } from './brand';
import { WORKSPACE_ROOT } from '@codeblitzjs/ide-core';

declare const __APP_BASE_URL__: string;
declare const __APP_REGISTRY_BASE_URL__: string;
declare const __APP_DEPLOY_ENV__: string;

export interface AppConfig {
  appBaseUrl: string;
  registryBaseUrl: string;
  /** 全部 vsix 市场地址数组 (内置 /extensions 恒有 + --registry 外部若配追加, 去重) */
  registryBaseUrls: string[];
  deployEnv: string;
  workspaceDir: string;
  theme: string;
  chatConfig: typeof APP_CHAT_CONFIG;
  /** 子域端口代理域名 (opencode --domain-proxy 运行时注入); 空 = 走 /proxy/<port>/ 路径式反代 */
  domainProxy?: string;
}

function buildAppConfig(): AppConfig {
  // 运行时注入优先 (opencode serve/web 渲染时注入 __APP_CONFIG__.registryBaseUrl / domainProxy 等), 兜底编译期
  const injected = (window as any).__APP_CONFIG__ || {};
  // 多源市场数组: 运行时注入优先, 兜底 = [registryBaseUrl] (含默认 /extensions)
  const injectedUrl = injected.registryBaseUrl || __APP_REGISTRY_BASE_URL__ || '';
  const urls = Array.isArray(injected.registryBaseUrls) && injected.registryBaseUrls.length
    ? (injected.registryBaseUrls as string[])
    : injectedUrl
      ? [injectedUrl]
      : [];
  // 去重 (相对路径 → 同源绝对, 去尾斜杠 在扩展服务消费时做)
  const deduped = urls.filter((u, i) => u && urls.indexOf(u) === i);
  // 内置 /extensions 恒有 (与 server 注入语义一致: 默认内置市场 + --registry 外部合并)
  const hasBuiltin = deduped.some((u) => u === '/extensions' || /\/extensions\/?$/.test(u));
  const registryBaseUrls = hasBuiltin ? deduped : ['/extensions', ...deduped];
  return {
    appBaseUrl: injected.appBaseUrl || __APP_BASE_URL__ || '',
    registryBaseUrl: injectedUrl || '',
    registryBaseUrls,
    deployEnv: injected.deployEnv || __APP_DEPLOY_ENV__ || 'development',
    workspaceDir: WORKSPACE_ROOT,
    theme: 'opensumi-design-dark-theme',
    chatConfig: APP_CHAT_CONFIG,
    domainProxy: injected.domainProxy || '',
  };
}

(window as any).__APP_CONFIG__ = buildAppConfig();