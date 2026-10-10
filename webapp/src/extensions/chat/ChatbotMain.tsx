/**
 * Chatbot — Numas SOLO 模式 main 槽 UI (vsix 拓展实现的 React 组件)
 *
 * 装 SOLO_SLOTS.MainContainer (自定义 slot 'chatbot', 见 config/slots.ts),
 * 位于中列, action (顶部工具栏) 下方.
 *
 * 只承载对话主区 (ChatbotView: 消息流 + 输入区).
 * 顶栏 (模式切换 / sidebar 展开 / 项目选择) 已拆到 extensions/action.
 *
 * 布局: 宽度 75% 居中 — 宽屏下不让消息/输入框拉满整屏 (阅读行长过长),
 *   窄屏 (< 900px) 退回 100% + 20px 内边距.
 */

import React from 'react';

import { styles } from './styles';
import { ChatbotView } from './webview/ChatbotView';

export const ChatbotMain: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-chatbot">
        <div className="app-chatbot__container">
          <ChatbotView />
        </div>
      </div>
    </>
  );
};
