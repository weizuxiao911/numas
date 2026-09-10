/**
 * AsideTopbar 拓展 — extensions/solo/asideTopbar/
 *
 * 业务承载: SOLO 右列顶部活动栏 (胶囊: 查看 | 终端 | 浏览器).
 * 装 solo.aside.action slot (字符串即协议, 不 import config/).
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { AsideTopbar } from './AsideTopbar';

export const ASIDE_TOPBAR_PANEL_ID = 'aside-topbar';
/** 跟 config/slots.ts SOLO_SLOTS.AsideAction 同值 */
const TARGET_SLOT = 'solo.aside.action';

@Injectable()
@Domain(ComponentContribution)
export class AsideTopbarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      ASIDE_TOPBAR_PANEL_ID,
      { id: ASIDE_TOPBAR_PANEL_ID, component: AsideTopbar },
      { containerId: ASIDE_TOPBAR_PANEL_ID, iconClass: 'codicon codicon-panel-right', title: '右列活动栏' },
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class AsideTopbarModule extends BrowserModule {
  providers = [AsideTopbarContribution];
  contributionProvider = ComponentContribution;
}
