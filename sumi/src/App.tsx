import React, { useState } from 'react';
import { AppRenderer, getDefaultAppConfig } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';
import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { getBuiltinModules } from './config/modules';
import { isBootReady, resolveBoot } from './infra/url';
import { preferences } from './config/preferences';
import { getPreloadedMetadata, preloadExtensionMetadata } from './service/extension';
import type { ExtensionMetadata } from './service/extension';
import { runtimeConfig } from './config/runtime';
import { SIDE_TOPBAR_PANEL_ID } from './extensions/solo/sideTopbar';
import { SESSIONS_PANEL_ID } from './extensions/solo/sessions';
import { ACTION_PANEL_ID } from './extensions/solo/action';
import { CHATBOT_PANEL_ID } from './extensions/solo/chatbot';
import { USER_PANEL_ID } from './extensions/solo/user';
import { ASIDE_TOPBAR_PANEL_ID } from './extensions/solo/asideTopbar';
import { ASIDE_BROWSER_PANEL_ID } from './extensions/browser';
import { SOLO_SLOTS } from './config/slots';
import { IdeLayout } from './layouts/IdeLayout';
import { SoloLayout } from './layouts/SoloLayout';
import './styles/overrides.css';
import './styles/app-shell.css';

/**
 * 全局模式开关 — App.tsx 唯一事实源, 运行时可改
 *
 *   'solo' 单栏对话 (dashboard sidebar + chatbot composer, 自定义 slot)
 *   'ide'  完整开发 (codeblitz 标准 SlotLocation: top/left/main/...)
 *
 * 用法:
 *   - 改默认值: 改下面 _appMode 初始值
 *   - 运行时改:  setAppMode('ide') — App 自动重渲染 (走 window 'app-mode-change' 事件)
 *   - devtools:    window.__appSetMode('ide')
 */
export type AppMode = 'solo' | 'ide';
let _appMode: AppMode = 'solo';
export const getAppMode = (): AppMode => _appMode;
export const setAppMode = (m: AppMode): void => {
  if (_appMode === m) return;
  _appMode = m;
  window.dispatchEvent(new CustomEvent('app-mode-change'));
};

/** 槽位模块映射 — 官方能力按需放开, 其余锁空 (vsix 拓展自己装).
 *  - left: 官方 explorer 容器 (查看模式 aside.sidebar 渲染)
 *  - main: 官方编辑器 workbench (查看模式 aside.container 渲染; IDE 模式主区)
 *  - bottom: 官方终端 (solo 终端模式在 aside 中间渲染) */
const layout = {
  [SlotLocation.top]: { modules: [] },
  [SlotLocation.action]: { modules: [] },
  [SlotLocation.left]: { modules: ['@opensumi/ide-explorer'] },
  [SlotLocation.right]: { modules: [] },
  [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
  [SlotLocation.bottom]: { modules: ['@opensumi/ide-terminal-next'] },
  [SlotLocation.extra]: { modules: [] },
};

/** SOLO 模式 — 自定义 slot (config/slots.ts), panels 冷启动展开左列/中列各段 */
const SOLO_MODE = {
  layout,
  panels: {
    [SOLO_SLOTS.SidebarAction]: SIDE_TOPBAR_PANEL_ID,
    [SOLO_SLOTS.SidebarContainer]: SESSIONS_PANEL_ID,
    [SOLO_SLOTS.SidebarFooter]: USER_PANEL_ID,
    [SOLO_SLOTS.MainAction]: ACTION_PANEL_ID,
    [SOLO_SLOTS.MainContainer]: CHATBOT_PANEL_ID,
    [SOLO_SLOTS.AsideAction]: ASIDE_TOPBAR_PANEL_ID,
    [SOLO_SLOTS.AsideBrowser]: ASIDE_BROWSER_PANEL_ID,
  },
};

/** IDE 模式 — 标准 SlotLocation, 不预设展开任何 panel */
const IDE_MODE = {
  layout,
  panels: {},
};

const MODES: Record<AppMode, { layout: any; panels: any }> = {
  solo: SOLO_MODE,
  ide: IDE_MODE,
};

const LAYOUTS: Record<AppMode, React.ComponentType> = {
  solo: SoloLayout,
  ide: IdeLayout,
};

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(() => getAppMode());
  const defaultModules = getDefaultAppConfig().modules || [];
  // metadata 预取单例: index.tsx 渲染前已发起, 这里读全局缓存 (同步, 不再重复 fetch).
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

  React.useEffect(() => {
    const onChange = (): void => setMode(getAppMode());
    window.addEventListener('app-mode-change', onChange);
    return () => window.removeEventListener('app-mode-change', onChange);
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

  const cfg = MODES[mode];
  const Layout = LAYOUTS[mode];

  const appConfig: IAppRendererProps['appConfig'] = {
    workspaceDir: '/',
    layoutConfig: cfg?.layout,
    layoutComponent: Layout,
    defaultPanels: cfg?.panels,
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
    <AppRenderer
      appConfig={appConfig}
      runtimeConfig={(runtimeConfig ?? {}) as any}
      onLoad={verifyExtensionOnLoad}
    />
  );
};
