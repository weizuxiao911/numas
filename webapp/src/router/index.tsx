/**
 * src/router — 前端路由 (webapp 外壳级)
 *
 * 机制: react-router-dom v6 BrowserRouter (History 模式).
 *   - 服务端 (opencode serve) 对未知路径回退 index.html → History 路由可用
 *     (见 packages/opencode/src/server/shared/ui.ts); dev 侧 webpack devServer 已配 historyApiFallback.
 *   - 仅管"外壳级"页面分配, 不进 codeblitz/opensumi 框架内部 (其自有 scheme/URI 体系).
 *
 * 当前骨架 (重新设计 webapp 的起点):
 *   - '' / '/'  默认入口 → 重定向到 '/app'
 *   - '/app'    纯前端 UI 骨架 (AppLayout: 左 sider + 右 content)
 *   - '*'       兜底页 (未匹配路由)
 *   - Blank (默认空白页) / codeblitz 工作台 (App) 暂保留, 未注册路由
 */
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '../pages/AppLayout';
import { NotFound } from './NotFound';

export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppLayout />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);
