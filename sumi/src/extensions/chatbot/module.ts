/**
 * Chatbot 拓展 — extensions/chatbot/
 *
 * 业务承载: SOLO 模式对话主区 (ChatbotView: 消息流 + 输入区).
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

import { ChatbotMain } from './ChatbotMain';

export const CHATBOT_PANEL_ID = 'chatbot';
/** 我要装到 'main' slot (跟 config/slots.ts SOLO_SLOTS.Main 同值) */
const TARGET_SLOT = 'main';

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
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class ChatbotModule extends BrowserModule {
  providers = [ChatbotContribution];
  contributionProvider = ComponentContribution;
}
