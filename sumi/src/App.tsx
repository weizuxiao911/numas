/**
 * App — src/App.tsx
 *
 * 顶层布局 (React):
 *   - 装 codeblitz AppRenderer (一个容器, 内部所有交互由 vsix 拓展实现)
 *   - chat 模式: layoutConfig 全空 modules, 不装 codeblitz 默认 slot (menubar / explorer / editor / terminal).
 *     vsix 拓展 (session / chatbot) 走 ComponentContribution 自动装到 left / main 槽.
 *   - workspace 模式: 不传 layoutConfig, 走 codeblitz 默认 IDE 5 槽位.
 *
 * 实现机制: vsix / opensumi ComponentContribution 把 React 组件注册到 codeblitz slot.
 * 业务 UI 全部走 vsix 拓展. React 顶层只决定是否传 layoutConfig / defaultPanels.
 */

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
import './styles/overrides.css';

type Mode = 'chat' | 'workspace';

/**
 * chat 模式 layoutConfig: 所有槽位 modules 空, 阻止 codeblitz 装默认 slot.
 * 业务 UI 由 vsix ComponentContribution 装 (session → left, chatbot → main).
 */
const CHAT_LAYOUT: IAppRendererProps['appConfig']['layoutConfig'] = {
  [SlotLocation.top]: { modules: [] },
  [SlotLocation.action]: { modules: [] },
  [SlotLocation.left]: { modules: [] },
  [SlotLocation.right]: { modules: [] },
  [SlotLocation.main]: { modules: [] },
  [SlotLocation.bottom]: { modules: [] },
  [SlotLocation.extra]: { modules: [] },
} as any;

/**
 * chat 模式 defaultPanels: 冷启动展开 session sidebar (left) + chatbot main (主区).
 */
const CHAT_DEFAULT_PANELS: IAppRendererProps['appConfig']['defaultPanels'] = {
  [SlotLocation.left]: 'session-list',
  [SlotLocation.main]: 'chatbot-main',
} as any;

export const App: React.FC = () => {
  const [mode] = useState<Mode>('chat');
  const defaultModules = getDefaultAppConfig().modules || [];
  const [meta, setMeta] = useState<ExtensionMetadata[]>([]);

  React.useEffect(() => {
    const svc = new ExtensionServiceImpl();
    svc.installMetadata().then(setMeta);
  }, []);

  const isChat = mode === 'chat';

  const appConfig: IAppRendererProps['appConfig'] = {
    workspaceDir: '/',
    layoutConfig: isChat ? CHAT_LAYOUT : undefined,
    defaultPanels: isChat ? CHAT_DEFAULT_PANELS : undefined,
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
