/**
 * PlaceholderLayout — 占位布局 (SOLO / IDE 模式拆除后的临时唯一形态)
 *
 * 背景 (2026-10-10): 原 SOLO / IDE 双模式布局 (SoloLayout / IdeLayout) 及模式切换
 *   已整体移除, 待后续重做统一布局. 当前仅渲染官方 main 槽 (编辑器 / 无项目时欢迎页),
 *   作为最小占位, 保证应用非空白且可继续开发.
 */
import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';

export const PlaceholderLayout: React.FC = () => {
  return (
    <div className="app-placeholder">
      <SlotRenderer slot={SlotLocation.main} />
    </div>
  );
};
