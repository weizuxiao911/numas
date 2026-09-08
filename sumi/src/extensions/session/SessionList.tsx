/**
 * SessionList — 会话列表 UI (vsix 拓展实现的 React 组件)
 *
 * 装 left 槽. 显示:
 *   - 顶部: 新建会话按钮
 *   - 列表: 当前 session / 最近 session (按时间分组)
 *
 * 业务接入:
 *   - 后续从 DI 拿 session storage service 拉数据
 *   - 点 session 派发 command (例: session.switch)
 *   - 状态用 useState 维护 (vsix React 组件)
 */

import React, { useState } from 'react';

import { APP_CHAT_CONFIG } from '../../config/brand';

export interface SessionEntry {
  id: string;
  title: string;
  ago: string;
  tag?: string;
  active?: boolean;
}

const PLACEHOLDER: SessionEntry[] = [
  { id: '1', title: '实现 ADDIE 模型…', ago: '17天前', tag: '移动端' },
  { id: '2', title: '收集 Wabot 工…', ago: '17天前', tag: '移动端' },
  { id: '3', title: 'Run ls command', ago: '56天前' },
];

export const SessionList: React.FC = () => {
  const brand = APP_CHAT_CONFIG.brand;
  const [sessions] = useState<SessionEntry[]>(PLACEHOLDER);

  return (
    <div className="app-session">
      <div className="app-session__brand">
        <span className="app-session__logo">{brand.logo}</span>
        <span className="app-session__name">{brand.name}</span>
      </div>

      <button
        className="app-session__new"
        onClick={() => console.log('[session] new task')}
      >
        <span className="app-session__new-icon">+</span>
        新建任务
      </button>

      <nav className="app-session__nav">
        <button className="app-session__nav-item">
          <span className="app-session__nav-icon">📁</span>
          项目
        </button>
        <button className="app-session__nav-item">
          <span className="app-session__nav-icon">🔌</span>
          专家·技能·连接器
        </button>
        <button className="app-session__nav-item">
          <span className="app-session__nav-icon">🧩</span>
          更多
        </button>
      </nav>

      <section className="app-session__recent">
        <div className="app-session__recent-title">最近</div>
        <ul className="app-session__recent-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`app-session__recent-item${s.active ? ' app-session__recent-item--active' : ''}`}
            >
              {s.tag && <span className="app-session__recent-tag">{s.tag}</span>}
              <span className="app-session__recent-name">{s.title}</span>
              <span className="app-session__recent-ago">{s.ago}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="app-session__foot">
        <span className="app-session__avatar">{brand.logo}</span>
        <span className="app-session__user">{brand.name}</span>
        <button className="app-session__bell" title="通知">🔔</button>
      </footer>
    </div>
  );
};
