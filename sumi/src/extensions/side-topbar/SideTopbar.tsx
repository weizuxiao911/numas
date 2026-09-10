/**
 * SideTopbar — SOLO 左列顶部活动栏 (solo.sidebar.action)
 *
 * 内容: 模式切换 (SOLO/IDE) + sidebar 折叠按钮.
 * 折叠/展开状态走 service/layout (LAYOUT_COMMANDS.sidebarCollapse, 跨拓展命令契约).
 */
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { getAppMode, setAppMode, type AppMode } from '../../App';
import { LAYOUT_COMMANDS } from '../../service/layout';
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
      className="app-side-topbar__mode"
      title={`当前 ${isSolo ? 'Solo' : 'IDE'} 模式, 点击切换到 ${otherLabel}`}
      onClick={() => {
        // 不整页 reload: AppRenderer key={mode} 变化 → 旧 ClientApp destroy + 新实例重建
        setAppMode(otherMode);
      }}
    >
      <span className="app-side-topbar__mode-label">{isSolo ? 'SOLO' : 'IDE'}</span>
      <span className="app-side-topbar__mode-icon" aria-hidden>{Icon}</span>
    </button>
  );
};

const CollapseToggle: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  return (
    <button
      type="button"
      className="app-side-topbar__icon-btn"
      title="折叠 sidebar"
      onClick={() => void commandService.executeCommand(LAYOUT_COMMANDS.sidebarCollapse.id)}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
};

export const SideTopbar: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-side-topbar">
        <div className="app-side-topbar__mode-row">
          <ModeSwitch />
          <CollapseToggle />
        </div>
      </div>
    </>
  );
};
