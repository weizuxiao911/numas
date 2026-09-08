/**
 * SoloLayout — SOLO 模式布局 (自己实现三列 + 拖动条)
 *
 * 不用 codeblitz BoxPanel/SplitPanel (SlotRenderer + isTabbar 跟 SplitPanel sash 互相打架,
 *  拖不了). 自己用 React state 管 sidebar 宽度, 渲染卡片 + 中间拖动手柄.
 *
 * 结构 (四槽, 见 config/slots.ts):
 *   ┌──────────┬─────────────────────────┬────────┐
 *   │ sidebar  │  action (顶部工具栏)      │        │
 *   │          ├─────────────────────────┤ drawer │
 *   │          │  main (对话主区)          │        │
 *   └──────────┴─────────────────────────┴────────┘
 *
 * 卡片样式: 在 sumi/src/styles/app-shell.css 由 App 顶层装配 (全局唯一来源).
 * WorkspacePicker / FilePicker 是 codeblitz DI 内的全局浮层, 必须在 Layout 内部渲染.
 *
 * 折叠交互: SoloLayout 持有 sidebar 宽 state, mount 时通过 sidebar/commands/sidebarApi
 * 暴露给其他拓展 (Sidebar / ActionBar), 卸载时清空. 跨拓展不破 §2.2 铁律
 * (单向: SoloLayout 是 api owner, 消费方只调 getSidebarApi() 拿快照 + 调方法).
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser/lib/react-providers/slot';

import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';
import { SOLO_SLOTS } from '../config/slots';
import {
  registerSidebarApi,
  type SidebarApi,
} from '../commands/sidebar';
import {
  registerDrawerApi,
  type DrawerApi,
} from '../commands/drawer';

const DEFAULT_SIDEBAR_W = 320;
const MIN_SIDEBAR_W = 200;
const MAX_SIDEBAR_W = 480;

/** drawer 打开时宽度 = viewport 50%, 拖拽时按 clientX 反算 */
const DRAWER_RATIO = 0.5;

function viewportRatioWidth(): number {
  return Math.round(window.innerWidth * DRAWER_RATIO);
}

export function SoloLayout(): React.ReactElement {
  // sidebar 状态用 collapsed boolean 不用 1px hack (折叠 = 完全隐藏, 1px 占位难看)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [sidebarW, setSidebarW] = useState<number>(DEFAULT_SIDEBAR_W);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  // 折叠时记住展开态的 width, 展开时恢复 (运行时 ref, reload 丢失)
  const expandedWRef = useRef<number>(DEFAULT_SIDEBAR_W);

  const subscribersRef = useRef<Array<(s: { collapsed: boolean; width: number }) => void>>([]);
  const api = useMemo<SidebarApi>(() => {
    const notify = (nextCollapsed: boolean, nextW: number) => {
      const snap = { collapsed: nextCollapsed, width: nextW };
      subscribersRef.current.forEach((cb) => cb(snap));
    };
    return {
      get collapsed() { return sidebarCollapsed; },
      get width() { return sidebarW; },
      collapse: () => {
        if (!sidebarCollapsed) expandedWRef.current = sidebarW;
        setSidebarCollapsed(true);
        notify(true, sidebarW);
      },
      expand: () => {
        const next = expandedWRef.current;
        setSidebarW(next);
        setSidebarCollapsed(false);
        notify(false, next);
      },
      toggle: () => {
        if (sidebarCollapsed) {
          const next = expandedWRef.current;
          setSidebarW(next);
          setSidebarCollapsed(false);
          notify(false, next);
        } else {
          expandedWRef.current = sidebarW;
          setSidebarCollapsed(true);
          notify(true, sidebarW);
        }
      },
      setWidth: (n: number) => {
        const clamped = Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
        setSidebarW(clamped);
        notify(sidebarCollapsed, clamped);
      },
      onChange: (cb) => {
        subscribersRef.current.push(cb);
        return () => {
          subscribersRef.current = subscribersRef.current.filter((s) => s !== cb);
        };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarCollapsed, sidebarW]);

  useEffect(() => {
    registerSidebarApi(api);
    return () => registerSidebarApi(null);
  }, [api]);

  // 最新 sidebar api 引用: drawer 联动折叠时要走 api.collapse() (触发 notify),
  // 不能直接 setSidebarCollapsed, 否则 ActionBar 的镜像订阅收不到变化
  const sidebarApiRef = useRef<SidebarApi | null>(null);
  useEffect(() => {
    sidebarApiRef.current = api;
  }, [api]);

  const onResizerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: sidebarW };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const next = Math.max(
          MIN_SIDEBAR_W,
          Math.min(MAX_SIDEBAR_W, dragRef.current.startW + dx),
        );
        setSidebarW(next);
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
    },
    [sidebarW],
  );

  /* ─────────────── drawer state ─────────────── */
  // 默认: drawer 关闭, drawerW=0
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerW, setDrawerW] = useState<number>(0);

  const drawerSubsRef = useRef<Array<(s: { open: boolean; width: number }) => void>>([]);
  const drawerApi = useMemo<DrawerApi>(() => {
    const notify = (nextOpen: boolean, nextW: number) => {
      drawerSubsRef.current.forEach((cb) => cb({ open: nextOpen, width: nextW }));
    };
    return {
      get open() { return drawerOpen; },
      get width() { return drawerW; },
      setOpen: (w?: number) => {
        const nextW = Math.max(120, w ?? (drawerW > 0 ? drawerW : viewportRatioWidth()));
        setDrawerW(nextW);
        setDrawerOpen(true);
        notify(true, nextW);
      },
      close: () => {
        setDrawerOpen(false);
        notify(false, drawerW);
      },
      toggle: () => {
        if (drawerOpen) {
          setDrawerOpen(false);
          notify(false, drawerW);
        } else {
          const nextW = drawerW <= 0 ? viewportRatioWidth() : drawerW;
          if (drawerW <= 0) setDrawerW(nextW);
          setDrawerOpen(true);
          notify(true, nextW);
        }
      },
      setWidth: (n: number) => {
        const next = Math.max(120, Math.min(window.innerWidth - 200, n));
        setDrawerW(next);
        notify(drawerOpen, next);
      },
      onChange: (cb) => {
        drawerSubsRef.current.push(cb);
        return () => {
          drawerSubsRef.current = drawerSubsRef.current.filter((s) => s !== cb);
        };
      },
    };
  }, [drawerOpen, drawerW]);

  useEffect(() => {
    registerDrawerApi(drawerApi);
    return () => registerDrawerApi(null);
  }, [drawerApi]);

  // drawer 打开时: 视口变化同步到 50% + 自动折叠 sidebar 让出空间
  useEffect(() => {
    if (!drawerOpen) return;
    const onResize = () => setDrawerW(viewportRatioWidth());
    window.addEventListener('resize', onResize);
    if (!sidebarCollapsed) {
      sidebarApiRef.current?.collapse();
    }
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  const drawerDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onDrawerResizerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drawerDragRef.current = { startX: e.clientX, startW: drawerW };
      const onMove = (ev: MouseEvent) => {
        if (!drawerDragRef.current) return;
        const dx = drawerDragRef.current.startX - ev.clientX;
        const next = Math.max(120, Math.min(window.innerWidth - 200, drawerDragRef.current.startW + dx));
        setDrawerW(next);
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
    },
    [drawerW],
  );

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
          <SlotRenderer slot={SOLO_SLOTS.Main} />
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
