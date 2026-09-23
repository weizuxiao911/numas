/**
 * 运行时配置 — core/config/runtime.ts
 *
 * 自定义 FileSystemProvider 接管 'file' scheme 后, 不再需要 BrowserFS mount.
 * 故此处不配置 workspace.filesystem — codeblitz fs-launch.contribution 在配置缺失时跳过 mount
 * (fs-launch.contribution.js:36-37 `if (!fsConfig) return;`).
 *
 * 文件系统实现见 ./fs.ts (CustomFileSystemProvider + DI 注入 CustomFsProviderContribution).
 * 不依赖任何 codeblitz ide-browserfs 模块, 不维护 InMemory 缓存 / 墓碑 / overlay.
 *
 * 欢迎页 (2026-09-22 重启并改造为任务引导页): `startupEditor: 'welcomePage'` +
 * `WelcomePage: WelcomeView` (extensions/welcome) 注入官方 WelcomeContribution 的 welcome:// tab;
 * 未选项目 / 无打开文件时显示: 读 URL ?repo=&issue= 展示 issue 卡片 + 6 步按钮触发对应 skill.
 * (2026-09 曾关闭欢迎页; 现按开源贡献引导需求重启, 组件为全新实现, 见 docs/AI工作台适配开源项目贡献 SPEC.md §5)
 */

import type { IAppRendererProps } from '@codeblitzjs/ide-core';

import { WelcomeView } from '../extensions/welcome';

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  // 启用欢迎页: 无打开资源时打开 welcome:// (官方 WelcomeContribution 规则)
  startupEditor: 'welcomePage',
  // 自定义欢迎页组件 (任务引导: issue 卡片 + 触发 skill 按钮)
  WelcomePage: WelcomeView,
} as any;
