import React, { useState } from 'react';
import { AppRenderer, getDefaultAppConfig } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';
import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { getBuiltinModules } from './config/modules';
import { appBaseUrl, isBootReady, resolveBoot } from './infra/url';
import { preferences } from './config/preferences';
import { getPreloadedMetadata, preloadExtensionMetadata } from './service/extension';
import type { ExtensionMetadata } from './service/extension';
import { runtimeConfig } from './config/runtime';
import { PlaceholderLayout } from './layouts/PlaceholderLayout';
import './styles/overrides.css';
import './styles/app-shell.css';

/** 槽位模块映射 — 官方能力按需放开, 其余锁空 (vsix 拓展自己装).
 *  占位布局当前仅渲染 main (编辑器 / 无项目时欢迎页); left/bottom 保留配置待新布局重做. */
const layout = {
  [SlotLocation.top]: { modules: [] },
  [SlotLocation.action]: { modules: [] },
  [SlotLocation.left]: { modules: ['@opensumi/ide-explorer'] },
  [SlotLocation.right]: { modules: [] },
  [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
  [SlotLocation.bottom]: { modules: ['@opensumi/ide-terminal-next'] },
  [SlotLocation.extra]: { modules: [] },
};

export const App: React.FC = () => {
  const defaultModules = getDefaultAppConfig().modules || [];
  // metadata 预取单例: 首次渲染时读取缓存 (同步; 若为空由下方 useEffect 拉取).
  const [meta, setMeta] = useState<ExtensionMetadata[]>(() => getPreloadedMetadata());
  // metadata 门控: AppRenderer 内 createApp 只在首次挂载执行一次 (useConstant),
  // 若此时 vsix 元数据未就绪, ClientApp 会永久只剩内置扩展 (线上 vsix 全部失效的根因).
  // 必须等预取落地再挂 AppRenderer; 超时 (请求挂起) 则降级为无 vsix 启动.
  const [metaReady, setMetaReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => { if (alive) setMetaReady(true); }, 8000);
    preloadExtensionMetadata()
      .then((m) => { if (!alive) return; clearTimeout(timer); setMeta(m); setMetaReady(true); })
      .catch(() => { if (!alive) return; clearTimeout(timer); setMetaReady(true); });
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  // 启动门控: 消费 URL ?directory= (一次性) + 探一次 /path 拿 home 锚点后即放开.
  // 未选项目也渲染 (显示「选择项目」空态); /path.directory 仅技术兜底, 不当已选项目.
  const [wsReady, setWsReady] = React.useState<boolean>(() => isBootReady());
  React.useEffect(() => {
    if (wsReady) return;
    let alive = true;
    void resolveBoot().then(() => { if (alive) setWsReady(true); });
    return () => { alive = false; };
  }, [wsReady]);

  // opencode server 健康探测 (5s): 挂了 → codeblitz 全局 loading 覆盖 (阻止一切操作);
  // 恢复 → 自动解除 (不需要 reload; 各组件按需自行重拉).
  const [opencodeDown, setOpencodeDown] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const base = appBaseUrl();
      if (!base) return;
      try {
        const r = await fetch(`${base}/health`, { method: 'GET', cache: 'no-store' });
        if (!cancelled) setOpencodeDown(!r.ok);
      } catch {
        if (!cancelled) setOpencodeDown(true);
      }
    };
    const t = window.setInterval(check, 5000);
    check();
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  const appConfig: IAppRendererProps['appConfig'] = {
    workspaceDir: '/',
    layoutConfig: layout,
    layoutComponent: PlaceholderLayout,
    componentCDNType: 'jsdelivr',
    // 精简 explorer 容器: 移除官方 Outline/OpenedEditor 模块 (只留文件树 section)
    useSimplifyExplorerPanel: true,
    defaultPreferences: preferences,
    extensionMetadata: meta as any,
    modules: [
      ...defaultModules,
      ...getBuiltinModules(),
    ],
  };

  // mount 后兜底: 若预取的 vsix metadata 为空 (fetch 瞬时失败/降级), reload 重试一次.
  // 判定只看预取结果 (__APP_REGISTRY_METADATA__ 是 index 预取同步写入的), 不依赖 DI/时序,
  // 避免误判正常启动. sessionStorage 标记防死循环.
  const verifyExtensionOnLoad = React.useCallback(() => {
    try {
      const CHECK_KEY = '__numas_ext_check_done__';
      if (sessionStorage.getItem(CHECK_KEY)) return;
      const meta = getPreloadedMetadata();
      const hasVsix = meta.some((m) => {
        const p = m.extension?.publisher || '';
        return p && p !== 'kaitian' && p !== 'alex-ext-public';
      });
      if (!hasVsix) {
        sessionStorage.setItem(CHECK_KEY, '1');
        console.warn('[extension] 预取 vsix metadata 为空, reload 重试一次');
        window.location.reload();
      }
    } catch { /* 探测失败忽略, 不误杀 */ }
  }, []);

  if (!wsReady || !metaReady) {
    return (
      <div className="app-boot">
        <div className="app-boot__spinner" aria-hidden />
        <div className="app-boot__text">正在加载工作空间…</div>
      </div>
    );
  }

  return (
    <>
      <AppRenderer
        appConfig={appConfig}
        runtimeConfig={(runtimeConfig ?? {}) as any}
        onLoad={verifyExtensionOnLoad}
      />
      {/* opencode 挂了 → codeblitz 全局 loading 覆盖 (整页锁定, 阻止一切操作; health 恢复后自动解除) */}
      {opencodeDown && (
        <div className="app-global-loading" role="status" aria-live="polite">
          <div className="app-global-loading__box">
            <div className="app-boot__spinner" aria-hidden />
            <div className="app-global-loading__text">
              连接中断, 正在重连
              <span className="app-global-loading__dots" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
