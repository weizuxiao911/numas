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

// 前置 numas 接入门控: 先探测后端 (CLI/内嵌=同源自身, 独立部署=本机 numas), 接入后才挂载 IDE.
// 未接入 → Gate 展示下载/安装引导. 关键: 挂载 App 之前不发起任何后端请求 —
// vsix metadata 预拉取收敛在 App 内 (Gate 放行后才执行), 未接入期间零后端请求.
ReactDOM.createRoot(container).render(
  React.createElement(Gate, null, React.createElement(App)),
);
