/**
 * service/extension/extension.service.ts
 *
 * ExtensionServiceImpl — DI 单例.
 * bridge: kt-ext 协议 (registry @ :7790) → codeblitz ext host 元数据.
 */

import { Injectable } from '@opensumi/di';
import { BrowserModule, Domain, URI } from '@opensumi/ide-core-browser';
import { StaticResourceContribution, StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { EXT_SCHEME } from '@codeblitzjs/ide-sumi-core/lib/common/constant';

import type { ExtensionMetadata, IExtensionService } from './extension.interface';
import { ExtensionToken } from './extension.interface';
import { appBaseUrl, effectiveCwd } from '../../infra/url';
import { absToRel } from '../../infra/path';

function registryBaseUrl(): string {
  let base = ((window as any).__APP_CONFIG__?.registryBaseUrl || '').trim();
  if (!base) return '';
  // 相对路径 (如 /proxy/7790, 经 opencode 同源反代到容器内 registry) → 归一化为同源绝对 URL:
  // 下游 new URL(base) / 静态资源拼接都需要绝对形态; 绝对 URL (dev 直连 127.0.0.1:7790) 原样保留
  if (base.startsWith('/')) {
    try { base = new URL(base, window.location.origin).toString(); }
    catch { return ''; }
  }
  return base.replace(/\/+$/, '');
}

/** 全部 vsix 市场地址数组 (归一化为绝对 URL, 去尾斜杠): 内置 /extensions 恒有 + --registry 外部追加 (去重). */
function registryBaseUrls(): string[] {
  const cfg = (window as any).__APP_CONFIG__;
  const raw: string[] = Array.isArray(cfg?.registryBaseUrls) && cfg.registryBaseUrls.length
    ? cfg.registryBaseUrls
    : (cfg?.registryBaseUrl ? [cfg.registryBaseUrl] : ['/extensions']);
  const norm = (b: string): string => {
    let x = String(b || '').trim();
    if (!x) return '';
    if (x.startsWith('/')) {
      try { x = new URL(x, window.location.origin).toString(); }
      catch { return ''; }
    }
    return x.replace(/\/+$/, '');
  };
  const out: string[] = [];
  for (const b of raw) {
    const n = norm(b);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.length ? out : [norm('/extensions')];
}

/** 扩展 id → 来源市场 base (metadata 合并时记录; getVsixUrl / 静态资源路由用) */
const sourceByExtId = new Map<string, string>();

/** 本轮拉取失败的源 (重试耗尽仍失败); 后台补拉前清空, 成功后并入缓存. */
const failedSources = new Set<string>();

export function getExtensionSourceBase(name: string): string | undefined {
  return sourceByExtId.get(name);
}

/** 从 metadata.uri 取首段 id (静态资源路径第一段), 如:
 *  `kt-ext:///numas.pdf-0.1.0` → `numas.pdf-0.1.0`; 带 authority 的外部 uri 返回空 (走 authority 分支). */
function metadataUriFirstSegment(uri?: string): string {
  if (!uri || typeof uri !== 'string') return '';
  // 仅无 authority 形态 (kt-ext:///<id>/...) 需要来源映射; 带 host 的外部 uri 由 authority 分支处理
  const m = uri.match(/^kt-ext:\/\/\/([^/]+)/);
  return m ? m[1] : '';
}

/** 拉单个市场的 metadata; 返回 [{ metadata, base }] 便于记录来源. 失败返回空.
 *  端点兼容 (按序尝试):
 *    - `${base}/metadata.json`    内置 /extensions 控制器
 *    - `${base}/metadata`         外部 gateway (registry base 已含 /plugins)
 *    - `${base}/plugins/metadata` 外部 gateway (registry base 到 agent-registry)
 *  指数退避重试 3 次 (1s / 3s / 7s), 容忍启动期源瞬时不可用. */
async function fetchMetadataFromBase(base: string, attempt = 1): Promise<Array<{ metadata: ExtensionMetadata; base: string }>> {
  const endpoints = [`${base}/metadata.json`, `${base}/metadata`, `${base}/plugins/metadata`];
  let lastErr: any = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} (${url})`);
        continue;
      }
      const json = await res.json();
      const arr: any[] = Array.isArray(json) ? json : [];
      // 空数组 = 该端点存在但无扩展 (内置市场空目录场景), 不再试下一个
      return arr.map((m) => ({ metadata: m, base }));
    } catch (e: any) {
      lastErr = e;
    }
  }
  if (attempt < 3) {
    // 指数退避: 第1次失败后等 1s, 第2次等 3s, 第3次等 7s
    const delays = [1000, 3000, 7000];
    await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    return fetchMetadataFromBase(base, attempt + 1);
  }
  console.warn('[extension] registry metadata fetch failed (retried 3x):', base, lastErr?.message || lastErr);
  failedSources.add(base);
  return [];
}

/** 后台补拉循环控制: 避免重入 (已有循环在跑就不重复起) */
let backfillInFlight = false;
let backfillRounds = 0;
const BACKFILL_MAX_ROUNDS = 5;
const BACKFILL_DELAY = 10000;

/** 启动后后台补拉: installMetadata 首轮有源失败 / 整体为空时, 周期重拉失败源,
 *  metadata 从未有到有(或源补齐)后 reload 一次让 ext host 重新快照. 有界, 不无限循环. */
export function scheduleMetadataBackfill(): void {
  if (backfillInFlight) return;
  backfillInFlight = true;
  backfillRounds = 0;
  void (async () => {
    try {
      while (backfillRounds < BACKFILL_MAX_ROUNDS) {
        backfillRounds += 1;
        await new Promise((r) => setTimeout(r, BACKFILL_DELAY));
        const prev = getPreloadedMetadata();
        failedSources.clear(); // 本轮重拉前清空失败标记, 反映最新一轮
        const fresh = await new ExtensionServiceImpl().listMetadata();
        if (fresh.length > 0) {
          (window as any).__APP_REGISTRY_METADATA__ = fresh;
          console.log('[extension] 后台补拉成功:', fresh.length, 'entries, reload 使扩展生效');
          // metadata 从未有到有 → 需要 reload 让 codeblitz ext host 重新读取;
          // 若首轮已有 metadata 仅补源, 不 reload (避免打扰已打开的会话)
          if (prev.length === 0) {
            sessionStorage.setItem('__numas_ext_check_done__', '1');
            window.location.reload();
          }
          return;
        }
        console.warn('[extension] 后台补拉第', backfillRounds, '轮仍空, 继续');
      }
    } finally {
      backfillInFlight = false;
    }
  })();
}

/** metadata 预取 promise (模块级单例): index.tsx 在 React 渲染前 await 一次,
 *  确保 AppRenderer 内 createApp 时 vsix 元数据已在全局缓存, 不再与 /path 赛跑. */
let metadataPromise: Promise<ExtensionMetadata[]> | null = null;
export function preloadExtensionMetadata(): Promise<ExtensionMetadata[]> {
  if (!metadataPromise) {
    metadataPromise = new ExtensionServiceImpl().installMetadata().catch(() => []);
  }
  return metadataPromise;
}

/** 读预取结果 (index.tsx await 完成后必含 vsix; 未 await 时可能是空). */
export function getPreloadedMetadata(): ExtensionMetadata[] {
  const cached = (window as any).__APP_REGISTRY_METADATA__;
  return Array.isArray(cached) ? cached : [];
}

/** kt-ext 静态资源贡献 — 覆盖 codeblitz 默认的 kt-ext→https 解析.
 *  codeblitz 默认把 kt-ext://<host>/<id> 转 https://<host>/<id>; 这里改为直连 registryBaseUrl. */
@Injectable()
@Domain(StaticResourceContribution)
export class RegistryStaticResourceContribution implements StaticResourceContribution {
  registerStaticResolver(service: StaticResourceService): void {
    const base = registryBaseUrl();
    service.registerStaticResourceProvider({
      scheme: EXT_SCHEME,
      resolveStaticResource: (uri) => {
        // uri.authority 有值 = 外部市场资产 (codeblitz 默认市场 alipay CDN 的 vsicons 等):
        // 保留原 host (scheme 跟随 registry 的 https/http), 不能落本地 registry.
        if (uri.authority) {
          const scheme = uri.scheme === 'https' || uri.scheme === 'http'
            ? uri.scheme
            : base.startsWith('https') ? 'https' : 'http';
          return URI.from({ scheme, authority: uri.authority, path: uri.path.toString() });
        }
        // 无 authority = 本地 registry 扩展 (docxreader/html/paper 等):
        // 按扩展来源市场路由 (多市场合并后), 未记录来源用 registryBaseUrl 兜底
        const rel = uri.path.toString().replace(/^\/+/, '');
        const extId = rel.split('/')[0] || '';
        const source = getExtensionSourceBase(extId) || base;
        return URI.parse(`${source}${uri.path.toString()}`);
      },
      roots: registryBaseUrls(),
    });

    // file:// 静态资源 (图片/视频预览等 raw 文件): codeblitz 默认无 file provider → 原样返回
    // file:// 浏览器打不开 (img/video 标签无法带 x-opencode-directory header) → 映射到同源
    // opencode fs API: /api/fs/read/<rel>?directory=<ws> (V2 workspace selector, 返回文件 mime).
    service.registerStaticResourceProvider({
      scheme: 'file',
      resolveStaticResource: (uri) => {
        try {
          const fsPath = (uri as any).codeUri?.path || uri.path?.toString() || '';
          const ws = effectiveCwd();
          const rel = ws ? absToRel(fsPath, ws) : null;
          if (!rel) return uri; // 工作区外: 原样返回 (无同源 API 可直连)
          const origin = appBaseUrl().replace(/\/+$/, '');
          return URI.parse(`${origin}/api/fs/read/${encodeURIComponent(rel)}?directory=${encodeURIComponent(ws)}`);
        } catch {
          return uri;
        }
      },
      roots: [appBaseUrl()],
    });
  }
}

@Injectable()
export class ExtensionServiceImpl implements IExtensionService {
  async listMetadata(): Promise<ExtensionMetadata[]> {
    const bases = registryBaseUrls();
    // 多市场合并: 逐个拉 metadata, 按 extension name 去重 (靠前源优先, 内置 /extensions 在前)
    const merged: ExtensionMetadata[] = [];
    const seen = new Set<string>();
    for (const base of bases) {
      const items = await fetchMetadataFromBase(base);
      for (const { metadata, base: b } of items) {
        const name = metadata?.extension?.name;
        if (!name || seen.has(name)) continue;
        seen.add(name);
        // 来源记录两个 key: metadata.name (扩展名) + uri 首段 id (静态资源路径用, 如 numas.pdf-0.1.0)
        sourceByExtId.set(name, b);
        const uriId = metadataUriFirstSegment(metadata?.uri);
        if (uriId) sourceByExtId.set(uriId, b);
        merged.push(metadata);
      }
    }
    return merged;
  }

  async installMetadata(): Promise<ExtensionMetadata[]> {
    try {
      failedSources.clear();
      const metadata = await this.listMetadata();
      (window as any).__APP_REGISTRY_METADATA__ = metadata;
      console.log('[extension] metadata 拉取 OK:', metadata.length, 'entries:', metadata.map((m) => m.extension.name).join(', '));
      // 有源失败 (重试耗尽) 或整体为空 → 后台周期补拉, 恢复后并入缓存
      if (failedSources.size > 0 || metadata.length === 0) {
        scheduleMetadataBackfill();
      }
      return metadata;
    } catch (e: any) {
      console.warn('[extension] metadata 拉取失败:', e?.message);
      (window as any).__APP_REGISTRY_METADATA__ = [];
      scheduleMetadataBackfill();
      return [];
    }
  }

  getVsixUrl(name: string): string {
    const base = getExtensionSourceBase(name) || registryBaseUrl() || '/extensions';
    return `${base}/vsix/${encodeURIComponent(name)}`;
  }

  isReady(): boolean {
    return !!registryBaseUrl() || registryBaseUrls().length > 0;
  }
}

@Injectable()
export class ExtensionModule extends BrowserModule {
  providers = [
    RegistryStaticResourceContribution,
    { token: ExtensionToken, useClass: ExtensionServiceImpl },
    ExtensionServiceImpl,
  ];
  contributionProvider = [StaticResourceContribution];
}