/**
 * index.tsx — sumi 入口
 *
 * 启动顺序:
 *   1. config/app.ts 模块加载副作用: 注入 __APP_CONFIG__
 *   2. installCustomEditorPatch (webview 生命周期 patch, 框架级)
 *   3. createRoot(<App />)
 *
 * 冷启动: App = ChatHome (splash + chat 主页 + 进 IDE 按钮).
 * 用户点「进入 IDE」才装 codeblitz AppRenderer, 触发 fs 链.
 * 避免冷启动 IDE 兜底 "正在加载..." 文案.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { installCustomEditorPatch } from './patches/patch-custom-editor';

import './config/app';

(window as any).React = React;

installCustomEditorPatch();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(React.createElement(App));
