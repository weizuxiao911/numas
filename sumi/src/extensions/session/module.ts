/**
 * Session 拓展 — extensions/session/
 *
 * 装 left 槽, 显示会话列表 (新建 / 最近 / 分组).
 * 跟 Chat 拓展解耦: 后续 chatbot agent 走 extensions/chatbot/, session 走这里.
 *
 * 业务接入:
 *   - 持久化: 后续接 session storage (DI 提供, 走 service 层)
 *   - 切换: 点 session 派发 command, chatbot 主区接 command 重新加载
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule, SlotLocation } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { SessionList } from './SessionList';

@Injectable()
@Domain(ComponentContribution)
export class SessionContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      'session-list',
      {
        id: 'session-list',
        component: SessionList,
      },
      {
        containerId: 'session-list',
        iconClass: 'codicon codicon-history',
        title: '会话',
      },
      SlotLocation.left,
    );
  }
}

@Injectable()
export class SessionModule extends BrowserModule {
  providers = [SessionContribution];
  contributionProvider = ComponentContribution;
}
