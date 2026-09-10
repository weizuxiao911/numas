/**
 * Files 拓展 — 上传 / 下载 / 压缩 (zip)
 *
 * 入口:
 *   - 文件树右键: 上传文件 / 上传文件夹 / 下载 / 压缩为 zip
 *   - 资源管理器标题栏: 上传按钮 (viewId = file-explorer)
 * 文件 I/O 走 codeblitz IFileServiceClient (§2.2 铁律, 不直连 service/fs);
 * zip 用 fflate 在浏览器端打包 (大目录吃内存, 后续可换服务端流式).
 */
import { Autowired, Injectable } from '@opensumi/di';
import { Domain, URI, CommandRegistry, CommandContribution, Disposable, IDisposable } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { TabBarToolbarContribution, ToolbarRegistry } from '@opensumi/ide-core-browser/lib/layout/accordion/tab-bar-toolbar';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileTreeModelService } from '@opensumi/ide-file-tree-next/lib/browser/services/file-tree-model.service';
import { RESOURCE_VIEW_ID } from '@opensumi/ide-file-tree-next/lib/common';
import { IMessageService } from '@opensumi/ide-overlay';

import { getWorkspace } from '../../infra/url';
import {
  baseName,
  dropTargetDirUri,
  parentUri,
  readBytes,
  readDroppedEntries,
  saveBlob,
  uniqueZipUri,
  uploadEntries,
  writeBytes,
  zipResource,
  type UploadEntry,
} from './ops';

export const FILES_COMMANDS = {
  upload: { id: 'files.upload', label: '上传' },
  download: { id: 'files.download', label: '下载' },
  zip: { id: 'files.zip', label: '压缩为 zip' },
} as const;

