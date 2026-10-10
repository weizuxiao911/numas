/**
 * NotFound — 路由兜底页 (*)
 *
 * 未匹配任何路由时显示. 占位实现, 重新设计布局时再美化.
 */
import React from 'react';

export const NotFound: React.FC = () => (
  <div className="app-notfound">
    <div className="app-notfound__code">404</div>
    <p className="app-notfound__text">页面不存在</p>
  </div>
);
