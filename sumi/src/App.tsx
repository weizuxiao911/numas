import React, { useState } from 'react';
import { AppRenderer, getDefaultAppConfig } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';
import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { getBuiltinModules } from './config/modules';
import { isBootReady, resolveBoot } from './infra/url';
import { preferences } from './config/preferences';
import { ExtensionServiceImpl } from './service/extension';
import type { ExtensionMetadata } from './service/extension';
import { runtimeConfig } from './config/runtime';
import { SIDE_TOPBAR_PANEL_ID } from './extensions/solo/sideTopbar';
import { SESSIONS_PANEL_ID } from './extensions/solo/sessions';
import { ACTION_PANEL_ID } from './extensions/solo/action';
import { CHATBOT_PANEL_ID } from './extensions/solo/chatbot';
import { USER_PANEL_ID } from './extensions/solo/user';
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

/** 全锁槽位 — 不让 codeblitz 装默认 module, vsix 拓展自己装 */
const layout = {
  [SlotLocation.top]: { modules: [] },
  [SlotLocation.action]: { modules: [] },
  [SlotLocation.left]: { modules: [] },
  [SlotLocation.right]: { modules: [] },
  [SlotLocation.main]: { modules: [] },
  [SlotLocation.bottom]: { modules: [] },
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
  const [meta, setMeta] = useState<ExtensionMetadata[]>([]);

  React.useEffect(() => {
    const svc = new ExtensionServiceImpl();
    svc.installMetadata().then(setMeta);
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
    defaultPreferences: preferences,
    extensionMetadata: meta as any,
    modules: [
      ...defaultModules,
      ...getBuiltinModules(),
    ],
  };

  if (!wsReady) {
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
    />
  );
};
