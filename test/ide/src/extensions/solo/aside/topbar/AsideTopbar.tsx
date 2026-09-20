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
  { id: 'view', label: '文件系统' },
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

  /** 确保终端实例存在 (无则新建; 有则聚焦). 只在用户进入查看视图时调用 —
   *  用户主动关闭全部终端后保持关闭, 不自动重建 (与 IDE 行为一致). */
  const ensureTerminal = () => {
    const t = terminals as any;
    const size = t?.clients?.size ?? 0;
    if (size === 0) {
      try {
        t?.createTerminal ? t.createTerminal({}) : commandService.executeCommand('terminal.add');
      } catch { /* ignore */ }
      return;
    }
    try { t?.activeClient?.focus?.(); } catch { /* ignore */ }
  };

  // 终端已并入「查看」视图底部 (SoloLayout 内渲染 bottom slot).
  // 首次进入查看视图 (含冷启动默认 view) 时确保存在终端实例;
  // 等 terminals.ready (恢复完成后) 再判断, 避免恢复窗口期误建.
  useEffect(() => {
    if (view !== 'view') return;
    const t = terminals as any;
    const readyP = t?.ready?.promise;
    const start = () => ensureTerminal();
    if (readyP) {
      readyP.then(start).catch(start);
    } else {
      // ready 不可得 (类型兜底): 延迟到恢复窗口后再建, 避免与恢复竞争
      const t0 = window.setTimeout(start, 3000);
      return () => window.clearTimeout(t0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, terminals, commandService]);

  const index = Math.max(0, ITEMS.findIndex((it) => it.id === view));
  const onPick = (id: AsideView) => {
    // 激活哪个拓展, aside 中间 slot 就加载哪个 (view→editor+终端 / browser→aside.browser)
    layout.setAsideView(id);
    // 终端常驻查看视图底部; 进入查看时确保实例 (可能已被全部关闭)
    if (id === 'view') ensureTerminal();
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
