/**
 * Chatbot 拓展 — extensions/chatbot/
 *
 * 装 main 槽, 显示 chat 主区 (大标题 + tab + 建议 + 输入框).
 * 跟 Chat 拓展解耦: 这里只装 UI 骨架, 业务接 agent 后端 (走 service/opencode 拿数据).
 *
 * 业务接入:
 *   - 后续接 numas session / opencode prompt API
 *   - 输入框 onSend 派发 command (例: chatbot.send), session 拓展监听
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule, SlotLocation } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { ChatbotMain } from './ChatbotMain';

@Injectable()
@Domain(ComponentContribution)
export class ChatbotContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      'chatbot-main',
      {
        id: 'chatbot-main',
        component: ChatbotMain,
      },
      {
        containerId: 'chatbot-main',
        iconClass: 'codicon codicon-comment-discussion',
        title: '对话',
      },
      SlotLocation.main,
    );
  }
}

@Injectable()
export class ChatbotModule extends BrowserModule {
  providers = [ChatbotContribution];
  contributionProvider = ComponentContribution;
}
