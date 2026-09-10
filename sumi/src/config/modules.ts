/**
 * 内置模块注册表 — core/config/modules.ts
 *
 * DI 注册: 内置 service 模块 + vsix 拓展模块 + contribution.
 * 顺序: 我们 service 先, FsProviderModule / FileDocModule 最后.
 *
 * codeblitz 官方模块 (TerminalNextModule / TaskModule) 不在此处导入,
 * 走框架 defaultModules 自动注入 (App.tsx: getDefaultAppConfig().modules).
 *
 * vsix 拓展模块 (DashboardModule / ChatbotModule) 在此注册, 装 left / main 槽.
 */

import { AgentModule } from '../service/opencode';
import { ExtensionModule } from '../service/extension';
import { FsModule, FsProviderModule } from '../service/filesystem';
import { FileDocModule } from '../service/filesystem/doc-provider';
import { TerminalModule } from '../service/pty';
import { TerminalNextModule } from '@opensumi/ide-terminal-next/lib/browser';
import { EditorModule } from '../service/editor';
import { StateModule } from '../service/state';
import { PortsModule } from '../service/ports';
import { LayoutModule } from '../service/layout';
import { BrandModule } from '../service/brand';
import { SessionModule } from '../service/session';

import { EditorRestoreFallbackModule } from '../contribution/editor-restore';

import { SideTopbarModule } from '../extensions/side-topbar';
import { SessionsModule } from '../extensions/sessions';
import { ActionModule } from '../extensions/action';
import { ChatbotModule } from '../extensions/chatbot';
import { AsideTopbarModule } from '../extensions/aside-topbar';
import { ContextModule } from '../extensions/context';
import { FilesModule } from '../extensions/files';
import { WorkspaceModule } from '../extensions/workspace';

export function getBuiltinModules(_opts?: { vsixMetadata?: any[] }): any[] {
  return [
    // service 层 (DI 单例)
    AgentModule,           // opencode AI 智能体能力
    ExtensionModule,       // vsix 拓展 (registry @ :7790)
    FsModule,              // 文件系统 (FilePicker IO)
    TerminalModule,        // 伪终端 (codeblitz 终端协议)
    EditorModule,          // 编辑器能力 (open / openWith)
    StateModule,           // codeblitz 状态 (workspace / recent)
    PortsModule,           // 本地服务端口发现 (面板 + 事件)
    LayoutModule,          // SOLO 布局状态 (sidebar / aside 折叠 + 宽度 + 命令)
    BrandModule,           // 品牌信息 (名称 / logo / slogan)
    SessionModule,         // 登录态 (cookie → session.yaml → 用户信息)
    TerminalNextModule,    // 官方终端 UI (bottom slot; solo 终端模式渲染于 aside)

    // contribution 层 (lifecycle / UI 状态)
    EditorRestoreFallbackModule, // 官方 workbench tab 恢复的延迟兜底 (早期 handlesUri 未就绪)

    // vsix 拓展 (UI 组件, 走 ComponentContribution 装 solo slot)
    SideTopbarModule,      // 左列 sidebar.action (模式切换 + 折叠)
    SessionsModule,        // 左列 sidebar.container (新建会话 + 历史会话)
    ActionModule,          // 中列 main.action
    ChatbotModule,         // 中列 main.container (对话主区)
    AsideTopbarModule,     // 右列 aside.action (查看/终端 胶囊)
    ContextModule,         // 编辑器/终端选区 + 文件树「添加到对话」(契约: chatbot.addContext 命令)
    FilesModule,           // 文件树: 上传/下载/压缩 zip (右键 + 标题栏上传按钮)

    // workspace 根同步 (官方 explorer/editor 读 IWorkspaceService; 查看模式依赖)
    WorkspaceModule,

    // 自定义 file scheme provider (覆盖 codeblitz 默认 DiskFileSystemProvider)
    FsProviderModule,

    // file scheme 文档 provider (权重 30 > codeblitz 20): editor 读/保存改走主线程 FSC → HTTP
    FileDocModule,
  ];
}
