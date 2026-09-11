/**
 * IdeLayout — IDE 模式布局
 *
 * 标准槽 (top / left explorer / main editor / bottom terminal)
 * + 复用 SOLO 已注册的自定义槽组件 (不注册新 slot / 不改 SOLO 组件, 组合全在本文件):
 *   - top:   左组 = SOLO_SLOTS.SidebarAction (模式切换) + SOLO_SLOTS.MainAction (项目选择)
 *            右组 = 面板 toggle (左栏/底部/右栏, 参考 ../numas extensions/actions)
 *   - right: SOLO_SLOTS.MainContainer (AI 对话 chatbot, 独立列可折叠 + 宽度过渡)
 *
 * 注意: SplitPanel 从**子元素 props** 读尺寸 (defaultSize/savedSize/flex), 不是 CSS flex;
 *       包装组件 (IdeBody) 需透传这些 props.
 *
 * WorkspacePicker / FilePicker 是全局浮层, 必须在 codeblitz DI 内渲染.
 */
import React from 'react';
// import { createPortal } from 'react-dom'; // WorkBuddy 功能已整体注释, 恢复时一并取消注释
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { CommandService } from '@opensumi/ide-core-common';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { SOLO_SLOTS } from '../config/slots';
import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/file';
import { IdeRightTopbar } from './IdeRightTopbar';

