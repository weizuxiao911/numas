import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppRouter } from './router';
import { installCustomEditorPatch } from './patches/patch-custom-editor';

import './config/app';

(window as any).React = React;

installCustomEditorPatch();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

// 前端路由 (webapp 外壳级): BrowserRouter 按 path 分配页面 (见 src/router).
// '/' = 默认入口 (重定向到 '/app'), '/app' = 工作台, '*' = 兜底页.
ReactDOM.createRoot(container).render(React.createElement(AppRouter));
