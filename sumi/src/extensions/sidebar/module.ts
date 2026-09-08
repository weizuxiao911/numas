/**
 * Sidebar 拓展 — extensions/sidebar/
 *
 * 业务承载: Numas 首页 (品牌 + 当前项目 + 近期项目).
 *
 * 数据源:
 *   - 当前项目: localStorage APP_CWD (跟 service/env 一致)
 *   - 近期项目: localStorage 'numas.recent.projects'
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

import { Sidebar } from './Sidebar';

export const SIDEBAR_PANEL_ID = 'sidebar';
/** 我要装到 'sidebar' slot (跟 config/slots.ts SOLO_SLOTS.Sidebar 同值) */
const TARGET_SLOT = 'sidebar';

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
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class SidebarModule extends BrowserModule {
  providers = [SidebarContribution];
  contributionProvider = ComponentContribution;
}
