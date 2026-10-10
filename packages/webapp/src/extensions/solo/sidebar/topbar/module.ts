/**
 * SideTopbar 拓展 — extensions/side-topbar/
 *
 * 业务承载: SOLO 左列顶部活动栏 (模式切换 + sidebar 折叠).
 * 装 solo.sidebar.action slot (字符串即协议, 不 import config/).
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { SideTopbar } from './SideTopbar';

export const SIDE_TOPBAR_PANEL_ID = 'side-topbar';
/** 跟 config/slots.ts SOLO_SLOTS.SidebarAction 同值 */
const TARGET_SLOT = 'solo.sidebar.action';

@Injectable()
@Domain(ComponentContribution)
export class SideTopbarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      SIDE_TOPBAR_PANEL_ID,
      { id: SIDE_TOPBAR_PANEL_ID, component: SideTopbar },
      { containerId: SIDE_TOPBAR_PANEL_ID, iconClass: 'codicon codicon-layout', title: '活动栏' },
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class SideTopbarModule extends BrowserModule {
  providers = [SideTopbarContribution];
  contributionProvider = ComponentContribution;
}
