/**
 * Sidebar — Numas 首页侧栏 UI (vsix 拓展实现的 React 组件)
 *
 * 装 SOLO 模式 Sidebar 槽. 当前仅:
 *   - 模式切换器 (顶): 当前模式按钮 + 折叠按钮
 *
 * 分层铁律 (AGENTS.md §2.2):
 *   - 模式切换: 读 window.__appSetMode 暴露的 setAppMode, 调 → reload
 *     (codeblitz AppRenderer 不响应运行时 config 变化)
 */

import React, { useEffect, useState } from 'react';

import { getAppMode, setAppMode, type AppMode } from '../../App';
import { styles } from './styles';

const ModeSwitch: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(() => getAppMode());
  const [leftVisible, setLeftVisible] = useState(true);
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
    <div className="app-sidebar__mode-row">
      <button
        type="button"
        className="app-sidebar__mode-active"
        title={`当前 ${isSolo ? 'Solo' : 'IDE'} 模式, 点击切换到 ${otherLabel}`}
        onClick={() => {
          setAppMode(otherMode);
          setTimeout(() => window.location.reload(), 50);
        }}
      >
        <span className="app-sidebar__mode-active-label">{isSolo ? 'SOLO' : 'IDE'}</span>
        <span className="app-sidebar__mode-active-icon" aria-hidden>{Icon}</span>
      </button>
      <button
        type="button"
        className="app-sidebar__icon-btn app-sidebar__icon-btn--bare"
        title={leftVisible ? '折叠' : '展开'}
        onClick={() => {
          setLeftVisible(v => !v);
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          {leftVisible
            ? <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" />
            : <line x1="9" y1="4" x2="9" y2="20" />}
        </svg>
      </button>
    </div>
  );
};

function formatAgo(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString();
}

export const Sidebar: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-sidebar">
      <ModeSwitch />
    </div>
    </>
  );
};
