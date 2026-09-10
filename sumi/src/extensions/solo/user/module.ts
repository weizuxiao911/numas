/**
 * User 拓展 — extensions/solo/user/
 *
 * 业务承载: SOLO sidebar 底部左侧用户信息 (头像 + 昵称, 登录入口).
 * slot 装填: 'user' (跟 config/slots.ts SOLO_SLOTS.SidebarFooter 同值, 协议约定非模块引用).
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { UserBar } from './UserBar';

export const USER_PANEL_ID = 'user';
const TARGET_SLOT = 'solo.sidebar.footer';

@Injectable()
@Domain(ComponentContribution)
export class UserContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      USER_PANEL_ID,
      {
        id: USER_PANEL_ID,
        component: UserBar,
      },
      {
        containerId: USER_PANEL_ID,
        iconClass: 'codicon codicon-account',
        title: '用户',
      },
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class UserModule extends BrowserModule {
  providers = [UserContribution];
  contributionProvider = ComponentContribution;
}
