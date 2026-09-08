/**
 * bootstrap/ext-metadata.ts
 *
 * 启动期拉取 registry 拓展元数据 (registry @ :7790 /metadata.json).
 * 失败 / 无 registry 时返空数组, 不阻塞首帧.
 */

import { ExtensionServiceImpl } from '../service/extension';

export interface BootstrapMetadata {
  extensionMetadata: any[];
}

let cached: Promise<BootstrapMetadata> | null = null;

export function bootstrapExtMetadata(): Promise<BootstrapMetadata> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const svc = new ExtensionServiceImpl();
      const metadata = await svc.installMetadata();
      return { extensionMetadata: metadata };
    } catch {
      return { extensionMetadata: [] };
    }
  })();
  return cached;
}