/** IDE 专属样式: 顶部栏左右布局 + 面板 toggle + 右栏折叠过渡 + flat 背景/去阴影 */
const styles = `
.app-ide {
  --resizer-w: 6px;
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
}
.app-ide__top {
  display: flex; align-items: center; justify-content: space-between;
  flex: 0 0 auto;
  height: 48px; padding: 0 12px;
  /* 跟 SOLO sidebar 同色 (偏灰 token, overrides.css 亮色块同款 mix) */
  background: color-mix(in srgb, var(--editor-background, #ffffff) 97%, var(--editor-foreground, #1f2328));
  min-width: 0;
}
/* 左组: 模式切换 + 项目选择 (紧邻, 不居中) */
.app-ide__top-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
/* 右组: 面板 toggle (左栏/底部/右栏) */
.app-ide__top-right { display: flex; align-items: center; gap: 2px; margin-left: auto; padding-left: 8px; }
.app-ide__toggle {
  width: 32px; height: 32px; flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--descriptionForeground, #8f8f8f);
  border-radius: 8px;
  transition: background .12s, color .12s;
}
.app-ide__toggle:hover { background: color-mix(in srgb, currentColor 14%, transparent); color: var(--editor-foreground); }
.app-ide__toggle.is-active { color: var(--editor-foreground); }
.app-ide__top .app-side-topbar { flex: 0 0 auto; padding: 0; }
/* === WorkBuddy 启动按钮 + 下载引导样式 (用户要求暂时注释掉整个功能; 恢复时去掉本块注释) ===
.app-ide__top-divider {
  width: 1px; height: 16px; flex: 0 0 auto; margin: 0 6px;
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 12%, transparent);
}
.app-ide__wb-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, .28);
}
.app-ide__wb-modal {
  width: 360px; max-width: calc(100vw - 48px);
  padding: 20px 20px 16px;
  background: var(--editorWidget-background, #fff);
  border: 1px solid var(--panel-border, rgba(0,0,0,.12));
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .24);
  font-size: 13px; color: var(--editor-foreground, #1f2328);
  text-align: center;
}
.app-ide__wb-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.app-ide__wb-desc { color: var(--descriptionForeground, #8f8f8f); line-height: 1.6; margin-bottom: 16px; }
.app-ide__wb-actions { display: flex; gap: 8px; justify-content: center; }
.app-ide__wb-btn {
  height: 30px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--panel-border, rgba(0,0,0,.12)); border-radius: 8px;
  background: none; color: inherit; font-size: 13px; font-family: inherit;
  text-decoration: none; cursor: pointer;
  transition: background .12s, opacity .12s;
}
.app-ide__wb-btn:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.app-ide__wb-btn.is-primary {
  background: #6366f1; border-color: transparent; color: #fff;
}
.app-ide__wb-btn.is-primary:hover { background: #6366f1; opacity: .9; }
=== end WorkBuddy === */
.app-ide__top .app-action { width: auto; min-height: 0; padding: 0; }
/* SOLO 专用按钮在 IDE 无意义: sidebar 折叠 / aside 开关 */
.app-ide .app-side-topbar__icon-btn { display: none !important; }
.app-ide .app-action__right { display: none !important; }
/* explorer 标题栏动作图标 (新建文件/文件夹/筛选/刷新/折叠): design 主题默认 2px 尺寸 +
   全局 .kt-icon::before display:none → 不可见. 与 SOLO aside sidebar 同款修复. */
.app-ide [class*="view_container"] [class*="titleActions"] span[class*="iconAction"] {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; margin-left: 4px;
}
.app-ide [class*="titleActions"] span[class*="iconAction"]::before,
.app-ide [class*="titleActions"] span[class*="btnAction"]::before { display: inline-block !important; }
/* SplitPanel 拖拽条: 宽度/命中区对齐 SOLO resizer (--resizer-w 6px), 1px 线居中留呼吸感 */
.app-ide [class*="resize-handle-horizontal"] {
  width: var(--resizer-w) !important;
  margin-left: calc(var(--resizer-w) / -2) !important;
  margin-right: calc(var(--resizer-w) / -2) !important;
}
.app-ide [class*="resize-handle-horizontal"]::before { left: calc(var(--resizer-w) / 2) !important; }
.app-ide [class*="resize-handle-vertical"] {
  height: var(--resizer-w) !important;
  margin-top: calc(var(--resizer-w) / -2) !important;
  margin-bottom: calc(var(--resizer-w) / -2) !important;
}
.app-ide [class*="resize-handle-vertical"]::before { top: calc(var(--resizer-w) / 2) !important; }
/* 主体: [SplitPanel (左栏+中区)] + [右栏 chatbot] 横向排列, 右栏宽度可折叠过渡.
   BoxPanel 的 wrapper (CSS-module 类名) 默认 min-height:auto, 内容 (长会话) 会把它撑出视口 → 必须允许收缩 */
.app-ide [class*="box-panel"] > [class*="wrapper"] { min-height: 0; }
.app-ide__body { display: flex; flex-direction: row; height: 100%; flex: 1 1 auto; min-height: 0; min-width: 0; }
.app-ide__right {
  flex: 0 0 450px; width: 450px; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  border-left: 1px solid var(--editor-border);
  background: var(--editor-background);
  overflow: hidden;
  transition: flex-basis 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1);
}
.app-ide__right.is-collapsed { flex-basis: 0; width: 0; border-left: none; }
/* 拖拽中关闭过渡, 避免宽度跳动跟随滞后 */
.app-ide__right.is-dragging { transition: none; }
/* 右栏 resizer: 6px 命中区 + 1px 主线, 对齐 SplitPanel resizer (--resizer-w) */
.app-ide__right-resizer {
  flex: 0 0 var(--resizer-w, 6px);
  width: var(--resizer-w, 6px);
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 2;
}
.app-ide__right-resizer::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 50%;
  width: 1px;
  background: var(--editor-border);
  transform: translateX(-0.5px);
}
.app-ide__right-resizer:hover::before,
.app-ide__right-resizer.is-dragging::before {
  background: var(--button-background, #6366f1);
  width: 2px;
}
/* SlotRenderer 的 wrapper 默认 block, 会让内部 chatbot 的 flex 高度失效 (内容撑高顶出 composer);
   这里把它变成受约束的 flex 列容器. 注意排除 topbar 内的 <style> 标签 (否则会被当 flex 项占高) */
.app-ide__right > *:not(.app-ide__chat-topbar):not(style) {
  flex: 1 1 auto; min-height: 0; min-width: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
}
/* 主题用 unlayered !important 定义背景/阴影, 必须放进 @layer 的 !important 才能盖过 */
@layer numas-override {
  /* 去掉所有阴影 (flat 布局) */
  .app-ide,
  .app-ide * { box-shadow: none !important; }
  /* top + activity bar 背景跟 SOLO sidebar 一致 (偏灰 token; 主题默认半透明白) */
  .app-ide .left-slot,
  .app-ide [class*="left_tab"],
  .app-ide [class*="bar_content"] {
    background: color-mix(in srgb, var(--editor-background, #ffffff) 97%, var(--editor-foreground, #1f2328)) !important;
  }
  /* 面板内容区用 #fff token (主题默认透明, 会透出左侧灰底) */
  .app-ide .kt-tab-panel { background: var(--editor-background, #ffffff) !important; }
}
`;

/** 内置浏览器按钮: 在编辑区打开浏览器 tab (browser.open 全局命令, 跨拓展契约) */
const IdeBrowserButton: React.FC = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  return (
    <button
      type="button"
      className="app-ide__toggle"
      title="打开浏览器"
      onClick={() => void commandService.executeCommand('browser.open')}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
      </svg>
    </button>
  );
};

