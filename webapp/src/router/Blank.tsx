/**
 * Blank — 空白页 (保留备用, 当前未注册路由)
 *
 * 重新设计 webapp 时可能用到的空白占位页. 默认入口 '/' 已重定向到 '/app',
 * 故此页暂未挂路由 (见 router/index.tsx); 需要时再注册.
 */
import React from 'react';

export const Blank: React.FC = () => <div className="app-blank" aria-label="空白页" />;
