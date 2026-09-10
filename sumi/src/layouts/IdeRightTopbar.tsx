/**
 * IdeRightTopbar — IDE 右栏 (AI 对话) 顶部栏
 *
 * 左: 当前会话标题; 右: 历史会话 / 新建会话 按钮.
 * 独立组件, 不 import chat / chatbot 实现 (符合 AGENTS §2.2 跨拓展解耦):
 *   - 命令契约: chatbot.newSession / chatbot.listSessions /
 *              chatbot.changeSession / chatbot.getCurrentSessionID
 *   - window 事件: chatbot:session-changed (会话切换)
 *   - 事件总线: session.updated (AI 生成标题后刷新)
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';

import { onEventType } from '../service/event/eventBus';

const CMD = {
  newSession: 'chatbot.newSession',
  listSessions: 'chatbot.listSessions',
  changeSession: 'chatbot.changeSession',
  currentSession: 'chatbot.getCurrentSessionID',
} as const;

function sessionLabel(s: any): string {
  const t = s?.title;
  if (t && !/^New session\b/i.test(String(t))) return String(t);
  return '新会话';
}

const styles = `
.app-ide__chat-topbar {
  flex: 0 0 auto;
  position: relative;
  display: flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 6px 0 12px;
  box-sizing: border-box;
  user-select: none;
}
.app-ide__chat-title {
  flex: 1 1 auto; min-width: 0;
  font-size: 13px; font-weight: 600;
  color: var(--editor-foreground, #1f2328);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.app-ide__chat-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; }
.app-ide__chat-btn {
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--descriptionForeground, #8f8f8f);
  border-radius: 8px;
  transition: background .12s, color .12s;
}
.app-ide__chat-btn:hover { background: color-mix(in srgb, currentColor 14%, transparent); color: var(--editor-foreground, #1f2328); }
.app-ide__chat-list {
  position: absolute; top: 46px; right: 8px; z-index: 20;
  width: 260px; max-height: 320px; overflow-y: auto;
  padding: 6px;
  background: var(--editorWidget-background, #fff);
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.14);
}
.app-ide__chat-item {
  display: block; width: 100%; text-align: left;
  padding: 7px 10px; border: none; background: none; cursor: pointer;
  border-radius: 6px;
  font-size: 12px; color: var(--editor-foreground, #1f2328);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.app-ide__chat-item:hover { background: var(--list-hoverBackground, rgba(0,0,0,.06)); }
.app-ide__chat-item.is-active { background: color-mix(in srgb, var(--button-background, #2563eb) 14%, transparent); }
.app-ide__chat-empty { padding: 10px; font-size: 12px; color: var(--descriptionForeground, #8f8f8f); text-align: center; }
`;

export const IdeRightTopbar: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [currentId, setCurrentId] = React.useState<string>('');
  const [showList, setShowList] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const list: any[] = (await commandService.executeCommand(CMD.listSessions)) || [];
      const arr = Array.isArray(list) ? list : [];
      setSessions(arr);
      const sid: string = (await commandService.executeCommand(CMD.currentSession)) || '';
      setCurrentId(sid);
    } catch { /* 契约未就绪 (chatbot 未挂载) 忽略 */ }
  }, [commandService]);

  React.useEffect(() => {
    void refresh();
    const onChanged = () => { void refresh(); };
    window.addEventListener('chatbot:session-changed', onChanged);
    // AI 生成标题后经 session.updated 到达 → 防抖刷新列表/标题
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = onEventType(['session.updated'], () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 400);
    });
    return () => {
      window.removeEventListener('chatbot:session-changed', onChanged);
      off();
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  const current = sessions.find((s) => s?.id === currentId);
  const title = current ? sessionLabel(current) : '新会话';

  const onNew = () => {
    setShowList(false);
    void commandService.executeCommand(CMD.newSession);
  };
  const onPick = (sid: string) => {
    setShowList(false);
    void commandService.executeCommand(CMD.changeSession, sid);
  };

  return (
    <>
      <style>{styles}</style>
      <header className="app-ide__chat-topbar">
        <div className="app-ide__chat-title" title={title}>{title}</div>
        <div className="app-ide__chat-actions">
          <button
            type="button"
            className="app-ide__chat-btn"
            title="历史会话"
            onClick={() => { setShowList((v) => !v); if (!showList) void refresh(); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
              <polyline points="3.5 4.5 3.5 9 8 9" />
              <polyline points="12 8 12 12.3 15.2 14.1" />
            </svg>
          </button>
          <button type="button" className="app-ide__chat-btn" title="新会话" onClick={onNew}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="6" x2="12" y2="18" />
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
          </button>
        </div>
        {showList && (
          <div className="app-ide__chat-list">
            {sessions.length === 0 && <div className="app-ide__chat-empty">暂无会话</div>}
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`app-ide__chat-item${s.id === currentId ? ' is-active' : ''}`}
                title={sessionLabel(s)}
                onClick={() => onPick(s.id)}
              >
                {sessionLabel(s)}
              </button>
            ))}
          </div>
        )}
      </header>
    </>
  );
};
