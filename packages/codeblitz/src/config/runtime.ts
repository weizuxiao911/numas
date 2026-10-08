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
 * 欢迎页: 使用 codeblitz 官方默认 welcome 视图 (无打开资源时打开 welcome://,
 * 由官方 WelcomeContribution 规则管理). 曾注入的自定义任务引导页 (extensions/welcome) 已移除.
 */

import type { IAppRendererProps } from '@codeblitzjs/ide-core';

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  // 启用欢迎页: 无打开资源时打开 welcome:// (官方 WelcomeContribution 规则)
  startupEditor: 'welcomePage',
} as any;
