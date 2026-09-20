/**
 * files 拓展 — 文件操作实现 (上传 / 下载 / 压缩 zip)
 *
 * 全部走 codeblitz IFileServiceClient (§2.2 铁律: extensions 不直连 service/fs).
 * zip 打包在浏览器端用 fflate 完成 (大目录吃内存; 后续可换服务端流式实现).
 */
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';
import { zip } from 'fflate';

/** 取 uri 的 basename (POSIX/Windows 分隔符都吃) */
export function baseName(uri: string): string {
  const p = uri.replace(/\/+$/, '');
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

/** 父目录 uri (无父返回自身) */
export function parentUri(uri: string): string {
  const p = uri.replace(/\/+$/, '');
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i > 0 ? p.slice(0, i) : p;
}

/** 相对路径拼到目录 uri 下 (用 URI.resolve 处理编码/分隔符) */
export function childUri(dirUri: string, relPath: string): string {
  const rel = relPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!rel) return dirUri;
  return URI.parse(dirUri).resolve(rel).toString();
}

/** 二进制写文件: createFile 只收 string (会破坏二进制), 新建后用 setContent 写 bytes */
export async function writeBytes(client: IFileServiceClient, uri: string, bytes: Uint8Array): Promise<void> {
  const stat = await client.getFileStat(uri, false);
  if (stat) {
    await client.setContent(stat, bytes, {});
    return;
  }
  await client.createFile(uri, { overwrite: true });
  const created = await client.getFileStat(uri, false);
  if (!created) throw new Error(`写入失败: ${uri}`);
  await client.setContent(created, bytes, {});
}

/** 确保目录存在 (mkdir -p 语义; 已存在目录忽略) */
export async function ensureDir(client: IFileServiceClient, dirUri: string): Promise<void> {
  const stat = await client.getFileStat(dirUri, false);
  if (stat?.isDirectory) return;
  if (stat) throw new Error(`路径已存在且不是目录: ${dirUri}`);
  const parent = parentUri(dirUri);
  if (parent && parent !== dirUri) await ensureDir(client, parent);
  try {
    await client.createFolder(dirUri);
  } catch (e) {
    const st = await client.getFileStat(dirUri, false);
    if (!st?.isDirectory) throw e;
  }
}

export async function readBytes(client: IFileServiceClient, uri: string): Promise<Uint8Array> {
  const { content } = await client.readFile(uri);
  return content.buffer;
}

/** 触发浏览器下载 (blob + a[download]) */
export function saveBlob(data: Uint8Array, name: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface UploadEntry {
  /** 相对目标目录的路径 (可含子目录, 来自 webkitRelativePath / 拖拽目录) */
  relPath: string;
  bytes: Uint8Array;
}

/** 拖拽 DataTransferItem 的 FileSystemEntry 递归收集 (目录展开成多个 entry).
 *  注意: webkitGetAsEntry 必须在 drop 事件同步阶段调用 (事件结束后 DataTransferItem 失效). */
export async function readDroppedEntries(entries: any[], prefix = ''): Promise<UploadEntry[]> {
  const out: UploadEntry[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.isFile) {
      const file: File | null = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
      if (file) out.push({ relPath: `${prefix}${entry.name}`, bytes: new Uint8Array(await file.arrayBuffer()) });
      continue;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = (): Promise<any[]> =>
        new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
      // readEntries 单次上限 100 条, 循环读到空
      for (;;) {
        const batch = await readBatch();
        if (!batch.length) break;
        out.push(...(await readDroppedEntries(batch, `${prefix}${entry.name}/`)));
      }
    }
  }
  return out;
}

/** 从 drop 坐标找资源管理器里的目标目录 uri: 命中的树节点是目录→它; 是文件→其父; 空处→undefined */
export function dropTargetDirUri(x: number, y: number): string | undefined {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return undefined;
  let node: HTMLElement | null = el;
  for (let i = 0; i < 8 && node; i++) {
    const title = node.getAttribute?.('title') || '';
    if (title.startsWith('file://')) {
      // 目录节点的 treeitem 带 aria-expanded; 文件节点没有 → 文件回退到父目录
      const isDir = !!node.closest('[aria-expanded]');
      return isDir ? title : parentUri(title);
    }
    node = node.parentElement;
  }
  return undefined;
}

/** 上传: 逐个写入目标目录 (自动补建子目录) */
export async function uploadEntries(
  client: IFileServiceClient,
  targetDirUri: string,
  entries: UploadEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let done = 0;
  for (const e of entries) {
    const target = childUri(targetDirUri, e.relPath);
    const parent = parentUri(target);
    if (parent && parent !== targetDirUri.replace(/\/+$/, '')) await ensureDir(client, parent);
    await writeBytes(client, target, e.bytes);
    done += 1;
    onProgress?.(done, entries.length);
  }
}

/** 递归收集目录内容 → fflate 的 {相对路径: bytes} 表 */
async function collectDir(
  client: IFileServiceClient,
  dirUri: string,
  prefix: string,
  out: Record<string, Uint8Array>,
): Promise<void> {
  const stat = await client.getFileStat(dirUri, true);
  if (!stat?.children?.length) return;
  for (const child of stat.children) {
    const name = baseName(child.uri);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (child.isDirectory) {
      await collectDir(client, child.uri, rel, out);
    } else {
      out[rel] = await readBytes(client, child.uri);
    }
  }
}

/** 目录 (或单文件) → zip 字节 */
export async function zipResource(client: IFileServiceClient, uri: string): Promise<Uint8Array> {
  const stat = await client.getFileStat(uri, true);
  if (!stat) throw new Error(`资源不存在: ${uri}`);
  const files: Record<string, Uint8Array> = {};
  if (stat.isDirectory) {
    await collectDir(client, uri, baseName(uri), files);
  } else {
    files[baseName(uri)] = await readBytes(client, uri);
  }
  if (!Object.keys(files).length) throw new Error('目录为空, 无需压缩');
  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** zip 落盘名: 同名已存在则追加 -1/-2 ... (不覆盖用户已有文件) */
export async function uniqueZipUri(client: IFileServiceClient, parentUriStr: string, base: string): Promise<string> {
  const stem = base.replace(/\.zip$/i, '');
  let candidate = childUri(parentUriStr, `${stem}.zip`);
  for (let i = 1; i < 100; i += 1) {
    const stat = await client.getFileStat(candidate, false);
    if (!stat) return candidate;
    candidate = childUri(parentUriStr, `${stem}-${i}.zip`);
  }
  throw new Error('同名 zip 过多, 请先清理');
}
