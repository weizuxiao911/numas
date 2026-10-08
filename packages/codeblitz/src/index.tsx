import React from 'react';
import ReactDOM from 'react-dom/client';

import { App, setAppMode } from './App';
import { installCustomEditorPatch } from './patches/patch-custom-editor';

import './config/app';

(window as any).React = React;
(window as any).__appSetMode = setAppMode;

installCustomEditorPatch();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(React.createElement(App));
