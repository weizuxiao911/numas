/**
 * Sessions 拓展 — extensions/sessions/
 *
 * 业务承载: SOLO 左列容器区 (新建会话 + 历史会话列表).
 * 装 solo.sidebar.container slot (字符串即协议, 不 import config/).
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { Sessions } from './Sessions';

export const SESSIONS_PANEL_ID = 'sessions';
/** 跟 config/slots.ts SOLO_SLOTS.SidebarContainer 同值 */
const TARGET_SLOT = 'solo.sidebar.container';

@Injectable()
@Domain(ComponentContribution)
export class SessionsContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      SESSIONS_PANEL_ID,
      { id: SESSIONS_PANEL_ID, component: Sessions },
      { containerId: SESSIONS_PANEL_ID, iconClass: 'codicon codicon-history', title: '历史会话' },
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class SessionsModule extends BrowserModule {
  providers = [SessionsContribution];
  contributionProvider = ComponentContribution;
}
