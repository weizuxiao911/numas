/**
 * IdeRightTopbar — IDE 右栏 (AI 对话) 顶部栏
 *
 * 左: 当前会话标题; 右: 历史会话 (modal + 搜索) / 新建会话 按钮.
 * 独立组件, 不 import chat / chatbot 实现 (符合 AGENTS §2.2 跨拓展解耦):
 *   - 命令契约: chatbot.newSession / chatbot.listSessions / chatbot.changeSession /
 *              chatbot.deleteSession / chatbot.getCurrentSessionID
 *   - window 事件: chatbot:session-changed / runtime-ready
 *   - 事件总线: session.updated (AI 生成标题后刷新)
 * 历史会话 modal 参考 extensions/chat 的 SessionsModal (搜索/时间分组/键盘导航).
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';

import { onEventType } from '../service/event/eventBus';

const CMD = {
  newSession: 'chatbot.newSession',
  listSessions: 'chatbot.listSessions',
  changeSession: 'chatbot.changeSession',
  deleteSession: 'chatbot.deleteSession',
  currentSession: 'chatbot.getCurrentSessionID',
} as const;

const GROUP_ORDER = ['今天', '昨天', '近7天', '更早'];
const DAY_MS = 86400000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function groupLabel(ts: number): string {
  if (!ts) return '更早';
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays <= 7) return '近7天';
  return '更早';
}
function sessionTime(s: any): number {
  return s?.time?.updated || s?.time?.created || 0;
}
function fmtTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
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
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--descriptionForeground, #8f8f8f);
  border-radius: 8px;
  transition: background .12s, color .12s;
}
.app-ide__chat-btn:hover { background: color-mix(in srgb, currentColor 14%, transparent); color: var(--editor-foreground, #1f2328); }

/* 历史会话 modal (参考 chat SessionsModal) */
.app-ide__hist-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 72px;
  background: rgba(0, 0, 0, .28);
}
.app-ide__hist-modal {
  width: 540px; max-width: calc(100vw - 48px); max-height: 70vh;
  display: flex; flex-direction: column;
  background: var(--editorWidget-background, #fff);
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .24);
  overflow: hidden;
  font-size: 13px;
  color: var(--editor-foreground, #1f2328);
}
.app-ide__hist-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 8px 14px; }
.app-ide__hist-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.app-ide__hist-count { font-size: 11px; font-weight: 400; color: var(--descriptionForeground, #8f8f8f); }
.app-ide__hist-close {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer; border-radius: 8px;
  color: var(--descriptionForeground, #8f8f8f);
}
.app-ide__hist-close:hover { background: color-mix(in srgb, currentColor 14%, transparent); color: var(--editor-foreground, #1f2328); }
.app-ide__hist-search {
  display: flex; align-items: center; gap: 8px;
  margin: 0 12px 8px; padding: 0 10px; height: 34px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 6%, transparent);
  color: var(--descriptionForeground, #8f8f8f);
}
.app-ide__hist-search input {
  flex: 1 1 auto; min-width: 0;
  border: none; outline: none; background: transparent;
  font: inherit; color: var(--editor-foreground, #1f2328);
}
.app-ide__hist-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 8px 10px; }
.app-ide__hist-group-title { padding: 10px 8px 4px; font-size: 11px; color: var(--descriptionForeground, #8f8f8f); }
.app-ide__hist-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
}
.app-ide__hist-item:hover { background: var(--list-hoverBackground, rgba(0,0,0,.06)); }
.app-ide__hist-item.is-active { background: color-mix(in srgb, var(--button-background, #2563eb) 12%, transparent); }
.app-ide__hist-item.is-highlighted { outline: 1px solid color-mix(in srgb, var(--button-background, #2563eb) 45%, transparent); }
.app-ide__hist-name { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.app-ide__hist-time { flex: 0 0 auto; font-size: 11px; color: var(--descriptionForeground, #8f8f8f); }
.app-ide__hist-del {
  flex: 0 0 auto; width: 24px; height: 24px; display: none;
  align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer; border-radius: 6px;
  color: var(--descriptionForeground, #8f8f8f);
}
.app-ide__hist-item:hover .app-ide__hist-del { display: inline-flex; }
.app-ide__hist-del:hover { color: #e5484d; background: color-mix(in srgb, #e5484d 12%, transparent); }
.app-ide__hist-empty { padding: 28px 12px; text-align: center; color: var(--descriptionForeground, #8f8f8f); }
`;

export const IdeRightTopbar: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [currentId, setCurrentId] = React.useState<string>('');
  const [showHistory, setShowHistory] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const [list, sid] = await Promise.all([
        commandService.executeCommand<any[]>(CMD.listSessions),
        commandService.executeCommand<string>(CMD.currentSession),
      ]);
      setSessions(Array.isArray(list) ? list : []);
      if (typeof sid === 'string') setCurrentId(sid);
    } catch { /* 契约未就绪 (chatbot 未挂载) 忽略 */ }
  }, [commandService]);

  React.useEffect(() => {
    void refresh();
    const onChanged = (e: Event) => {
      const sid = (e as CustomEvent<{ sessionID: string }>).detail?.sessionID || '';
      if (sid) setCurrentId(sid);
      void refresh();
    };
    window.addEventListener('chatbot:session-changed', onChanged);
    window.addEventListener('runtime-ready', onChanged as EventListener);
    // 轮询兜底: 新建会话 / AI 生成标题后列表与标题更新 (与 SOLO 侧栏同款 4s)
    const timer = window.setInterval(() => void refresh(), 4000);
    // AI 生成标题后经 session.updated 到达 → 防抖刷新
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const off = onEventType(['session.updated'], () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 400);
    });
    return () => {
      window.removeEventListener('chatbot:session-changed', onChanged);
      window.removeEventListener('runtime-ready', onChanged as EventListener);
      window.clearInterval(timer);
      off();
      if (debounce) clearTimeout(debounce);
    };
  }, [refresh]);

  const current = sessions.find((s) => s?.id === currentId);
  const title = current ? sessionLabel(current) : '新会话';

  const onNew = () => {
    setShowHistory(false);
    void commandService.executeCommand(CMD.newSession);
  };
  const onPick = (sid: string) => {
    setShowHistory(false);
    void commandService.executeCommand(CMD.changeSession, sid);
  };
  const onDelete = (sid: string) => {
    void commandService.executeCommand(CMD.deleteSession, sid);
    setTimeout(() => void refresh(), 300);
  };

  return (
    <>
      <style>{styles}</style>
      <header className="app-ide__chat-topbar">
        <div className="app-ide__chat-title" title={title}>{title}</div>
        <div className="app-ide__chat-actions">
          <button type="button" className="app-ide__chat-btn" title="历史会话" onClick={() => { setShowHistory(true); void refresh(); }}>
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
      </header>
      {showHistory && createPortal(
        <HistoryModal
          sessions={sessions}
          currentId={currentId}
          onSelect={onPick}
          onDelete={onDelete}
          onClose={() => setShowHistory(false)}
        />,
        document.body,
      )}
    </>
  );
};

/** 历史会话 modal: 搜索 + 时间分组 + ↑↓/Enter/Esc 键盘导航 (参考 chat SessionsModal) */
const HistoryModal: React.FC<{
  sessions: any[];
  currentId: string;
  onSelect: (sid: string) => void;
  onDelete: (sid: string) => void;
  onClose: () => void;
}> = ({ sessions, currentId, onSelect, onDelete, onClose }) => {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { searchRef.current?.focus(); }, []);
  React.useEffect(() => { setActiveIndex(0); }, [query, sessions]);

  const flatList = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? sessions.filter((s) => sessionLabel(s).toLowerCase().includes(q)) : sessions;
    return [...list].sort((a, b) => sessionTime(b) - sessionTime(a));
  }, [sessions, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of flatList) {
      const label = groupLabel(sessionTime(s));
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return GROUP_ORDER.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [flatList]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (flatList.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % flatList.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + flatList.length) % flatList.length); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const s = flatList[activeIndex];
      if (s) onSelect(s.id);
    }
  };

  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const el = body.querySelector('.is-highlighted');
    if (!el) return;
    const bRect = body.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.top < bRect.top) body.scrollTop += eRect.top - bRect.top;
    else if (eRect.bottom > bRect.bottom) body.scrollTop += eRect.bottom - bRect.bottom;
  }, [activeIndex]);

  return (
    <div
      className="app-ide__hist-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="app-ide__hist-modal" role="dialog" aria-modal="true">
        <div className="app-ide__hist-header">
          <div className="app-ide__hist-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
              <polyline points="3.5 4.5 3.5 9 8 9" />
              <polyline points="12 8 12 12.3 15.2 14.1" />
            </svg>
            历史会话
            <span className="app-ide__hist-count">{sessions.length} 个会话</span>
          </div>
          <button type="button" className="app-ide__hist-close" title="关闭" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="app-ide__hist-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20.5 20.5-4-4" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索会话标题"
          />
        </div>
        <div className="app-ide__hist-body" ref={bodyRef}>
          {flatList.length === 0 && (
            <div className="app-ide__hist-empty">
              {sessions.length === 0 ? '暂无历史会话' : '无匹配会话'}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="app-ide__hist-group-title">{g.label} · {g.items.length}</div>
              {g.items.map((s) => {
                const active = s.id === currentId;
                const highlighted = flatList.indexOf(s) === activeIndex;
                const t = sessionTime(s);
                const label = sessionLabel(s);
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className={`app-ide__hist-item${active ? ' is-active' : ''}${highlighted ? ' is-highlighted' : ''}`}
                    onClick={() => onSelect(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id); }}
                  >
                    <span className="app-ide__hist-name" title={label}>{label}</span>
                    <span className="app-ide__hist-time">{fmtTime(t)}</span>
                    <button
                      type="button"
                      className="app-ide__hist-del"
                      title="删除会话"
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
