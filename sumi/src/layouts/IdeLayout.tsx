/**
 * IdeLayout — IDE 模式布局 (5 槽)
 *
 * 完整 IDE: top / left (sidebar) / main+bottom (主区+面板) / right
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

import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';

export function IdeLayout(): React.ReactElement {
  useInjectable<IMainLayoutService>(IMainLayoutService);

  return (
    <>
      <BoxPanel direction="top-to-bottom">
        <SlotRenderer slot="top" />
        <SplitPanel id="main-horizontal" flex={1}>
          <SlotRenderer
            slot={SlotLocation.left}
            isTabbar
          />
          <SplitPanel id="main-vertical" minResize={300} flexGrow={1} direction="top-to-bottom">
            <SlotRenderer flex={2} flexGrow={1} minResize={200} slot={SlotLocation.main} />
            <SlotRenderer flex={1} slot={SlotLocation.bottom} isTabbar />
          </SplitPanel>
          <SlotRenderer slot={SlotLocation.right} isTabbar />
        </SplitPanel>
      </BoxPanel>
      <WorkspacePicker />
      <FilePicker />
    </>
  );
}
