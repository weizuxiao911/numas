import React, { useState } from 'react';
import { AppRenderer, getDefaultAppConfig } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';
import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { getBuiltinModules } from './config/modules';
import { preferences } from './config/preferences';
import { ExtensionServiceImpl } from './service/extension';
import type { ExtensionMetadata } from './service/extension';
import { runtimeConfig } from './config/runtime';
import { SIDEBAR_PANEL_ID } from './extensions/sidebar';
import { ACTION_PANEL_ID } from './extensions/action';
import { CHATBOT_PANEL_ID } from './extensions/chatbot';
import { SETTINGS_PANEL_ID } from './extensions/settings';
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

/** SOLO 模式 — 自定义 slot (config/slots.ts), panels 冷启动展开 dashboard + action + chatbot */
const SOLO_MODE = {
  layout,
  panels: {
    [SOLO_SLOTS.Sidebar]: SIDEBAR_PANEL_ID,
    [SOLO_SLOTS.Action]: ACTION_PANEL_ID,
    [SOLO_SLOTS.Main]: CHATBOT_PANEL_ID,
    [SOLO_SLOTS.Settings]: SETTINGS_PANEL_ID,
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

  return (
    <AppRenderer
      appConfig={appConfig}
      runtimeConfig={(runtimeConfig ?? {}) as any}
    />
  );
};