/** 打开系统文件选择器 (directory=true 时选目录) */
function pickFiles(directory: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (directory) (input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
    input.style.display = 'none';
    const done = (files: File[]) => { input.remove(); resolve(files); };
    input.onchange = () => done(Array.from(input.files || []));
    // 用户取消 (Chrome 支持 cancel 事件)
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}

@Injectable()
@Domain(CommandContribution, MenuContribution, TabBarToolbarContribution, ClientAppContribution)
export class FilesContribution
  implements CommandContribution, MenuContribution, TabBarToolbarContribution, ClientAppContribution
{
  @Autowired(IFileServiceClient)
  private readonly fileService!: IFileServiceClient;

  @Autowired(FileTreeModelService)
  private readonly fileTreeModel!: FileTreeModelService;

  @Autowired(IMessageService)
  private readonly message!: IMessageService;

  private readonly toDispose = new Disposable();

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(FILES_COMMANDS.upload, { execute: () => void this.upload() });
    commands.registerCommand(FILES_COMMANDS.download, { execute: () => void this.download() });
    commands.registerCommand(FILES_COMMANDS.zip, { execute: () => void this.zipSelected() });
  }

  /** 拖拽上传: 文件/目录拖到资源管理器 → 上传到落点目录 (空处=工作区根) */
  onStart(): void {
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      // webkitGetAsEntry 必须在同步阶段取 (事件结束后 DataTransferItem 失效)
      const entries = Array.from(e.dataTransfer.items)
        .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
        .filter(Boolean);
      // 兜底: 无 FileSystemEntry (部分环境/合成事件) 时用 files 平铺上传
      const plainFiles = entries.length ? [] : Array.from(e.dataTransfer.files || []);
      if (!entries.length && !plainFiles.length) return;
      const dirUri = dropTargetDirUri(e.clientX, e.clientY) || URI.file(getWorkspace()).toString();
      const dropEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      void (async () => {
        await this.dropUpload(dirUri, entries as any[], plainFiles);
        // 还原默认态: 树的拖拽高亮 (mod_dragover 背景色) 只在它自身 dragleave/drop 里清;
        // 我们的 drop 拦截让它收不到 → 上传完成 (树刷新重渲染稳定) 后补发 dragleave
        const clearHighlight = () => {
          try {
            const target = dropEl && dropEl.isConnected ? dropEl : (document.querySelector('[class*="file_tree___"]') as HTMLElement | null);
            target?.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
          } catch { /* ignore */ }
        };
        clearHighlight();
        setTimeout(clearHighlight, 300);
      })();
    };
    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('drop', onDrop, true);
    this.toDispose.addDispose({
      dispose: () => {
        window.removeEventListener('dragover', onDragOver, true);
        window.removeEventListener('drop', onDrop, true);
      },
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.ExplorerContext, {
      command: FILES_COMMANDS.upload.id,
      group: '9_numas',
      order: 20,
    });
    menus.registerMenuItem(MenuId.ExplorerContext, {
      command: FILES_COMMANDS.download.id,
      group: '9_numas',
      order: 22,
    });
    menus.registerMenuItem(MenuId.ExplorerContext, {
      command: FILES_COMMANDS.zip.id,
      group: '9_numas',
      order: 23,
    });
  }

  registerToolbarItems(registry: ToolbarRegistry): void {
    registry.registerItem({
      id: FILES_COMMANDS.upload.id,
      command: FILES_COMMANDS.upload.id,
      label: FILES_COMMANDS.upload.label,
      iconClass: 'codicon codicon-cloud-upload',
      viewId: RESOURCE_VIEW_ID,
      when: `view == '${RESOURCE_VIEW_ID}'`,
      order: 4,
    });
  }

  /** 当前选中的资源 (右键优先, 否则多选) */
  private selectedNodes(): Array<{ uri: URI; name: string; isDir: boolean }> {
    const nodes: Array<{ uri: URI; name: string; isDir: boolean }> = [];
    const ctx = this.fileTreeModel.contextMenuFile;
    const list = ctx ? [ctx] : this.fileTreeModel.selectedFiles;
    for (const node of list || []) {
      if (!node?.uri) continue;
      nodes.push({
        uri: node.uri,
        name: node.displayName || baseName(node.uri.toString()),
        isDir: !!node.filestat?.isDirectory,
      });
    }
    return nodes;
  }

  /** 上传目标目录: 目录→自身; 文件→父目录; 无选中→workspace 根 */
  private targetDirUri(): string {
    const [first] = this.selectedNodes();
    if (!first) return URI.file(getWorkspace()).toString();
    const uri = first.uri.toString();
    return first.isDir ? uri : parentUri(uri);
  }

  /** 上传入口: 直接唤起系统文件选择器 (多选文件); 文件夹走拖拽 (见 onStart) */
  private async upload(): Promise<void> {
    await this.doUpload(this.targetDirUri(), false);
  }

  private async doUpload(dirUri: string, directory: boolean): Promise<void> {
    const files = await pickFiles(directory);
    if (!files.length) return;
    const entries: UploadEntry[] = [];
    for (const f of files) {
      const rel = directory
        ? ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name)
        : f.name;
      entries.push({ relPath: rel, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    await this.pushEntries(dirUri, entries);
  }

  /** 拖拽目录/文件 → 递归收集后上传 */
  private async dropUpload(dirUri: string, entries: any[], plainFiles: File[] = []): Promise<void> {
    try {
      this.message.info('正在读取拖入的文件…');
      const collected = entries.length ? await readDroppedEntries(entries) : [];
      for (const f of plainFiles) {
        collected.push({ relPath: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
      }
      if (!collected.length) return;
      await this.pushEntries(dirUri, collected);
    } catch (e: unknown) {
      this.message.error(`上传失败: ${(e as Error)?.message || e}`);
    }
  }

  private async pushEntries(dirUri: string, entries: UploadEntry[]): Promise<void> {
    this.message.info(`开始上传 ${entries.length} 个文件…`);
    try {
      await uploadEntries(this.fileService, dirUri, entries);
      this.message.info(`已上传 ${entries.length} 个文件`);
    } catch (e: unknown) {
      this.message.error(`上传失败: ${(e as Error)?.message || e}`);
    }
  }

  private async download(): Promise<void> {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;
    for (const node of nodes) {
      const uri = node.uri.toString();
      try {
        if (node.isDir) {
          this.message.info(`正在打包 ${node.name} …`);
          const data = await zipResource(this.fileService, uri);
          saveBlob(data, `${node.name}.zip`, 'application/zip');
        } else {
          const data = await readBytes(this.fileService, uri);
          saveBlob(data, node.name);
        }
      } catch (e: unknown) {
        this.message.error(`下载失败: ${node.name} — ${(e as Error)?.message || e}`);
      }
    }
  }

  private async zipSelected(): Promise<void> {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;
    for (const node of nodes) {
      const uri = node.uri.toString();
      try {
        const data = await zipResource(this.fileService, uri);
        const target = await uniqueZipUri(this.fileService, parentUri(uri), `${node.name}.zip`);
        await writeBytes(this.fileService, target, data);
        this.message.info(`已生成 ${baseName(target)}`);
      } catch (e: unknown) {
        this.message.error(`压缩失败: ${node.name} — ${(e as Error)?.message || e}`);
      }
    }
  }
}

@Injectable()
export class FilesModule extends BrowserModule {
  providers = [FilesContribution];
  contributionProvider = [CommandContribution, MenuContribution, TabBarToolbarContribution];
}
