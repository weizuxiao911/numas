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
  // 创建中标志: createTerminal 是异步的, client 注册进 clients 前 size 仍为 0,
  // 轮询/恢复竞争时按 size===0 判定会重复创建 → 刷新后累积一堆 terminal tab
  const creatingRef = React.useRef(false);

  useEffect(() => layout.subscribe((s) => {
    setView(s.aside.view);
    setExplorerCollapsed(s.aside.explorerCollapsed);
  }), [layout]);

  /** 确保终端实例存在 (无则新建; 有则聚焦) — 终端全关后重开也走这里.
   *  必须在终端恢复 (controller.ready, 即 recovery 完成后) 之后判断: 否则刷新时
   *  opensumi 尚未恢复历史终端, clients.size===0 → 误判新建 → 每次刷新 +1 个终端. */
  const ensureTerminal = () => {
    const t = terminals as any;
    const size = t?.clients?.size ?? 0;
    if (size === 0 && !creatingRef.current) {
      creatingRef.current = true;
      try {
        const p = t?.createTerminal ? t.createTerminal({}) : commandService.executeCommand('terminal.add');
        Promise.resolve(p)
          .catch(() => {})
          .finally(() => { creatingRef.current = false; });
      } catch { creatingRef.current = false; }
      return;
    }
    if (size > 0) {
      try { t?.activeClient?.focus?.(); } catch { /* ignore */ }
    }
  };

  // 终端已并入「查看」视图底部 (SoloLayout 内常驻渲染 bottom slot).
  // 这里确保存在终端实例 + 保活 (全关自动重建), 保证随时有终端可用.
  useEffect(() => {
    if (view === 'browser') return;
    // 先等终端控制器初始化完成 (含历史终端恢复), 再判断是否需要创建
    const t = terminals as any;
    const readyP = t?.ready?.promise;
    const start = () => {
      ensureTerminal();
      // 保活: 终端全部关闭 → 自动重建 (确保随时有终端可用)
      const timer = setInterval(() => {
        const c = terminals as any;
        if ((c?.clients?.size ?? 0) === 0 && !creatingRef.current) ensureTerminal();
      }, 1500);
      return () => clearInterval(timer);
    };
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
