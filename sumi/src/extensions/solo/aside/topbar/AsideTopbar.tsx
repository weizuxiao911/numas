/**
 * AsideTopbar — SOLO 右列顶部活动栏 (solo.aside.action)
 *
 * 胶囊分段控件: 查看 | 终端 | 浏览器 (默认查看).
 * 点击切换 aside 中间区视图 (service/layout: state.aside.view + setAsideView),
 * 滑块 (pill) 用 transform 过渡实现丝滑跳转.
 *
 * 语义:
 *   - 查看: aside 中间 = explorer (aside.sidebar) + editor (aside.container) 左右布局
 *   - 终端: aside 中间 = 终端 (官方 TerminalNextModule 的 bottom slot)
 */
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common';
import { LayoutToken, type ILayoutService, type AsideView } from '../../../../service/layout';
import { styles } from './styles';

const ITEMS: Array<{ id: AsideView; label: string }> = [
  { id: 'view', label: '查看' },
  { id: 'terminal', label: '终端' },
  { id: 'browser', label: '浏览器' },
];

export const AsideTopbar: React.FC = () => {
  const layout = useInjectable<ILayoutService>(LayoutToken);
  const commandService = useInjectable<CommandService>(CommandService);
  const terminals = useInjectable<ITerminalController>(ITerminalController);
  const [view, setView] = useState<AsideView>(() => layout.state.aside.view);
  const [explorerCollapsed, setExplorerCollapsed] = useState<boolean>(() => layout.state.aside.explorerCollapsed);

  useEffect(() => layout.subscribe((s) => {
    setView(s.aside.view);
    setExplorerCollapsed(s.aside.explorerCollapsed);
  }), [layout]);

  /** 确保终端实例存在 (无则新建; 有则聚焦) — 终端全关后重开也走这里 */
  const ensureTerminal = () => {
    const t = terminals as any;
    const size = t?.clients?.size ?? 0;
    if (size === 0) {
      try {
        void (t?.createTerminal ? t.createTerminal({}) : commandService.executeCommand('terminal.add'));
      } catch { /* ignore */ }
      return;
    }
    try { t?.activeClient?.focus?.(); } catch { /* ignore */ }
  };

  // 终端模式: SOLO 下 bottom slot 已由 SoloLayout 在 aside 内渲染 (无 IDE 的 bottom tabbar),
  // 这里只需确保存在终端实例; 有实例时聚焦当前终端.
  useEffect(() => {
    if (view !== 'terminal') return;
    ensureTerminal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, terminals, commandService]);

  const index = Math.max(0, ITEMS.findIndex((it) => it.id === view));
  const onPick = (id: AsideView) => {
    // 激活哪个拓展, aside 中间 slot 就加载哪个 (view→editor / terminal→bottom / browser→aside.browser)
    layout.setAsideView(id);
    // 已在该 tab 再点一次: 终端可能已被全部关闭 → 重建
    if (id === 'terminal') ensureTerminal();
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-aside-topbar">
        <div className="app-aside-topbar__left">
          {/* 仅查看模式: 折叠/展开资源管理器 (无边框菜单图标, 位于胶囊左侧) */}
          {view === 'view' && (
            <button
              type="button"
              className="app-aside-topbar__menu"
              title={explorerCollapsed ? '展开资源管理器' : '折叠资源管理器'}
              aria-label={explorerCollapsed ? '展开资源管理器' : '折叠资源管理器'}
              aria-pressed={!explorerCollapsed}
              onClick={() => layout.toggleAsideExplorer()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          )}
        </div>
        <div className="app-aside-topbar__capsule" data-index={index}>
          <span className="app-aside-topbar__pill" aria-hidden />
          {ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`app-aside-topbar__btn${it.id === view ? ' is-active' : ''}`}
              aria-pressed={it.id === view}
              onClick={() => onPick(it.id)}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="app-aside-topbar__right" />
      </div>
    </>
  );
};
