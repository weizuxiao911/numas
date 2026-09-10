/**
 * Sessions — SOLO 左列容器区 (solo.sidebar.container)
 *
 * 内容: 新建会话按钮 + 历史会话列表 (当前项目会话, 点击切换/删除).
 * 跨拓展交互走全局命令 (chatbot.newSession / listSessions / changeSession / deleteSession),
 * 不 import chatbot 拓展内部实现 (AGENTS §2.2).
 */
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { StateToken, type IStateService } from '../../../service/state';
import { styles } from './styles';

const NewSessionButton: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  return (
    <button
      type="button"
      className="app-sessions__new"
      title="新建会话"
      onClick={() => void commandService.executeCommand('chatbot.newSession')}
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

/** 历史会话列表 — 当前 cwd 顶层会话 (排除 subagent), 点击切换 */
const SessionList: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const state = useInjectable<IStateService>(StateToken);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentID, setCurrentID] = useState<string>('');

  // 监听 chatbot 主区派发的 session:changed 事件, 同步当前选中项 (供侧栏高亮).
  useEffect(() => {
    const onChanged = (e: Event) => {
      const sid = (e as CustomEvent<{ sessionID: string }>).detail?.sessionID || '';
      setCurrentID(sid);
    };
    window.addEventListener('chatbot:session-changed', onChanged);
    // 初始拉一次 (覆盖冷启动 ChatbotView 先 setSessionID 后才挂监听的情况)
    void commandService.executeCommand<string>('chatbot.getCurrentSessionID')
      .then((sid) => { if (typeof sid === 'string' && sid) setCurrentID(sid); })
      .catch(() => {});
    return () => window.removeEventListener('chatbot:session-changed', onChanged);
  }, [commandService]);

  const refresh = React.useCallback(async () => {
    try {
      const [list, cur] = await Promise.all([
        commandService.executeCommand<any[]>('chatbot.listSessions'),
        commandService.executeCommand<string>('chatbot.getCurrentSessionID'),
      ]);
      setSessions(Array.isArray(list) ? list : []);
      if (typeof cur === 'string') setCurrentID(cur);
    } catch { /* 命令未就绪时忽略 */ }
  }, [commandService]);

  useEffect(() => {
    void refresh();
    // 切项目 (workdir) 后立即刷新该项目会话; 同时轮询兜底新建/更新
    const id = window.setInterval(() => void refresh(), 4000);
    const unsub = state.subscribeWorkdir(() => void refresh());
    // 切项目时主区派 chatbot:session-changed (切到新项目最新会话), 侧栏立即重拉列表
    const onSessionChanged = () => void refresh();
    window.addEventListener('chatbot:session-changed', onSessionChanged);
    const onReady = () => void refresh();
    window.addEventListener('runtime-ready', onReady);
    return () => {
      window.clearInterval(id);
      unsub();
      window.removeEventListener('chatbot:session-changed', onSessionChanged);
      window.removeEventListener('runtime-ready', onReady);
    };
  }, [refresh, state]);

  const onSelect = (sid: string) => {
    void commandService.executeCommand('chatbot.changeSession', sid);
    setCurrentID(sid);
  };
  const onDelete = (sid: string) => {
    void commandService.executeCommand('chatbot.deleteSession', sid);
    setSessions((prev) => prev.filter((s) => s?.id !== sid));
  };

  // 单 workdir 模型: 不分组, 直接平铺当前项目会话, 按更新时间倒序.
  const list = [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a));

  return (
    <div className="app-sessions__list">
      <div className="app-sessions__head">
        <span className="app-sessions__title">历史会话</span>
        {list.length > 0 && <span className="app-sessions__count">{list.length}</span>}
      </div>
      <div className="app-sessions__body">
        {list.length === 0 && (
          <div className="app-sessions__empty">暂无会话</div>
        )}
        {list.map((s) => {
          const active = s?.id === currentID;
          return (
            <div
              key={s?.id}
              role="button"
              tabIndex={0}
              className={`app-sessions__item${active ? ' is-active' : ''}`}
              title={sessionLabel(s)}
              onClick={() => onSelect(s?.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s?.id); }}
            >
              <span className="app-sessions__item-body">
                <span className="app-sessions__item-name">{sessionLabel(s)}</span>
              </span>
              {!!sessionTime(s) && <span className="app-sessions__item-time">{sessionTimeLabel(sessionTime(s))}</span>}
              <button
                type="button"
                className="app-sessions__item-del"
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

export const Sessions: React.FC = () => {
  return (
    <>
      <style>{styles}</style>
      <div className="app-sessions">
        <NewSessionButton />
        <SessionList />
      </div>
    </>
  );
};
