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
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { SOLO_SLOTS } from '../config/slots';
import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';
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
/* WorkBuddy 启动按钮与面板 toggle 之间的分隔线 */
.app-ide__top-divider {
  width: 1px; height: 16px; flex: 0 0 auto; margin: 0 6px;
  background: color-mix(in srgb, var(--editor-foreground, #1f2328) 12%, transparent);
}
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

/** WorkBuddy 启动按钮: deep link 由浏览器 (访客本机) 拉起本地 WorkBuddy 应用.
 *  公网/本地部署行为一致; 访客机器没装则浏览器无响应 (JS 无法检测). */
const WorkBuddyButton: React.FC = () => (
  <button
    type="button"
    className="app-ide__toggle"
    title="打开 WorkBuddy"
    onClick={() => { window.location.href = 'workbuddy://'; }}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  </button>
);

/** BoxPanel 从子元素 props 读 flex (同 SplitPanel), 用包装组件透传 flex=1 */
const IdeBody: React.FC<{ children?: React.ReactNode; flex?: number }> = ({ children }) => (
  <div className="app-ide__body">{children}</div>
);

export function IdeLayout(): React.ReactElement {
  const [rightVisible, setRightVisible] = React.useState(true);

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
            <WorkBuddyButton />
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
          <div className={`app-ide__right${rightVisible ? '' : ' is-collapsed'}`}>
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