/** 面板 toggle: 左栏 / 底部 / 右栏 (右栏为自绘列, 走本地 state + 宽度过渡) */
const PanelToggles: React.FC<{ rightVisible: boolean; onToggleRight: () => void }> = ({ rightVisible, onToggleRight }) => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const [leftVisible, setLeftVisible] = React.useState<boolean>(true);
  const [bottomVisible, setBottomVisible] = React.useState<boolean>(true);

  React.useEffect(() => {
    const disposables: Array<{ dispose(): void }> = [];
    const bind = (slot: string, setter: (v: boolean) => void) => {
      try {
        const service = layoutService.getTabbarService(slot);
        const sync = () => setter(layoutService.isVisible(slot));
        sync();
        disposables.push(service.onCurrentChange(sync));
        disposables.push(service.onSizeChange(sync));
      } catch { /* service 未就绪忽略 */ }
    };
    bind(SlotLocation.left, setLeftVisible);
    bind(SlotLocation.bottom, setBottomVisible);
    return () => disposables.forEach((d) => d.dispose());
  }, [layoutService]);

  const toggleSlot = (slot: string) => {
    try { layoutService.toggleSlot(slot); } catch { /* ignore */ }
  };

  const PanelIcon: React.FC<{ side: 'left' | 'bottom' | 'right'; filled: boolean }> = ({ side, filled }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {side === 'left' && (filled
        ? <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" />
        : <line x1="9" y1="4" x2="9" y2="20" />)}
      {side === 'bottom' && (filled
        ? <rect x="3" y="16" width="18" height="4" fill="currentColor" stroke="none" />
        : <line x1="3" y1="16" x2="21" y2="16" />)}
      {side === 'right' && (filled
        ? <rect x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" />
        : <line x1="15" y1="4" x2="15" y2="20" />)}
    </svg>
  );

  return (
    <>
      <button type="button" className={`app-ide__toggle${leftVisible ? ' is-active' : ''}`} title="切换左侧栏" onClick={() => toggleSlot(SlotLocation.left)}>
        <PanelIcon side="left" filled={leftVisible} />
      </button>
      <button type="button" className={`app-ide__toggle${bottomVisible ? ' is-active' : ''}`} title="切换底部面板" onClick={() => toggleSlot(SlotLocation.bottom)}>
        <PanelIcon side="bottom" filled={bottomVisible} />
      </button>
      <button type="button" className={`app-ide__toggle${rightVisible ? ' is-active' : ''}`} title="切换右侧栏" onClick={onToggleRight}>
        <PanelIcon side="right" filled={rightVisible} />
      </button>
    </>
  );
};

/* === WorkBuddy 启动按钮 (用户要求暂时注释掉整个功能; 恢复时去掉本块注释 + JSX 使用处 + 顶部 import) ===
const WORKBUDDY_DOWNLOAD_URL = 'https://www.workbuddy.cn/';

 * WorkBuddy 启动按钮 (IDE 顶栏右侧).
 *
 * 启动方式: 浏览器 (访客本机) 执行 `workbuddy://` deep link, 拉起访客电脑上安装的
 * WorkBuddy 客户端. 公网/本地部署行为一致 (服务端 `open -a` 只能拉起服务器本机, 不可用).
 *
 * 未安装检测 (JS 无 API 可查协议是否注册, 只能间接推断):
 *   1. 点击时注册 window `blur` + document `visibilitychange` 监听, 启动 2.5s 定时器,
 *      再执行 location.href='workbuddy://';
 *   2. 已安装: 浏览器弹「打开 WorkBuddy?」→ 用户确认 → 应用启动 → 浏览器窗口失焦
 *      → blur 触发 → 取消定时器, 不弹引导;
 *   3. 未安装: 浏览器静默忽略该协议 → 页面不失焦 → 2.5s 定时器到点 → 弹下载引导 modal;
 *   4. 信号一到即 stopWatch() (清定时器 + 摘监听), 快速连点/卸载不残留.
 *
 * 已知误判: 已安装但用户在浏览器弹窗停留 >2.5s 也会弹引导 → modal 文案提示
 * 「若已安装请在浏览器弹窗选打开」并提供「重试打开」; 等待期间切走标签页
 * (visibilitychange→hidden) 视为已离开, 不弹.
 *
const WorkBuddyButton: React.FC = () => {
  const [showGuide, setShowGuide] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const signalRef = React.useRef<(() => void) | null>(null);

  // 清定时器 + 摘失焦监听 (launch 重入 / 组件卸载 / 信号到达都走这里)
  const stopWatch = React.useCallback(() => {
    if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (signalRef.current) {
      window.removeEventListener('blur', signalRef.current);
      document.removeEventListener('visibilitychange', signalRef.current);
      signalRef.current = null;
    }
  }, []);

  const launch = React.useCallback(() => {
    stopWatch();
    setShowGuide(false);
    // 失焦信号 = 应用被拉起 (或用户切走), 取消未安装判定
    const signal = () => stopWatch();
    signalRef.current = signal;
    window.addEventListener('blur', signal);
    document.addEventListener('visibilitychange', signal);
    // 2.5s 内无任何失焦信号 → 判定未安装 → 弹下载引导
    timerRef.current = window.setTimeout(() => {
      stopWatch();
      setShowGuide(true);
    }, 2500);
    window.location.href = 'workbuddy://';
  }, [stopWatch]);

  React.useEffect(() => stopWatch, [stopWatch]);
  React.useEffect(() => {
    if (!showGuide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowGuide(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGuide]);

  return (
    <>
      <button type="button" className="app-ide__toggle" title="打开 WorkBuddy" onClick={launch}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4h6v6" />
          <path d="M20 4l-8 8" />
          <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
        </svg>
      </button>
      {showGuide && createPortal(
        <div
          className="app-ide__wb-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGuide(false); }}
        >
          <div className="app-ide__wb-modal" role="dialog" aria-modal="true">
            <div className="app-ide__wb-title">未检测到 WorkBuddy</div>
            <div className="app-ide__wb-desc">
              若已安装, 请在浏览器弹窗中选择「打开 WorkBuddy」; 若尚未安装, 可前往官网下载客户端.
            </div>
            <div className="app-ide__wb-actions">
              <a className="app-ide__wb-btn is-primary" href={WORKBUDDY_DOWNLOAD_URL} target="_blank" rel="noreferrer">前往下载</a>
              <button type="button" className="app-ide__wb-btn" onClick={launch}>重试打开</button>
              <button type="button" className="app-ide__wb-btn" onClick={() => setShowGuide(false)}>取消</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
=== end WorkBuddy === */

