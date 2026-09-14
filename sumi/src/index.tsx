import React from 'react';
import ReactDOM from 'react-dom/client';

import { App, setAppMode } from './App';
import { installCustomEditorPatch } from './patches/patch-custom-editor';
import { preloadExtensionMetadata } from './service/extension';

import './config/app';

(window as any).React = React;
(window as any).__appSetMode = setAppMode;

installCustomEditorPatch();

// 渲染前先把 vsix metadata 拉好写入全局缓存: createApp 只在 AppRenderer 挂载时执行一次,
// 若此时 metadata 未就绪会永久只剩内置扩展 (线上 vsix 全部失效的根因). 这里同步等待,
// 保证 createApp 一定拿到完整 vsix 清单. 失败/超时 (installMetadata 内部兜底) 走空降级.
void preloadExtensionMetadata();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(React.createElement(App));
