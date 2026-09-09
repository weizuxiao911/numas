/**
 * SoloLayout — SOLO 模式布局 (自己实现三列 + 拖动条)
 *
 * 不用 codeblitz BoxPanel/SplitPanel (SlotRenderer + isTabbar 跟 SplitPanel sash 互相打架,
 *  拖不了). 布局状态 (sidebar 折叠/宽度 + drawer 开合/宽度) 由 service/layout 单例持有,
 *  本组件只读状态渲染 + 把拖拽/联动动作委托给 service — 不再自持 state / 不再 api owner.
 *
 * 结构 (四槽, 见 config/slots.ts):
 *   ┌──────────┬─────────────────────────┬────────┐
 *   │ sidebar  │  action (顶部工具栏)      │        │
 *   │          ├─────────────────────────┤ drawer │
 *   │          │  main (对话主区)          │        │
 *   └──────────┴─────────────────────────┴────────┘
 *
 * 状态流转 (service/layout, 与跨拓展 executeCommand 一致):
 *   - sidebar 折叠 = collapsed boolean (折叠时不渲染, 不用 1px 占位)
 *   - drawer 打开 → service.openDrawer() 内部自动折叠 sidebar 让出空间
 *   - 拖拽改宽 → service.setSidebarWidth / setDrawerWidth (单例广播)
 */
import React, { useRef, useEffect } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser/lib/react-providers/slot';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';
import { SOLO_SLOTS } from '../config/slots';
import { LayoutToken, type ILayoutService } from '../service/layout';

export function SoloLayout(): React.ReactElement {
  const layout = useInjectable<ILayoutService>(LayoutToken);
  // 每次渲染取最新状态 (service 广播 → 本组件 subscribe 触发重渲染)
  const { sidebar, drawer } = layout.state;
  const sidebarCollapsed = sidebar.collapsed;
  const sidebarW = sidebar.width;
  const drawerOpen = drawer.open;
  const drawerW = drawer.width;

  // drawer 打开时: 视口变化同步到 50% (resize 由 service 处理)
  useEffect(() => {
    if (!drawerOpen) return;
    const onResize = () => layout.syncDrawerToViewport();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  // 订阅状态变化 → 重渲染 (拖拽 / 命令 / 联动)
  const [, setRev] = React.useState(0);
  useEffect(() => {
    return layout.subscribe(() => setRev((n) => n + 1));
  }, [layout]);

  /* ─────────────── sidebar 拖拽 ─────────────── */
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onResizerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarW };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      layout.setSidebarWidth(dragRef.current.startW + dx);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  /* ─────────────── drawer 拖拽 ─────────────── */
  const drawerDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onDrawerResizerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    drawerDragRef.current = { startX: e.clientX, startW: drawerW };
    const onMove = (ev: MouseEvent) => {
      if (!drawerDragRef.current) return;
      const dx = drawerDragRef.current.startX - ev.clientX;
      layout.setDrawerWidth(drawerDragRef.current.startW + dx);
    };
    const onUp = () => {
      drawerDragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="app-solo">
      {!sidebarCollapsed && (
        <div
          className="app-solo__sidebar"
          style={{ ['--sidebar-w' as any]: `${sidebarW}px` }}
        >
          <SlotRenderer slot={SOLO_SLOTS.Sidebar} />
        </div>
      )}
      {!sidebarCollapsed && (
        <div className="app-solo__resizer" onMouseDown={onResizerDown} role="separator" aria-orientation="vertical" />
      )}
      {/* 中列: action (顶部工具栏) + main (对话主区), 上下结构 */}
      <div className="app-solo__center">
        <div className="app-solo__action">
          <SlotRenderer slot={SOLO_SLOTS.Action} />
        </div>
        <div className="app-solo__main">
          <SlotRenderer slot={SOLO_SLOTS.Chatbot} />
        </div>
      </div>
      {/* 右侧抽屉: 关闭 0px, 打开时按 drawerW 拉宽 (可拖拽) */}
      <div
        className={`app-solo__drawer${drawerOpen ? ' is-open' : ''}`}
        style={{ ['--drawer-w' as any]: `${drawerOpen ? drawerW : 0}px` }}
      >
        {drawerOpen && (
          <div
            className="app-solo__drawer-resizer"
            onMouseDown={onDrawerResizerDown}
            role="separator"
            aria-orientation="vertical"
          />
        )}
        <SlotRenderer slot={SOLO_SLOTS.Drawer} />
      </div>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
