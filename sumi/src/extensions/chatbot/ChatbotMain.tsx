/**
 * Chatbot — Numas SOLO 模式 composer 槽 UI (vsix 拓展实现的 React 组件)
 *
 * 装 SOLO_SLOTS.Composer (自定义 slot 'composer', 见 config/slots.ts).
 *
 * 布局: 上下结构
 *   - header: 顶部栏, 100% 宽 (跟 composer 等宽), 后续装对话标题 / 模型选择 / 操作按钮
 *   - container: 主区, 左右内边距 ≥ 20px, 后续装消息流 / 输入框
 *
 * 折叠态 sidebar 行为: header 镜像 sidebar 顶的 mode-switch + expand 按钮 (替代 sidebar 内部 mode-row 不可见).
 *   折叠态时, sidebar 整个被压到 1px, mode-row 被隐藏. 跨拓展状态共享走
 *   sidebar/commands/sidebarApi (跟 chat 拓展的 chatApi.ts 同模式).
 *
 * 镜像设计意图: 用户点 chatbot header 的 mode-switch 切 IDE, reload 后 mode-switch 出现在 sidebar 顶.
 *   视觉上"按钮没飞"是因为 reload 后 SoloLayout 重新 mount, mode-switch 跟 header 里的视觉位置
 *   一致 (都是 36x36 按钮), 看起来像"按钮原地换位置".
 */

import React, { useEffect, useState } from 'react';

import { getAppMode, setAppMode, type AppMode } from '../../App';
import { getSidebarApi } from '../sidebar/commands';
import { styles } from './styles';

const ModeSwitch: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(() => getAppMode());
  useEffect(() => {
    const onChange = (): void => setMode(getAppMode());
    window.addEventListener('app-mode-change', onChange);
    return () => window.removeEventListener('app-mode-change', onChange);
  }, []);
  const isSolo = mode === 'solo';
  const otherMode: AppMode = isSolo ? 'ide' : 'solo';
  const otherLabel = isSolo ? 'IDE' : 'SOLO';
  const Icon = isSolo ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="1.5"></rect>
      <circle cx="9" cy="11" r="1.2" fill="currentColor"></circle>
      <circle cx="15" cy="11" r="1.2" fill="currentColor"></circle>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  );
  return (
    <button
      type="button"
      className="app-chatbot__header-mode"
      title={`当前 ${isSolo ? 'Solo' : 'IDE'} 模式, 点击切换到 ${otherLabel}`}
      onClick={() => {
        setAppMode(otherMode);
        setTimeout(() => window.location.reload(), 50);
      }}
    >
      <span className="app-chatbot__header-mode-label">{isSolo ? 'SOLO' : 'IDE'}</span>
      <span className="app-chatbot__header-mode-icon" aria-hidden>{Icon}</span>
    </button>
  );
};

const ExpandToggle: React.FC = () => {
  return (
    <button
      type="button"
      className="app-chatbot__header-expand"
      title="展开 sidebar"
      onClick={() => getSidebarApi()?.expand()}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </svg>
    </button>
  );
};

export const ChatbotMain: React.FC = () => {
  // 只在 mount 时读一次 collapsed, 不订阅变化 — 展开/折叠由用户主动点按钮驱动
  // (按钮各自 hardcode 图标不切 state, 这里只决定 header 是否显示)
  const [headerVisible, setHeaderVisible] = useState<boolean>(
    () => getSidebarApi()?.collapsed ?? false,
  );
  useEffect(() => {
    const api = getSidebarApi();
    if (!api) return;
    return api.onChange((s) => setHeaderVisible(s.collapsed));
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="app-chatbot">
        <div className="app-chatbot__header">
          {headerVisible && (
            <>
              <ModeSwitch />
              <ExpandToggle />
            </>
          )}
        </div>
        <div className="app-chatbot__container" />
      </div>
    </>
  );
};
