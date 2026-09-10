/**
 * workspace 拓展入口 — web/src/extensions/workspace/module.ts
 *
 * 职责:
 *  - 同步 codeblitz 工作区根 (IWorkspaceService.setWorkspace) — 官方 explorer/editor
 *    读该根; workdir 切换 (不 reload) 时跟随刷新 FileTree
 *  - WorkspacePicker modal (被 chat 通过 workspace:request-show 事件触发)
 *  - WorkspaceView 引导页 (无 APP_CWD 时 Explorer 显示, 提示去 chat 切目录)
 *
 * 工作目录切换入口已下放到 chat 输入框底部, 这里是单一 module, 不再注册 OPEN_FOLDER 命令.
 * 事件链:
 *   [chat 输入框] --workspace:request-show--> [WorkspacePicker]
 *   [WorkspacePicker.confirm] --setCwd()--> [workdir:changed] --> [本 module 同步根 + 刷新树]
 */

import { Injectable, Autowired } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry, BrowserModule, ClientAppContribution, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { Disposable, URI, FileStat, CommandService } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace.interface';
import { IFileTreeService } from '@opensumi/ide-file-tree-next/lib/common';

import { getWorkdir, subscribeWorkdir } from '../../infra/url';
import { normalizeCwdPath } from '../../infra/path';

@Injectable()
@Domain(CommandContribution, ClientAppContribution)
export class WorkspaceContribution implements CommandContribution, ClientAppContribution {
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;
  @Autowired(IFileTreeService)
  fileTreeService: IFileTreeService;
  @Autowired(CommandService)
  commandService: CommandService;

  private readonly toDispose = new Disposable();

  registerCommands(commands: CommandRegistry): void {
    // 不再注册 OPEN_FOLDER — 切工作目录入口统一在 chat 输入框底部
  }

  async onStart(): Promise<void> {
    // workspace 来源: URL `?directory=` / localStorage (source-of-truth).
    // 启动同步一次 (不动编辑器, 避免打断 tab 恢复) + 订阅 workdir 切换跟随同步.
    void this.applyWorkspace(getWorkdir());
    this.toDispose.addDispose({ dispose: subscribeWorkdir((next) => void this.switchWorkspace(next)) });
  }

  /** 项目切换: 同步根 + 关闭旧项目打开的编辑器 (workbench 状态跟随切换重置). */
  private async switchWorkspace(dir: string): Promise<void> {
    await this.applyWorkspace(dir);
    try {
      await this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE_ALL.id);
    } catch (e) {
      console.warn('[workspace] close all editors 失败:', e);
    }
  }

  /** setWorkspace 同步 codeblitz 工作区根 (官方 explorer/editor 读此根). */
  private async applyWorkspace(dir: string): Promise<void> {
    const ws = normalizeCwdPath(dir);
    if (!ws) return;
    const driveLower = ws.replace(/^\/+/, '').match(/^([A-Za-z]):/);
    const filePath = driveLower
      ? '/' + driveLower[1].toLowerCase() + ':' + ws.replace(/^[A-Za-z]:/, '')
      : ws;
    const uriStr = `file://${filePath}`;
    const uri = URI.parse(uriStr);
    const stat: FileStat = {
      uri,
      lastModification: 0,
      isDirectory: true,
      name: driveLower ? driveLower[1].toLowerCase() + ':' : undefined,
    } as any;
    try {
      await this.workspaceService.setWorkspace(stat);
      console.log('[workspace] setWorkspace ok:', uriStr);
      // FileTreeService.init 在 onStart 早期已 fire-and-forget 拿到空 roots;
      // setWorkspace 更新 roots 后必须显式刷新 FileTree.
      try {
        await this.fileTreeService?.refresh?.();
      } catch (e) {
        console.warn('[workspace] fileTreeService refresh 失败:', e);
      }
    } catch (e) {
      console.error('[workspace] setWorkspace 失败:', e);
    }
  }
}

@Injectable()
export class WorkspaceModule extends BrowserModule {
  providers = [WorkspaceContribution];
  contributionProvider = [CommandContribution, ClientAppContribution];
}
