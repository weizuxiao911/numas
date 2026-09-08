/**
 * Chatbot — Numas SOLO 模式 composer 槽 UI (vsix 拓展实现的 React 组件)
 *
 * 装 SOLO_SLOTS.Composer (自定义 slot 'composer', 见 config/slots.ts).
 * 当前留空: 只渲染容器 + 主题样式注入, 不写死内容 (标题/快捷按钮/输入框等).
 * 后续按一功能一组件原则逐个填: 输入框 / 模式 tab / 建议 / 消息流 / 附件 / 模型选择 / 发送.
 */

import React from 'react';

import { styles } from './styles';

export const ChatbotMain: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-chatbot" />
    </>
  );
};
