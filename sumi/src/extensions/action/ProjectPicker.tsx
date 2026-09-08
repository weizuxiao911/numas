/**
 * ProjectPicker — chatbot header "选择项目" 按钮 popover
 *
 * 触发: ChatbotMain 顶 "选择项目" 按钮.
 * 内容: 2 组动作 (选择目录 / 克隆仓库) + 最近项目列表.
 * 行为:
 *   - 选择目录 → 派 window 'workspace:request-show' 事件, 复用 WorkspacePicker 走 FilePicker
 *   - 克隆仓库 → 占位, 后续接 git clone (复用 terminal 或后端)
 *   - 点 recent 项 → state.setWorkspace(path) + 关闭 popover
 *   - 点外部 / Esc → 关闭
 * 动效: 顶 8px 下拉 + fade in, 200ms cubic-bezier(0.16, 1, 0.3, 1).
 *
 * 不做 module / slot — ChatbotMain 内部 React 组件, 不破 §2.2 跨拓展铁律.
 */

import React, { useEffect, useRef, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { StateToken, type IStateService, type RecentWorkspace } from '../../service/state';

const ACTIONS: { key: 'open' | 'clone'; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'open',
    label: '选择目录',
    description: '从本地文件系统选择工作目录',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    key: 'clone',
    label: '克隆仓库',
    description: '从 Git URL 拉取仓库到本地',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="12" r="2.5" />
        <path d="M6 8.5v7" />
        <path d="M6 11h4a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3" />
      </svg>
    ),
  },
];

function formatRelativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

function pathBasename(p: string): string {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}

function pathDirname(p: string): string {
  if (!p) return '';
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = norm.lastIndexOf('/');
  if (idx <= 0) return '/';
  return norm.slice(0, idx);
}

export interface ProjectPickerProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectPicker: React.FC<ProjectPickerProps> = ({ open, onClose }) => {
  const state = useInjectable<IStateService>(StateToken);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // 每次打开时拉一次 recent (避免内存缓存过期)
  useEffect(() => {
    if (!open) return;
    setRecent(state.getWorkspace().recent);
  }, [open, state]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 点外部关闭 (popover 自身的点击不触发)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      // 包含 root 自身 / root 内元素, 不关
      if (e.target instanceof Node && root.contains(e.target)) return;
      onClose();
    };
    // 延后一拍挂载, 避免开 popover 的同一次 click 立即关闭
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onAction = (key: 'open' | 'clone') => {
    if (key === 'open') {
      window.dispatchEvent(new Event('workspace:request-show'));
      onClose();
    } else {
      // 克隆仓库: 暂占位, 后续接 terminal 或后端 API
      window.alert('克隆仓库功能待接入 (复用 terminal 或后端 API)');
      onClose();
    }
  };

  const onPick = (path: string) => {
    state.setWorkspace(path);
    onClose();
  };

  return (
    <div ref={rootRef} className="app-project-picker" role="dialog" aria-label="选择项目">
      <div className="app-project-picker__body">
        <div className="app-project-picker__actions">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              className="app-project-picker__action"
              onClick={() => onAction(a.key)}
            >
              <span className="app-project-picker__action-icon" aria-hidden>{a.icon}</span>
              <span className="app-project-picker__action-text">
                <span className="app-project-picker__action-label">{a.label}</span>
                <span className="app-project-picker__action-desc">{a.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="app-project-picker__divider" />

        {recent.length === 0 ? (
          <div className="app-project-picker__empty">最近无项目</div>
        ) : (
          <ul className="app-project-picker__list" role="listbox">
            {recent.map((r) => (
              <li key={r.path}>
                <button
                  type="button"
                  className="app-project-picker__item"
                  onClick={() => onPick(r.path)}
                  title={r.path}
                >
                  <span className="app-project-picker__item-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  </span>
                  <span className="app-project-picker__item-text">
                    <span className="app-project-picker__item-name">{pathBasename(r.path) || r.path}</span>
                    <span className="app-project-picker__item-dir">{pathDirname(r.path)}</span>
                  </span>
                  {r.lastOpenedAt > 0 && (
                    <span className="app-project-picker__item-time">{formatRelativeTime(r.lastOpenedAt)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};