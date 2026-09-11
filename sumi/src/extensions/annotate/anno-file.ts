/**
 * annotate 拓展 — anno 文件 I/O (`.{文件名hash}.anno` 隐藏 JSON)
 *
 * 全部走 codeblitz IFileServiceClient (§2.2 铁律: extensions 不直连 service/fs).
 * 文件与源 PDF 同层级; 产物文件同目录 (`.{hash}.anno.{id}.{ext}`).
 */
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';

import type { AnnoFile } from './types';

/** 源文件路径 → 同层级 anno 文件 URI (隐藏: `.` + hash8 + `.anno`) */
export async function annoUriFor(hostPath: string): Promise<string> {
  const dir = parentPath(hostPath);
  const base = baseName(hostPath);
  const hash = await hash8(base);
  return pathToFileUri(`${dir}/.${hash}.anno`);
}

/** 产物文件绝对路径 (与 anno 同目录, `.{hash}.anno.{id}.{ext}`) */
export async function productAbsPathFor(hostPath: string, annoId: string, ext: string): Promise<string> {
  const dir = parentPath(hostPath);
  const hash = await hash8(baseName(hostPath));
  return `${dir}/.${hash}.anno.${annoId}.${ext}`;
}

/** 宿主机路径 → file:// URI (POSIX/Windows drive 都吃; 走 encodeURI 兼容中文) */
export function pathToFileUri(hostPath: string): string {
  const p = hostPath.replace(/\\/g, '/');
  const withRoot = p.startsWith('/') || /^[a-zA-Z]:\//.test(p) ? p : `/${p}`;
  return `file://${withRoot.split('/').map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg))).join('/')}`;
}

/** URI → 宿主机路径 (与 infra/path 的语义一致, 这里只做解码) */
export function fileUriToPath(uri: string): string {
  return decodeURIComponent(String(uri).replace(/^file:\/\//, ''));
}

function baseName(p: string): string {
  const s = p.replace(/\/+$/, '');
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i >= 0 ? s.slice(i + 1) : s;
}

function parentPath(p: string): string {
  const s = p.replace(/\/+$/, '');
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i > 0 ? s.slice(0, i) : s;
}

/** 文件名 → 8 位 hash (SHA-256 前 8 hex; crypto.subtle 不可用时退化为简单 hash) */
async function hash8(name: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(name);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

/** 读 anno (不存在/损坏 → 空结构, 不抛) */
export async function readAnno(client: IFileServiceClient, hostPath: string): Promise<AnnoFile> {
  const empty: AnnoFile = { version: 1, file: baseName(hostPath), annotations: [] };
  try {
    const uri = await annoUriFor(hostPath);
    const stat = await client.getFileStat(uri, false);
    if (!stat) return empty;
    const { content } = await client.readFile(uri);
    const text = new TextDecoder('utf-8').decode(content.buffer as Uint8Array);
    const parsed = JSON.parse(text) as AnnoFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.annotations)) return empty;
    // 兜底: 过滤掉结构不完整的条目
    parsed.annotations = parsed.annotations.filter(
      (a) => a && typeof a.id === 'string' && typeof a.page === 'number' && a.rect && typeof a.text === 'string',
    );
    parsed.file = parsed.file || baseName(hostPath);
    return parsed;
  } catch {
    return empty;
  }
}

/** 写 anno (createFile/setContent 两段式, 见 files/ops/ops.ts 同款模式) */
export async function writeAnno(client: IFileServiceClient, hostPath: string, anno: AnnoFile): Promise<void> {
  const uri = await annoUriFor(hostPath);
  const bytes = new TextEncoder().encode(`${JSON.stringify(anno, null, 2)}\n`);
  const stat = await client.getFileStat(uri, false);
  if (stat) {
    await client.setContent(stat, bytes, {});
    return;
  }
  await client.createFile(uri, { overwrite: true });
  const created = await client.getFileStat(uri, false);
  if (!created) throw new Error(`anno 写入失败: ${uri}`);
  await client.setContent(created, bytes, {});
}

/** 下一个标注 id (a1/a2... 取现有最大值 +1) */
export function nextAnnoId(anno: AnnoFile): string {
  let max = 0;
  for (const a of anno.annotations) {
    const m = /^a(\d+)$/.exec(a.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `a${max + 1}`;
}

/** 产物文件名 → 绝对路径 (与源文件同目录) */
export function productAbsPathFromName(hostPath: string, relName: string): string {
  return `${parentPath(hostPath)}/${relName}`;
}

/** 产物是否已存在 (产物监听用; 收产物绝对路径) */
export async function productExists(client: IFileServiceClient, absPath: string): Promise<boolean> {
  const stat = await client.getFileStat(pathToFileUri(absPath), false);
  return !!stat && !stat.isDirectory;
}

/** 确保路径存在性检查用的 URI 工具导出 (module 侧使用) */
export { URI };
