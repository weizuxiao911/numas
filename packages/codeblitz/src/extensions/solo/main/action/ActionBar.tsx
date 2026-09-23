/**
 * ActionBar — Numas SOLO 模式 action 槽 UI (顶部工具栏)
 *
 * 装 SOLO_SLOTS.MainAction (自定义 slot 'action', 见 config/slots.ts),
 * 位于中列顶部, main (对话主区) 上方.
 *
 * 承载: 模式切换 (SOLO/IDE) / sidebar 展开 / 项目选择 (ProjectPicker popover).
 * 折叠态 sidebar 扩展: 镜像 mode-switch + expand + 当前会话标题 + 历史会话 popover + 新建会话
 *   (替代 sidebar 不可见时失去的新建/历史入口). 跨拓展状态共享走
 *   service/layout (LayoutToken) + executeCommand — 单向消费, 不破 §2.2 铁律.
 *
 * 镜像设计意图: 用户点 action 的 mode-switch 切 IDE, reload 后 mode-switch 出现在 sidebar 顶.
 *   视觉上"按钮没飞"是因为 reload 后 SoloLayout 重新 mount, mode-switch 跟 action 里的视觉位置
 *   一致 (都是 36x36 按钮), 看起来像"按钮原地换位置".
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';

import { getAppMode, setAppMode, type AppMode } from '../../../../App';
import { StateToken, type IStateService } from '../../../../service/state';
import { LayoutToken, LAYOUT_COMMANDS, type ILayoutService } from '../../../../service/layout';
import { requestFilePicker } from '../../../file';
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
        // 不整页 reload: AppRenderer key={mode} 变化 → 旧 ClientApp destroy + 新实例重建
        setAppMode(otherMode);
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

const AsideToggle: React.FC<{ layout: ILayoutService; commandService: CommandService }> = ({ layout, commandService }) => {
  const [open, setOpen] = useState<boolean>(() => layout.state.aside.open);
  useEffect(() => {
    return layout.subscribe((s) => setOpen(s.aside.open));
  }, [layout]);
  return (
    <button
      type="button"
      className="app-action__aside"
      title={open ? '关闭右列' : '展开右列'}
      onClick={() => void commandService.executeCommand(LAYOUT_COMMANDS.asideToggle.id)}
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

const ProjectPickButton: React.FC<{ label: string; project: string; commandService: CommandService; state: IStateService }> = ({ label, project, commandService, state }) => {
  const [confirming, setConfirming] = useState(false);

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

  /** 关闭项目: 清空选择 + 刷新恢复默认态 (无项目 → welcome); 刷新保证资源管理器/编辑器/chat 重置干净 */
  const closeProject = () => {
    state.setWorkdir('');
    window.location.reload();
  };

  return (
    <span className="app-action__pick-wrap">
      <button
        type="button"
        className="app-action__pick"
        title={project || '选择项目'}
        onClick={onClick}
      >
        <span className="app-action__pick-label">{label}</span>
        {/* 下拉箭头: 仅未选项目时显示 (选中时该位置换成 ✕ 关闭) */}
        {!project && (
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {/* ✕ 关闭项目: 与选择项目按钮融合同一胶囊内; 仅选中项目后渲染 (替代箭头位置) */}
      {project && (
        <button
          type="button"
          className="app-action__pick-close"
          title="关闭项目 (恢复未选择项目状态)"
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}
      {/* 关闭确认 modal */}
      {confirming && createPortal(
        <div
          className="app-action__modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}
        >
          <div className="app-action__modal" role="dialog" aria-modal="true">
            <div className="app-action__modal-title">关闭项目</div>
            <div className="app-action__modal-desc">
              确认关闭当前项目「{label}」? 关闭后将回到未选择项目状态。
            </div>
            <div className="app-action__modal-actions">
              <button type="button" className="app-action__modal-btn is-primary" onClick={closeProject}>确认关闭</button>
              <button type="button" className="app-action__modal-btn" onClick={() => setConfirming(false)}>取消</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
};

/* ─────────────── sidebar 折叠态 topbar 扩展: 标题 + 历史会话 + 新建会话 ───────────────
 * 全部走 chatbot.* 全局命令 + chatbot:session-changed 事件契约, 不 import chat 内部
 * (符合 §2.2 跨拓展解耦). 视觉风格跟 .app-action__pick 一致 (浅底 + 圆角 9px). */

/** 当前会话标题兜底: 取 listSessions 里匹配 currentID 的 title, 标题空/未生成/是 "New session" 时
 *  fallback 到 "新会话" (跟 ChatbotView 内部 setCurrentTitle 规则保持一致).
 *  HistoryPanel 内部搜索过滤用. */
function pickTitle(sessions: any[] | null | undefined, currentID: string): string {
  if (!currentID) return '新会话';
  const s = (Array.isArray(sessions) ? sessions : []).find((x) => x?.id === currentID);
  const t = s?.title;
  if (t && !/^New session\b/i.test(String(t))) return String(t);
  return '新会话';
}

const NewSessionButton: React.FC<{ commandService: CommandService }> = ({ commandService }) => {
  return (
    <button
      type="button"
      className="app-action__new"
      title="新建会话"
      onClick={() => void commandService.executeCommand('chatbot.newSession')}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
};

/** 历史会话 popover: 复用 Sidebar SessionList 的拉取/轮询/切换/删除模式, 但限定在 popover 内.
 *  点击 popover 外部 / ESC 关闭. */
/* ───────── 历史会话 modal (对齐 IdeRightTopbar 视觉, 用 opensumi Modal 组件) ───────── */

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

/** 历史会话面板 (放在 Modal children 内). 自包含: 自己拉 listSessions / getCurrentSession,
 *  选择后 changeSession 并关闭 modal. ↑↓/Enter/Esc 键盘导航. */
const HistoryPanel: React.FC<{
  commandService: CommandService;
  onClose: () => void;
}> = ({ commandService, onClose }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const refresh = React.useCallback(async () => {
    try {
      const [list, sid] = await Promise.all([
        commandService.executeCommand<any[]>('chatbot.listSessions'),
        commandService.executeCommand<string>('chatbot.getCurrentSessionID'),
      ]);
      setSessions(Array.isArray(list) ? list : []);
      if (typeof sid === 'string') setCurrentId(sid);
    } catch { /* 契约未就绪忽略 */ }
  }, [commandService]);

  useEffect(() => { void refresh(); setTimeout(() => searchRef.current?.focus(), 0); }, [refresh]);
  useEffect(() => { setActiveIndex(0); }, [query, sessions]);

  const flatList = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? sessions.filter((s) => pickTitle([s], s?.id).toLowerCase().includes(q)) : sessions;
    return [...list].sort((a, b) => (b?.time?.updated || b?.time?.created || 0) - (a?.time?.updated || a?.time?.created || 0));
  }, [sessions, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of flatList) {
      const label = groupLabel(s?.time?.updated || s?.time?.created || 0);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return GROUP_ORDER.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [flatList]);

  const pick = (sid: string) => {
    void commandService.executeCommand('chatbot.changeSession', sid);
    onClose();
  };
  const del = (sid: string) => {
    void commandService.executeCommand('chatbot.deleteSession', sid);
    setTimeout(() => void refresh(), 300);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (flatList.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % flatList.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + flatList.length) % flatList.length); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const s = flatList[activeIndex];
      if (s) pick(s.id);
    }
  };

  useEffect(() => {
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
    <div className="app-ide__hist-panel">
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
              const t = s?.time?.updated || s?.time?.created || 0;
              const label = pickTitle([s], s.id);
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  className={`app-ide__hist-item${active ? ' is-active' : ''}${highlighted ? ' is-highlighted' : ''}`}
                  onClick={() => pick(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pick(s.id); }}
                >
                  <span className="app-ide__hist-name" title={label}>{label}</span>
                  <span className="app-ide__hist-time">{fmtTime(t)}</span>
                  <button
                    type="button"
                    className="app-ide__hist-del"
                    title="删除会话"
                    onClick={(e) => { e.stopPropagation(); del(s.id); }}
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
  );
};

const SessionHistoryButton: React.FC<{ commandService: CommandService }> = ({ commandService }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="app-action__chat-btn"
        title="历史会话"
        onClick={() => setOpen(true)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
          <polyline points="3.5 4.5 3.5 9 8 9" />
          <polyline points="12 8 12 12.3 15.2 14.1" />
        </svg>
      </button>
      {open && createPortal(
        <div
          className="app-ide__hist-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="app-ide__hist-modal" role="dialog" aria-modal="true">
            <HistoryPanel commandService={commandService} onClose={() => setOpen(false)} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export const ActionBar: React.FC = () => {
  const state = useInjectable<IStateService>(StateToken);
  const layout = useInjectable<ILayoutService>(LayoutToken);
  const commandService = useInjectable<CommandService>(CommandService);

  // sidebar 折叠时才显示 mode-switch + expand + 标题 + 历史 + 新建 (展开态它们在 sidebar 内部).
  // 仅 SOLO 模式镜像: IDE 顶栏同时渲染 SideTopbar (SidebarAction 槽, 自带 mode-switch),
  // 若这里也渲染会重复; 且 SOLO 的 sidebar 折叠态与 IDE 左栏显隐无关.
  const isSoloMode = (): boolean => getAppMode() === 'solo';
  const [mirrorVisible, setMirrorVisible] = useState<boolean>(() => isSoloMode() && layout.state.sidebar.collapsed);
  useEffect(() => {
    return layout.subscribe((s) => setMirrorVisible(isSoloMode() && s.sidebar.collapsed));
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
              <SessionHistoryButton commandService={commandService} />
              <NewSessionButton commandService={commandService} />
            </>
          )}
          <ProjectPickButton label={label} project={project} commandService={commandService} state={state} />
        </div>
        <div className="app-action__right">
          <AsideToggle commandService={commandService} layout={layout} />
        </div>
      </div>
    </>
  );
};
