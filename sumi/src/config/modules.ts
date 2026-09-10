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
import { EditorModule } from '../service/editor';
import { StateModule } from '../service/state';
import { PortsModule } from '../service/ports';
import { LayoutModule } from '../service/layout';
import { BrandModule } from '../service/brand';
import { SessionModule } from '../service/session';

import { EditorRestoreFallbackModule } from '../contribution/editor-restore';

import { SidebarModule } from '../extensions/sidebar';
import { ActionModule } from '../extensions/action';
import { ChatbotModule } from '../extensions/chatbot';
import { UserModule } from '../extensions/user';
import { DrawerExplorerModule } from '../extensions/drawer-explorer';

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
    LayoutModule,          // SOLO 布局状态 (sidebar / drawer 折叠 + 宽度 + 命令)
    BrandModule,           // 品牌信息 (名称 / logo / slogan)
    SessionModule,         // 登录态 (cookie → session.yaml → 用户信息)

    // contribution 层 (lifecycle / UI 状态)
    EditorRestoreFallbackModule, // 官方 workbench tab 恢复的延迟兜底 (早期 handlesUri 未就绪)

    // vsix 拓展 (UI 组件, 走 ComponentContribution 装 codeblitz slot)
    SidebarModule,         // 首页侧栏 (sidebar 槽)
    ActionModule,          // 顶部工具栏 (action 槽)
    ChatbotModule,         // 对话主区 (main 槽)
    UserModule,            // sidebar 底部左: 用户信息 (user slot)
    DrawerExplorerModule,  // 抽屉: 官方 explorer (FileTree)

    // 自定义 file scheme provider (覆盖 codeblitz 默认 DiskFileSystemProvider)
    FsProviderModule,

    // file scheme 文档 provider (权重 30 > codeblitz 20): editor 读/保存改走主线程 FSC → HTTP
    FileDocModule,
  ];
}
