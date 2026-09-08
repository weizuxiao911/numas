/**
 * Sidebar — Numas 首页侧栏 UI (vsix 拓展实现的 React 组件)
 *
 * 装 SOLO 模式 Sidebar 槽. 当前仅:
 *   - 模式切换器 (顶): 当前模式按钮
 *   - 折叠按钮 (顶右)
 *
 * 折叠/展开 state 走 service/layout (LayoutToken 订阅 + executeCommand 操作,
 * vscode 标准跨拓展契约, 不破 §2.2 铁律).
 *
 * 分层铁律 (AGENTS.md §2.2):
 *   - 模式切换: 读 window.__appSetMode 暴露的 setAppMode, 调 → reload
 *     (codeblitz AppRenderer 不响应运行时 config 变化)
 *   - 折叠/展开: 调 sidebarApi.collapse() / expand() / toggle()
 */

import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { getAppMode, setAppMode, type AppMode } from '../../App';
import { getWorkspace } from '../../infra/url';
import { absToRel, pathBase } from '../../infra/path';
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
  );
};

const CollapseToggle: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  return (
    <button
      type="button"
      className="app-sidebar__icon-btn app-sidebar__icon-btn--bare"
      title="折叠 sidebar 到 1px"
      onClick={() => void commandService.executeCommand(LAYOUT_COMMANDS.sidebarCollapse.id)}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
};

const NewSessionButton: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  return (
    <button
      type="button"
      className="app-sidebar__new-session"
      title="新建会话"
      onClick={() => void commandService.executeCommand('numas.chatbot.newSession')}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>新建会话</span>
    </button>
  );
};

/** 会话标题兜底: 取 opencode 默认标题里的内容, 否则 "新会话" */
function sessionLabel(s: any): string {
  const t = s?.title;
  if (t && !/^New session\b/i.test(String(t))) return t;
  return '新会话';
}

function sessionTime(s: any): number {
  return s?.time?.updated || s?.time?.created || 0;
}

/** 会话时间格式化: 今天/昨天/近7天 显示时间, 更早显示日期 */
function sessionTimeLabel(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diffDays <= 0) return `今天 ${hm}`;
  if (diffDays === 1) return `昨天 ${hm}`;
  if (diffDays <= 7) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 会话工作目录 → 相对当前 workspace 显示 (workspace 根 = basename, 子目录 = 相对路径) */
function sessionDirLabel(s: any): string {
  const dir = s?.directory;
  if (!dir) return '';
  const ws = getWorkspace();
  const rel = ws ? absToRel(dir, ws) : null;
  if (rel === '.') return pathBase(ws) || ws;
  if (rel) return rel;
  return dir;
}

/** 历史会话列表 — 当前 cwd 顶层会话 (排除 subagent), 点击切换 */
const SessionList: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentID, setCurrentID] = useState<string>('');

  const refresh = React.useCallback(async () => {
    try {
      const [list, cur] = await Promise.all([
        commandService.executeCommand<any[]>('numas.chatbot.listSessions'),
        commandService.executeCommand<string>('numas.chatbot.getCurrentSessionID'),
      ]);
      setSessions(Array.isArray(list) ? list : []);
      if (typeof cur === 'string') setCurrentID(cur);
    } catch { /* 命令未就绪时忽略 */ }
  }, [commandService]);

  useEffect(() => {
    void refresh();
    // workspace 切换 (reload) 后由 runtime-ready 兜底刷新; 新建会话后等会话列表变化
    const id = window.setInterval(() => void refresh(), 4000);
    const onReady = () => void refresh();
    window.addEventListener('runtime-ready', onReady);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('runtime-ready', onReady);
    };
  }, [refresh]);

  const onSelect = (sid: string) => {
    void commandService.executeCommand('numas.chatbot.changeSession', sid);
    setCurrentID(sid);
  };
  const onDelete = (sid: string) => {
    void commandService.executeCommand('numas.chatbot.deleteSession', sid);
    setSessions((prev) => prev.filter((s) => s?.id !== sid));
  };

  const sorted = [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a));

  return (
    <div className="app-sidebar__sessions">
      <div className="app-sidebar__sessions-head">
        <span className="app-sidebar__sessions-title">历史会话</span>
        {sessions.length > 0 && <span className="app-sidebar__sessions-count">{sessions.length}</span>}
      </div>
      <div className="app-sidebar__sessions-body">
        {sorted.length === 0 && (
          <div className="app-sidebar__sessions-empty">暂无会话</div>
        )}
        {sorted.map((s) => {
          const active = s?.id === currentID;
          return (
            <div
              key={s?.id}
              role="button"
              tabIndex={0}
              className={`app-sidebar__session${active ? ' is-active' : ''}`}
              title={sessionLabel(s)}
              onClick={() => onSelect(s?.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s?.id); }}
            >
              <span className="app-sidebar__session-body">
                <span className="app-sidebar__session-name">{sessionLabel(s)}</span>
                {s?.directory && <span className="app-sidebar__session-dir" title={s.directory}>{sessionDirLabel(s)}</span>}
              </span>
              {!!sessionTime(s) && <span className="app-sidebar__session-time">{sessionTimeLabel(sessionTime(s))}</span>}
              <button
                type="button"
                className="app-sidebar__session-del"
                title="删除会话"
                onClick={(e) => { e.stopPropagation(); onDelete(s?.id); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-sidebar">
        <div className="app-sidebar__mode-row">
          <ModeSwitch />
          <CollapseToggle />
        </div>
        <div className="app-sidebar__main">
          <NewSessionButton />
          <SessionList />
        </div>
      </div>
    </>
  );
};