/** BoxPanel 从子元素 props 读 flex (同 SplitPanel), 用包装组件透传 flex=1 */
const IdeBody: React.FC<{ children?: React.ReactNode; flex?: number }> = ({ children }) => (
  <div className="app-ide__body">{children}</div>
);

const IDE_RIGHT_W_KEY = 'NUMAS_IDE_RIGHT_W';
const loadRightW = (): number => {
  const n = Number(localStorage.getItem(IDE_RIGHT_W_KEY));
  return Number.isFinite(n) && n > 0 ? Math.min(900, Math.max(300, n)) : 450;
};

export function IdeLayout(): React.ReactElement {
  const [rightVisible, setRightVisible] = React.useState(true);
  const [rightW, setRightW] = React.useState<number>(loadRightW);
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef<{ startX: number; startW: number } | null>(null);

  const onRightResizerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: rightW };
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.startX - ev.clientX;
      const next = dragRef.current.startW + dx;
      // 左移变宽 (跟 SOLO aside 一致); 钳制范围 + 给主区留最小宽度
      const min = 300;
      const max = Math.min(900, Math.max(min, window.innerWidth - 360));
      setRightW(Math.min(max, Math.max(min, next)));
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      setRightW((w) => {
        localStorage.setItem(IDE_RIGHT_W_KEY, String(w));
        return w;
      });
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
    <div className="app-ide">
      <style>{styles}</style>
      <BoxPanel direction="top-to-bottom">
        <div className="app-ide__top">
          <div className="app-ide__top-left">
            <SlotRenderer slot={SOLO_SLOTS.SidebarAction} />
            <SlotRenderer slot={SOLO_SLOTS.MainAction} />
          </div>
          <div className="app-ide__top-right">
            {/* WorkBuddy 启动按钮 (用户要求暂时注释掉整个功能, 恢复时去掉注释即可)
            <WorkBuddyButton />
            <span className="app-ide__top-divider" />
            */}
            <IdeBrowserButton />
            <span className="app-ide__top-divider" />
            <PanelToggles rightVisible={rightVisible} onToggleRight={() => setRightVisible((v) => !v)} />
          </div>
        </div>
        <IdeBody flex={1}>
          <SplitPanel id="main-horizontal" flex={1}>
            <SlotRenderer
              slot={SlotLocation.left}
              isTabbar
              minResize={204}
            />
            <SplitPanel id="main-vertical" minResize={300} flexGrow={1} direction="top-to-bottom">
              <SlotRenderer flex={2} flexGrow={1} minResize={200} slot={SlotLocation.main} />
              <SlotRenderer flex={1} slot={SlotLocation.bottom} isTabbar />
            </SplitPanel>
          </SplitPanel>
          {rightVisible && (
            <div
              className={`app-ide__right-resizer${dragging ? ' is-dragging' : ''}`}
              onMouseDown={onRightResizerDown}
              role="separator"
              aria-orientation="vertical"
            />
          )}
          <div
            className={`app-ide__right${rightVisible ? '' : ' is-collapsed'}${dragging ? ' is-dragging' : ''}`}
            style={rightVisible ? { flexBasis: rightW, width: rightW } : undefined}
          >
            <IdeRightTopbar />
            <SlotRenderer slot={SOLO_SLOTS.MainContainer} />
          </div>
        </IdeBody>
      </BoxPanel>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
