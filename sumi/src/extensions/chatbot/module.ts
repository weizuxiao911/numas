/**
 * Chatbot 拓展 — extensions/chatbot/
 *
 * 装 SOLO 模式 Main 槽 (自定义 slot 'main', 见 config/slots.ts).
 * 对话主区: 消息流 + 输入区 (顶栏已拆到 extensions/action).
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { ChatbotMain } from './ChatbotMain';
import { SOLO_SLOTS } from '../../config/slots';

export const CHATBOT_PANEL_ID = 'chatbot';

@Injectable()
@Domain(ComponentContribution)
export class ChatbotContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      CHATBOT_PANEL_ID,
      {
        id: CHATBOT_PANEL_ID,
        component: ChatbotMain,
      },
      {
        containerId: CHATBOT_PANEL_ID,
        iconClass: 'codicon codicon-comment-discussion',
        title: '对话',
      },
      SOLO_SLOTS.Main,
    );
  }
}

@Injectable()
export class ChatbotModule extends BrowserModule {
  providers = [ChatbotContribution];
  contributionProvider = ComponentContribution;
}
