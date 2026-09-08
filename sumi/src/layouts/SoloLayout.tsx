/**
 * SoloLayout — SOLO 模式布局 (chat 风格, 自己实现 2 大卡片 + 拖动条)
 *
 * 不用 codeblitz BoxPanel/SplitPanel (SlotRenderer + isTabbar 跟 SplitPanel sash 互相打架,
 *  拖不了). 自己用 React state 管 sidebar 宽度, 渲染 2 个 card + 中间拖动手柄.
 *
 * 卡片样式: 在 sumi/src/styles/app-shell.css 由 App 顶层装配 (全局唯一来源).
 * WorkspacePicker / FilePicker 是 codeblitz DI 内的全局浮层, 必须在 Layout 内部渲染.
 *
 * 折叠交互: SoloLayout 持有 sidebar 宽 state, mount 时通过 sidebar/commands/sidebarApi
 * 暴露给其他拓展 (Sidebar / ChatbotMain), 卸载时清空. 跨拓展不破 §2.2 铁律
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
} from '../extensions/sidebar/commands/sidebarApi';

const DEFAULT_SIDEBAR_W = 256;
const MIN_SIDEBAR_W = 1;
const MAX_SIDEBAR_W = 480;
const COLLAPSED_W = 1;
const SAVED_W_KEY = 'numas.solo.sidebarWidth';
const SAVED_EXPANDED_W_KEY = 'numas.solo.sidebarExpandedWidth';

function readSavedExpandedWidth(): number {
  const v = localStorage.getItem(SAVED_EXPANDED_W_KEY);
  if (!v) return DEFAULT_SIDEBAR_W;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return DEFAULT_SIDEBAR_W;
  return Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
}

export function SoloLayout(): React.ReactElement {
  const [sidebarW, setSidebarW] = useState<number>(() => {
    const saved = localStorage.getItem(SAVED_W_KEY);
    const n = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_W;
    if (!Number.isFinite(n)) return DEFAULT_SIDEBAR_W;
    return Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  // 折叠时记住展开态的 width, 展开时恢复
  const expandedWRef = useRef<number>(readSavedExpandedWidth());

  useEffect(() => {
    localStorage.setItem(SAVED_W_KEY, String(sidebarW));
    if (sidebarW > COLLAPSED_W) {
      expandedWRef.current = sidebarW;
      localStorage.setItem(SAVED_EXPANDED_W_KEY, String(sidebarW));
    }
  }, [sidebarW]);

  const subscribersRef = useRef<Array<(s: { collapsed: boolean; width: number }) => void>>([]);
  const api = useMemo<SidebarApi>(() => {
    const notify = (nextW: number) => {
      const snap = { collapsed: nextW <= COLLAPSED_W, width: nextW };
      subscribersRef.current.forEach((cb) => cb(snap));
    };
    return {
      get collapsed() { return sidebarW <= COLLAPSED_W; },
      get width() { return sidebarW; },
      collapse: () => {
        const next = COLLAPSED_W;
        if (sidebarW > COLLAPSED_W) {
          expandedWRef.current = sidebarW;
          localStorage.setItem(SAVED_EXPANDED_W_KEY, String(sidebarW));
        }
        setSidebarW(next);
        notify(next);
      },
      expand: () => {
        const next = expandedWRef.current;
        setSidebarW(next);
        notify(next);
      },
      toggle: () => {
        if (sidebarW <= COLLAPSED_W) {
          const next = expandedWRef.current;
          setSidebarW(next);
          notify(next);
        } else {
          expandedWRef.current = sidebarW;
          localStorage.setItem(SAVED_EXPANDED_W_KEY, String(sidebarW));
          setSidebarW(COLLAPSED_W);
          notify(COLLAPSED_W);
        }
      },
      setWidth: (n: number) => {
        const clamped = Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n));
        setSidebarW(clamped);
        notify(clamped);
      },
      onChange: (cb) => {
        subscribersRef.current.push(cb);
        return () => {
          subscribersRef.current = subscribersRef.current.filter((s) => s !== cb);
        };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarW]);

  useEffect(() => {
    registerSidebarApi(api);
    return () => registerSidebarApi(null);
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

  return (
    <div className="app-solo">
      <div
        className="app-solo__sidebar"
        style={{ ['--sidebar-w' as any]: `${sidebarW}px` }}
      >
        <SlotRenderer slot={SOLO_SLOTS.Sidebar} />
      </div>
      {sidebarW > COLLAPSED_W && (
        <div className="app-solo__resizer" onMouseDown={onResizerDown} role="separator" aria-orientation="vertical" />
      )}
      <div className="app-solo__composer" style={{ flex: 1, minWidth: 0 }}>
        <SlotRenderer slot={SOLO_SLOTS.Composer} />
      </div>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
