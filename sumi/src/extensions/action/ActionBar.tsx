/**
 * ActionBar — Numas SOLO 模式 action 槽 UI (顶部工具栏)
 *
 * 装 SOLO_SLOTS.Action (自定义 slot 'action', 见 config/slots.ts),
 * 位于中列顶部, main (对话主区) 上方.
 *
 * 承载: 模式切换 (SOLO/IDE) / sidebar 展开 / 项目选择 (ProjectPicker popover).
 *
 * 折叠态 sidebar 行为: 镜像 sidebar 顶的 mode-switch + expand 按钮
 *   (替代 sidebar 内部 mode-row 不可见). 跨拓展状态共享走
 *   service/layout (LayoutToken) + executeCommand — 单向消费, 不破 §2.2 铁律.
 *
 * 镜像设计意图: 用户点 action 的 mode-switch 切 IDE, reload 后 mode-switch 出现在 sidebar 顶.
 *   视觉上"按钮没飞"是因为 reload 后 SoloLayout 重新 mount, mode-switch 跟 action 里的视觉位置
 *   一致 (都是 36x36 按钮), 看起来像"按钮原地换位置".
 */

import React, { useEffect, useState } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';

import { getAppMode, setAppMode, type AppMode } from '../../App';
import { StateToken, type IStateService } from '../../service/state';
import { LayoutToken, LAYOUT_COMMANDS, type ILayoutService } from '../../service/layout';
import { requestFilePicker } from '../filepicker/FilePicker';
import { styles } from './styles';

function pathBasename(p: string): string {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}

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
      className="app-action__mode"
      title={`当前 ${isSolo ? 'Solo' : 'IDE'} 模式, 点击切换到 ${otherLabel}`}
      onClick={() => {
        setAppMode(otherMode);
        setTimeout(() => window.location.reload(), 50);
      }}
    >
      <span className="app-action__mode-label">{isSolo ? 'SOLO' : 'IDE'}</span>
      <span className="app-action__mode-icon" aria-hidden>{Icon}</span>
    </button>
  );
};

const ExpandToggle: React.FC<{ layout: ILayoutService; commandService: CommandService }> = ({ layout, commandService }) => {
  return (
    <button
      type="button"
      className="app-action__expand"
      title="展开 sidebar"
      onClick={() => void commandService.executeCommand(LAYOUT_COMMANDS.sidebarExpand.id)}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </svg>
    </button>
  );
};

const DrawerToggle: React.FC<{ layout: ILayoutService; commandService: CommandService }> = ({ layout, commandService }) => {
  const [open, setOpen] = useState<boolean>(() => layout.state.drawer.open);
  useEffect(() => {
    return layout.subscribe((s) => setOpen(s.drawer.open));
  }, [layout]);
  return (
    <button
      type="button"
      className="app-action__drawer"
      title={open ? '关闭抽屉' : '展开抽屉'}
      onClick={() => void commandService.executeCommand(LAYOUT_COMMANDS.drawerToggle.id)}
    >
      {open ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <rect x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </svg>
      )}
    </button>
  );
};

const ProjectPickButton: React.FC<{ label: string; commandService: CommandService; state: IStateService }> = ({ label, commandService, state }) => {
  const onClick = () => {
    // 单 workdir 模型: 点击直接弹 filepicker 自由选任意目录 (即 workdir 根).
    const start = state.getWorkdir() || '';
    requestFilePicker({
      mode: 'open',
      initialPath: start || undefined,
      onPick: (items) => {
        const dir = items[0];
        if (!dir) return;
        // 跨拓展只走全局命令 (AGENTS §2.2)
        void commandService.executeCommand('chatbot.setProject', dir.path);
      },
    });
  };
  return (
    <button
      type="button"
      className="app-action__pick"
      title="选择项目"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <span className="app-action__pick-label">{label}</span>
    </button>
  );
};

export const ActionBar: React.FC = () => {
  const state = useInjectable<IStateService>(StateToken);
  const layout = useInjectable<ILayoutService>(LayoutToken);
  const commandService = useInjectable<CommandService>(CommandService);

  // sidebar 折叠时才显示 mode-switch + expand (展开态它们在 sidebar 顶部)
  const [mirrorVisible, setMirrorVisible] = useState<boolean>(() => layout.state.sidebar.collapsed);
  useEffect(() => {
    return layout.subscribe((s) => setMirrorVisible(s.sidebar.collapsed));
  }, [layout]);

  const [project, setProject] = useState<string>(() => state.getWorkdir());
  useEffect(() => {
    return state.subscribeWorkdir((next) => setProject(next));
  }, [state]);
  const label = project ? pathBasename(project) : '选择项目';

  return (
    <>
      <style>{styles}</style>
      <div className="app-action">
        <div className="app-action__left">
          {mirrorVisible && (
            <>
              <ModeSwitch />
              <ExpandToggle layout={layout} commandService={commandService} />
            </>
          )}
          <ProjectPickButton label={label} commandService={commandService} state={state} />
        </div>
        <div className="app-action__right">
          <DrawerToggle commandService={commandService} layout={layout} />
        </div>
      </div>
    </>
  );
};
