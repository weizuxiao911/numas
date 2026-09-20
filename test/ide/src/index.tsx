import React from 'react';
import ReactDOM from 'react-dom/client';

import { App, setAppMode } from './App';
import { Gate } from './gate/Gate';
import { installCustomEditorPatch } from './patches/patch-custom-editor';

import './config/app';

(window as any).React = React;
(window as any).__appSetMode = setAppMode;

installCustomEditorPatch();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

// 前置 numas 接入门控: 先探测/唤起本地 numas, 接入成功后才挂载 IDE (App).
// 未安装 → Gate 展示下载/安装引导, 用户接入后可重试.
// 关键: 挂载 App 之前不发起任何对本地 numas (24096) 的请求 —
// vsix metadata 预拉取收敛在 App 内 (Gate 放行后才执行), 未安装期间零后端请求.
ReactDOM.createRoot(container).render(
  React.createElement(Gate, null, React.createElement(App)),
);
