/**
 * Sidebar 拓展 — extensions/sidebar/
 *
 * 装 SOLO 模式 Sidebar 槽 (自定义 slot 'sidebar', 见 config/slots.ts).
 * 显示 Numas 首页: 品牌 + 当前项目 + 近期项目.
 *
 * 数据源:
 *   - 当前项目: localStorage APP_CWD (跟 service/env 一致)
 *   - 近期项目: localStorage 'numas.recent.projects'
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { Sidebar } from './Sidebar';
import { SOLO_SLOTS } from '../../config/slots';

export const SIDEBAR_PANEL_ID = 'sidebar';

@Injectable()
@Domain(ComponentContribution)
export class SidebarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
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
      SOLO_SLOTS.Sidebar,
    );
  }
}

@Injectable()
export class SidebarModule extends BrowserModule {
  providers = [SidebarContribution];
  contributionProvider = ComponentContribution;
}
