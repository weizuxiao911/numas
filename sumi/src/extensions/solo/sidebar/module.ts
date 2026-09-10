/**
 * Sidebar 拓展 — extensions/solo/sidebar/
 *
 * 业务承载: SOLO 左列 (sidebar) 两段:
 *   - solo.sidebar.action:    顶部活动栏 (模式切换 + 折叠)
 *   - solo.sidebar.container: 容器区 (新建会话 + 历史会话列表)
 * 底部栏 (solo.sidebar.footer) 由 user 拓展提供.
 *
 * slot 装填 (vscode 模型):
 *   - slot 是全局的, 给拓展插入的 (定义在 config/slots.ts)
 *   - 拓展不引 config/, 直接以字符串声明要装哪个 slot
 *   - 字符串字面量跟 SOLO_SLOTS 同值, 是协议约定, 不是模块引用
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { Sidebar, SidebarAction } from './Sidebar';

export const SIDEBAR_PANEL_ID = 'sidebar';
export const SIDEBAR_ACTION_PANEL_ID = 'sidebar-action';
/** 跟 config/slots.ts SOLO_SLOTS 同值 (协议约定, 非模块引用) */
const SIDEBAR_CONTAINER_SLOT = 'solo.sidebar.container';
const SIDEBAR_ACTION_SLOT = 'solo.sidebar.action';

@Injectable()
@Domain(ComponentContribution)
export class SidebarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      SIDEBAR_ACTION_PANEL_ID,
      {
        id: SIDEBAR_ACTION_PANEL_ID,
        component: SidebarAction,
      },
      {
        containerId: SIDEBAR_ACTION_PANEL_ID,
        iconClass: 'codicon codicon-layout',
        title: '活动栏',
      },
      SIDEBAR_ACTION_SLOT,
    );
    registry.register(
      SIDEBAR_PANEL_ID,
      {
        id: SIDEBAR_PANEL_ID,
        component: Sidebar,
      },
      {
        containerId: SIDEBAR_PANEL_ID,
        iconClass: 'codicon codicon-home',
        title: '首页',
      },
      SIDEBAR_CONTAINER_SLOT,
    );
  }
}

@Injectable()
export class SidebarModule extends BrowserModule {
  providers = [SidebarContribution];
  contributionProvider = ComponentContribution;
}
