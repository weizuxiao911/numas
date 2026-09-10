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
 *   - 浏览器: aside 中间 = 编辑区 (浏览器以编辑器 tab 形态打开; 编辑区仅单拓展加载)
 */
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common';
import { LayoutToken, type ILayoutService, type AsideView } from '../../../service/layout';
import { styles } from './styles';

const ITEMS: Array<{ id: AsideView; label: string }> = [
  { id: 'view', label: '查看' },
  { id: 'terminal', label: '终端' },
  { id: 'browser', label: '浏览器' },
];

export const AsideTopbar: React.FC = () => {
  const layout = useInjectable<ILayoutService>(LayoutToken);
  const commandService = useInjectable<CommandService>(CommandService);
  const mainLayout = useInjectable<IMainLayoutService>(IMainLayoutService);
  const terminals = useInjectable<ITerminalController>(ITerminalController);
  const [view, setView] = useState<AsideView>(() => layout.state.aside.view);

  useEffect(() => layout.subscribe((s) => setView(s.aside.view)), [layout]);

  // 终端模式: bottom slot 挂载后激活终端容器; 无终端实例则自动新建一个 (首次)
  useEffect(() => {
    if (view !== 'terminal') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const tick = () => {
      try { mainLayout.toggleSlot(SlotLocation.bottom, true); } catch { /* ignore */ }
      const active = mainLayout.getTabbarHandler('terminal')?.isActivated?.() ?? false;
      if (active) {
        if (((terminals as any)?.clients?.size ?? 0) === 0) {
          void commandService.executeCommand('terminal.add').catch(() => { /* ignore */ });
        }
        return;
      }
      if (++tries < 8) timer = setTimeout(tick, 200);
    };
    timer = setTimeout(tick, 100);
    return () => { if (timer) clearTimeout(timer); };
  }, [view, mainLayout, terminals, commandService]);

  const index = Math.max(0, ITEMS.findIndex((it) => it.id === view));
  const onPick = (id: AsideView) => {
    // 激活哪个拓展, aside 中间 slot 就加载哪个 (view→editor / terminal→bottom / browser→aside.browser)
    layout.setAsideView(id);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-aside-topbar">
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
      </div>
    </>
  );
};
