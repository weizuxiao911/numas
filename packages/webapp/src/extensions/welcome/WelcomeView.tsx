/**
 * extensions/welcome/WelcomeView.tsx — 通用欢迎页 (codeblitz 官方 welcome 机制)
 *
 * 渲染: 由 runtimeConfig.WelcomePage 注入官方 WelcomeContribution 的 welcome:// tab,
 *   在「未选项目 / 无打开文件」时显示 (官方规则, 见 config/runtime.ts).
 *
 * 通用空态: 提示用户选择项目开始; 不承载任何任务/仓库(repo)流程.
 */
import React from 'react';

import './welcome.css';

export const WelcomeView: React.FC = () => {
  return (
    <div className="numas-welcome">
      <div className="numas-welcome__card numas-welcome__card--plain">
        <div className="numas-welcome__logo" aria-hidden>
          🐮
        </div>
        <h1 className="numas-welcome__title">Numas 工作台</h1>
        <p className="numas-welcome__desc">请选择一个项目开始。</p>
      </div>
    </div>
  );
};
