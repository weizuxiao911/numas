/**
 * IdeLayout — IDE 模式布局
 *
 * 标准 5 槽 (top / left explorer / main editor / bottom terminal / right)
 * + 复用 SOLO 已注册的自定义槽组件 (不注册新 slot / 不改 SOLO 组件, 组合全在本文件):
 *   - top:   SOLO_SLOTS.SidebarAction (模式切换) + SOLO_SLOTS.MainAction (项目选择)
 *   - right: SOLO_SLOTS.MainContainer (AI 对话 chatbot)
 *
 * 注意: SlotRenderer 上的 defaultSize / minResize / minSize / defaultCollapsed /
 *       overflow 等尺寸/状态 prop 对外层 codeblitz panelSizes 是无效的
 *       (外层 AppRenderer appConfig.panelSizes 才是真正生效的入口).
 *       此处只描述 split 子节点的比例 (flex) 与槽位行为 (isTabbar), 不再写尺寸.
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

/** IDE 专属样式: 顶部栏排布 + 隐藏 SOLO 专用按钮 (sidebar 折叠 / aside 开关) */
const styles = `
.app-ide {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
}
.app-ide__top {
  display: flex; align-items: center;
  flex: 0 0 auto;
  height: 36px; padding: 0 12px;
  background: var(--editor-background);
  border-bottom: 1px solid var(--editor-border);
  min-width: 0;
}
.app-ide__top .app-side-topbar { flex: 0 0 auto; padding: 0; }
.app-ide__top .app-action { width: auto; min-height: 0; padding: 0; }
/* SOLO 专用按钮在 IDE 无意义: sidebar 折叠 / aside 开关 */
.app-ide .app-side-topbar__icon-btn { display: none !important; }
.app-ide .app-action__right { display: none !important; }
/* 官方视图去掉主题自带阴影 (flat 布局; explorer / 终端 / 编辑区 tabs).
   主题用 unlayered !important 定义阴影, 必须放进 @layer 的 !important 才能盖过 (cascade layer 规则) */
@layer numas-override {
  .app-ide .left-slot,
  .app-ide .bottom-slot,
  .app-ide [class*="kt_editor_tabs"] { box-shadow: none !important; }
}
/* 右栏: AI 对话 (chatbot 容器) */
.app-ide__right {
  height: 100%; min-width: 0;
  display: flex; flex-direction: column;
  border-left: 1px solid var(--editor-border);
  background: var(--editor-background);
}
.app-ide__right > * { flex: 1 1 auto; min-height: 0; min-width: 0; }
`;

/** SplitPanel 从子元素 props 读尺寸 (defaultSize/savedSize/flex), 不是 CSS flex;
 *  用包装组件把 defaultSize 透传给 SplitPanel, 同时提供边框/背景样式 */
const IdeRightPanel: React.FC<{ children?: React.ReactNode; defaultSize?: number; flex?: number }> = ({ children }) => (
  <div className="app-ide__right">{children}</div>
);

export function IdeLayout(): React.ReactElement {
  useInjectable<IMainLayoutService>(IMainLayoutService);

  return (
    <div className="app-ide">
      <style>{styles}</style>
      <BoxPanel direction="top-to-bottom">
        <div className="app-ide__top">
          <SlotRenderer slot={SOLO_SLOTS.SidebarAction} />
          <SlotRenderer slot={SOLO_SLOTS.MainAction} />
        </div>
        <SplitPanel id="main-horizontal" flex={1}>
          <SlotRenderer
            slot={SlotLocation.left}
            isTabbar
          />
          <SplitPanel id="main-vertical" minResize={300} flexGrow={1} direction="top-to-bottom">
            <SlotRenderer flex={2} flexGrow={1} minResize={200} slot={SlotLocation.main} />
            <SlotRenderer flex={1} slot={SlotLocation.bottom} isTabbar />
          </SplitPanel>
          <IdeRightPanel defaultSize={380}>
            <SlotRenderer slot={SOLO_SLOTS.MainContainer} />
          </IdeRightPanel>
        </SplitPanel>
      </BoxPanel>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
