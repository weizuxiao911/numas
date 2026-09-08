/**
 * Chatbot 拓展 — extensions/chatbot/
 *
 * 业务承载: SOLO 模式对话主区 (ChatbotView: 消息流 + 输入区).
 *
 * slot 装填 (vscode 模型):
 *   - slot 是全局的, 给拓展插入的 (定义在 config/slots.ts)
 *   - 拓展不引 config/, 直接以字符串声明要装哪个 slot
 *   - 字符串字面量跟 SOLO_SLOTS 同值, 是协议约定, 不是模块引用
 *
 * 跨拓展契约 (AGENTS §2.2 / 总体设计 §3.1 规则 4):
 *   - 全局命令 numas.chatbot.newSession: 其他拓展 (如 sidebar) 用
 *     CommandService.executeCommand('numas.chatbot.newSession') 触发新建会话,
 *     不 import 本拓展内部实现. execute 时经 getChatPanelApi() 取当前注册的
 *     ChatbotView 能力 (mount 前为 null → no-op).
 */
import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { ChatbotMain } from './ChatbotMain';
import { getChatPanelApi } from './commands/chatApi';

export const CHATBOT_PANEL_ID = 'chatbot';
/** 我要装到 'main' slot (跟 config/slots.ts SOLO_SLOTS.Main 同值) */
const TARGET_SLOT = 'main';

/** 全局命令 id (跨拓展, 供 executeCommand 调用) */
export const CHATBOT_COMMANDS = {
  newSession: { id: 'numas.chatbot.newSession', label: '新建会话' },
  listSessions: { id: 'numas.chatbot.listSessions', label: '历史会话列表' },
  changeSession: { id: 'numas.chatbot.changeSession', label: '切换会话' },
  deleteSession: { id: 'numas.chatbot.deleteSession', label: '删除会话' },
  getCurrentSessionID: { id: 'numas.chatbot.getCurrentSessionID', label: '当前会话 id' },
} as const;

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
@Domain(CommandContribution)
export class ChatbotCommandContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CHATBOT_COMMANDS.newSession, {
      execute: () => getChatPanelApi()?.newSession(),
    });
    commands.registerCommand(CHATBOT_COMMANDS.listSessions, {
      execute: () => getChatPanelApi()?.listSessions() ?? Promise.resolve([]),
    });
    commands.registerCommand(CHATBOT_COMMANDS.changeSession, {
      execute: (sid: string) => getChatPanelApi()?.changeSession(sid),
    });
    commands.registerCommand(CHATBOT_COMMANDS.deleteSession, {
      execute: (sid: string) => getChatPanelApi()?.deleteSession(sid),
    });
    commands.registerCommand(CHATBOT_COMMANDS.getCurrentSessionID, {
      execute: () => getChatPanelApi()?.getCurrentSessionID?.() ?? '',
    });
  }
}

@Injectable()
export class ChatbotModule extends BrowserModule {
  providers = [ChatbotContribution, ChatbotCommandContribution];
  contributionProvider = [ComponentContribution, CommandContribution];
}
