/**
 * AppLayout — /app 纯前端 UI 骨架 (左右布局)
 *
 * 现阶段与 codeblitz 无关: 纯 React 左右两列.
 *   - 左: sider 侧栏 (占位, 空)
 *   - 右: content 内容区 (占位, 空)
 * 后续在此填充具体 UI; codeblitz 工作台已撤出路由 (代码/依赖保留).
 */
import React from 'react';

import './AppLayout.css';

export const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      <aside className="app-layout__sider" aria-label="侧栏" />
      <main className="app-layout__content" aria-label="内容区" />
    </div>
  );
};
