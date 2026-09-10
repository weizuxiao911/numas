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
 * 欢迎页 (用户拍板, 2026-09): 已关闭 — runtimeConfig.startupEditor 设为非 readme/welcomePage 值,
 * codeblitz WelcomeContribution.onDidRestoreState 首分支直接 return, 不走 openWelcome() 兜底;
 * 原 numas WelcomePage 组件 (extensions/welcome) 已删除.
 */

import type { IAppRendererProps } from '@codeblitzjs/ide-core';

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  // 关闭欢迎页: startupEditor 非 readme/welcomePage 时 onDidRestoreState 直接 return
  startupEditor: 'none',
} as any;
