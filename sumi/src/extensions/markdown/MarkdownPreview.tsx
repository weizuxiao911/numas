/**
 * MarkdownPreview — .md 文件预览 (复刻 Trae/VS Code markdown 预览体验)
 *
 * 打开方式: explorer 右键「打开预览」/ 编辑器标题栏预览按钮 / 命令 markdown.showPreview
 * 载体: codeblitz 编辑器组件 (虚拟 scheme: numas-md-preview://<encodeURIComponent(绝对路径)>)
 * 渲染: render.ts (marked + shiki + katex + mermaid); 文件变更自动刷新.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';

import { renderMarkdown, renderMermaidBlocks } from './render';
import { styles } from './styles';

export const MD_PREVIEW_SCHEME = 'numas-md-preview';

/** 虚拟 URI → 原文件绝对路径 (path 段, 不走 authority: host 会被小写化) */
export function previewPathFromUri(uri: any): string {
  try {
    const p = uri?.path?.toString?.();
    if (typeof p === 'string' && p) return decodeURIComponent(p);
    const s = String(uri?.toString?.() || uri || '');
    const idx = s.indexOf(`${MD_PREVIEW_SCHEME}://`);
    if (idx < 0) return '';
    return decodeURIComponent(s.slice(idx + MD_PREVIEW_SCHEME.length + 3));
  } catch {
    return '';
  }
}

/** 原文件绝对路径 → 预览虚拟 URI (path 段保存真实大小写) */
export function previewUriFor(absPath: string): URI {
  return URI.from({ scheme: MD_PREVIEW_SCHEME, path: absPath.replace(/\\/g, '/') });
}

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return /dark/i.test(document.documentElement.className);
}

function bufferToText(content: any): string {
  try {
    const inner = content?.buffer ?? content;
    if (inner instanceof ArrayBuffer) return new TextDecoder().decode(inner);
    if (inner?.buffer instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(inner.buffer, inner.byteOffset || 0, inner.byteLength));
    }
    if (typeof content === 'string') return content;
    return new TextDecoder().decode(content);
  } catch {
    return String(content ?? '');
  }
}

export const MarkdownPreview: React.FC<{ resource?: any }> = ({ resource }) => {
  const fileService = useInjectable<IFileServiceClient>(IFileServiceClient);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const absPath = previewPathFromUri(resource?.uri);

  const load = React.useCallback(async () => {
    if (!absPath) {
      setError('无法解析文件路径');
      return;
    }
    try {
      const { content } = await fileService.readFile(URI.file(absPath).toString());
      const out = await renderMarkdown(bufferToText(content));
      setHtml(out);
      setError('');
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, [absPath, fileService]);

  useEffect(() => {
    void load();
  }, [absPath, load]);

  // 文件变更 → 自动刷新 (对齐 Trae 预览体验)
  useEffect(() => {
    if (!absPath) return;
    const target = URI.file(absPath).toString();
    const sub = fileService.onFilesChanged((e: any) => {
      const list = Array.isArray(e) ? e : [e];
      if (list.some((x) => x?.uri === target)) void load();
    });
    return () => sub?.dispose?.();
  }, [absPath, fileService, load]);

  // html 更新后渲染 mermaid (动态 import)
  useEffect(() => {
    const el = bodyRef.current;
    if (el && html) void renderMermaidBlocks(el, isDarkTheme());
  }, [html]);

  return (
    <div className="md-preview">
      <style>{styles}</style>
      {error ? (
        <div className="md-preview__error">渲染失败: {error}</div>
      ) : (
        <div className="md-preview__body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
};
