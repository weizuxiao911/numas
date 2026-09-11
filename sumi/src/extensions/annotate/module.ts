/**
 * annotate 拓展 — 主 Contribution
 *
 * 生命周期:
 *   激活编辑器是 PDF → 找到 PDF webview iframe → 挂蒙层 + 读 anno + 渲染
 *   切走 / 关闭 → 卸载蒙层
 *
 * 跨拓展契约 (AGENTS §2.2): 与 chat 只走全局命令 chatbot.send / chatbot.addContext,
 * 不 import chat 实现; fs 只走 codeblitz IFileServiceClient.
 */
import { Injectable, Autowired } from '@opensumi/di';
import { Domain, Disposable, IDisposable, CommandService, URI } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common';

import { getHostAnchors } from '../../infra/host';
import { absToRel, normalizeCwdPath, pathBase, toHostPath } from '../../infra/path';
import { appBaseUrl, getEffectiveCwd } from '../../infra/url';
import { readAnno, writeAnno, nextAnnoId, productAbsPathFor, productAbsPathFromName } from './anno-file';
import { AnnotateOverlay } from './overlay';
import { buildPrompt, sendPrompt, watchProduct, type GenerateKind } from './ai';
import { runInTerminal } from './terminal';
import { findPdfTarget, observeTarget } from './pdf-target';
import type { AnnoFile, AnnoRect, Annotation, PdfTarget } from './types';
import { DEFAULT_ANNO_COLOR } from './types';

const TARGET_RETRY_TIMES = 20;
const TARGET_RETRY_INTERVAL_MS = 300;

@Injectable()
@Domain(ClientAppContribution)
export class AnnotateContribution implements ClientAppContribution {
  @Autowired(IFileServiceClient)
  private readonly fileService!: IFileServiceClient;

  @Autowired(CommandService)
  private readonly commandService!: CommandService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService!: WorkbenchEditorService;

  @Autowired(ITerminalController)
  private readonly terminals!: ITerminalController;

  @Autowired(IMessageService)
  private readonly messageService!: IMessageService;

  private readonly overlay = new AnnotateOverlay({
    // ① 生成标注: 释放即完成标注 (sync 返回 id); popover 里设置交互行为
    onCreateRegion: (page, rect, color) => this.createRegion(page, rect, color),
    onGenerate: (id, action) => { void this.generate(id, action); },
    onRecolor: (id, color) => { void this.recolor(id, color); },
    // ② 标注交互: 已有标注的回放/执行
    onPlayAnimation: (id) => { void this.playAnimation(id); },
    onRunCode: (id) => { void this.runCode(id); },
    onDelete: (id) => { void this.deleteAnnotation(id); },
  });

  private hostPath = '';
  private anno: AnnoFile | null = null;
  private target: PdfTarget | null = null;
  private disposers: IDisposable[] = [];
  private unobserve: (() => void) | null = null;
  private unwatch: (() => void) | null = null;
  private syncToken = 0;

  onStart(): void {
    void this.sync();
    this.disposers.push(this.editorService.onActiveResourceChange(() => { void this.sync(); }));
    this.disposers.push(this.editorService.onDidCurrentEditorGroupChanged(() => { void this.sync(); }));
    this.disposers.push({
      dispose: () => this.teardown(),
    } as IDisposable);
  }

  /** 当前编辑器 URI → 宿主机路径 */
  private currentHostPath(): string {
    const uri = this.editorService.currentResource?.uri;
    if (!uri) return '';
    const raw = String((uri as any).codeUri?.fsPath || uri.path?.toString?.() || '');
    if (!raw) return '';
    const host = toHostPath(raw, getHostAnchors());
    return normalizeCwdPath(host || raw);
  }

  private async sync(): Promise<void> {
    const token = ++this.syncToken;
    const hostPath = this.currentHostPath();
    // 非 PDF: 卸载
    if (!hostPath || !/\.pdf$/i.test(hostPath)) {
      this.teardown();
      return;
    }
    // 同一个 PDF 且已挂载: 不动 (避免重复读盘)
    if (hostPath === this.hostPath && this.target) return;
    this.teardown();
    const target = await this.waitForTarget(hostPath, token);
    if (!target || token !== this.syncToken) return;
    this.hostPath = hostPath;
    this.target = target;
    this.overlay.mount(target);
    this.unobserve = observeTarget(target, () => this.overlay.renderThrottled());
    try {
      this.anno = await readAnno(this.fileService, hostPath);
    } catch {
      this.anno = { version: 1, file: pathBase(hostPath), annotations: [] };
    }
    if (token !== this.syncToken) return;
    this.overlay.render(this.anno.annotations);
    // 布局稳定前多渲染几次 (aside/目录栏开合会让 iframe 位置变化)
    [120, 400, 1000].forEach((ms) => setTimeout(() => {
      if (token === this.syncToken) this.overlay.render();
    }, ms));
  }

  /** PDF webview 是异步挂载的: 重试等待 iframe 出现 */
  private async waitForTarget(hostPath: string, token: number): Promise<PdfTarget | null> {
    for (let i = 0; i < TARGET_RETRY_TIMES; i++) {
      if (token !== this.syncToken) return null;
      const found = findPdfTarget(hostPath);
      if (found) return found;
      await new Promise((r) => setTimeout(r, TARGET_RETRY_INTERVAL_MS));
    }
    return null;
  }

  private teardown(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.unobserve?.();
    this.unobserve = null;
    this.overlay.unmount();
    this.target = null;
    this.anno = null;
    this.hostPath = '';
  }

  /* ─────────── 标注 CRUD ─────────── */

  /**
   * ① 生成标注: 圈定释放即完成标注 (同步返回 id, 不阻塞手势)
   *   文本提取异步补写; popover 只负责设置交互行为 (生成/改色)
   */
  private createRegion(page: number, rect: AnnoRect, color: string): string | null {
    const anno = this.anno;
    const hostPath = this.hostPath;
    if (!anno || !hostPath) return null;
    const item: Annotation = {
      id: nextAnnoId(anno),
      page,
      rect,
      color: color || DEFAULT_ANNO_COLOR,
      text: '',
      createdAt: Date.now(),
    };
    anno.annotations.push(item);
    this.overlay.render(anno.annotations);
    void this.persist(anno);
    // 异步补文本 (失败/为空不影响标注已完成)
    void this.extractText(page, rect).then((text) => {
      if (!text) return;
      const cur = this.anno?.annotations.find((a) => a.id === item.id);
      if (cur && !cur.text) {
        cur.text = text;
        if (this.anno) void this.persist(this.anno);
        this.overlay.render();
      }
    });
    return item.id;
  }

  /** 生成标注: popover 改色 */
  private async recolor(id: string, color: string): Promise<void> {
    const anno = this.anno;
    if (!anno) return;
    const item = anno.annotations.find((a) => a.id === id);
    if (!item || item.color === color) return;
    item.color = color;
    await this.persist(anno);
    this.overlay.render(anno.annotations);
  }

  /** ② 标注交互: 打开已生成的动画 HTML */
  private async playAnimation(id: string): Promise<void> {
    const anno = this.anno;
    const hostPath = this.hostPath;
    if (!anno || !hostPath) return;
    const item = anno.annotations.find((a) => a.id === id);
    const cap = item?.animation;
    if (!cap || cap.status !== 'ready' || !cap.file) {
      this.messageService.warning('该标注还没有可播放的动画');
      return;
    }
    try {
      const abs = productAbsPathFromName(hostPath, cap.file);
      await this.editorService.open(URI.parse(pathToFileUri(abs)));
    } catch (e: any) {
      this.messageService.error(`打开动画失败: ${e?.message || e}`);
    }
  }

  private async deleteAnnotation(id: string): Promise<void> {
    const anno = this.anno;
    if (!anno) return;
    anno.annotations = anno.annotations.filter((a) => a.id !== id);
    await this.persist(anno);
    this.overlay.render(anno.annotations);
  }

  /* ─────────── AI 生成 ─────────── */

  private async generate(id: string, kind: GenerateKind): Promise<void> {
    const anno = this.anno;
    const hostPath = this.hostPath;
    if (!anno || !hostPath) return;
    const item = anno.annotations.find((a) => a.id === id);
    if (!item) return;
    if (kind === 'animation' && item.animation?.status === 'generating') return;
    if (kind === 'code' && item.code?.status === 'generating') return;

    const ext = kind === 'animation' ? 'html' : 'py';
    const absPath = await productAbsPathFor(hostPath, item.id, ext);
    const fileName = absPath.replace(/\\/g, '/').split('/').pop() || absPath;

    // ① 先落盘 generating (保证 anno 一定正确, 再发 AI)
    const cap = { status: 'generating' as const, file: fileName };
    if (kind === 'animation') item.animation = cap; else item.code = cap;
    try {
      await this.persist(anno);
    } catch (e: any) {
      if (kind === 'animation') delete item.animation; else delete item.code;
      this.messageService.error(`标注文件写入失败, 已取消生成: ${e?.message || e}`);
      return;
    }
    this.overlay.render(anno.annotations);

    // ② 发 prompt (自动发送)
    const prompt = buildPrompt(kind, { hostPath, page: item.page, rect: item.rect, text: item.text, annoId: item.id }, absPath);
    const result = await sendPrompt(this.commandService, prompt);
    if (result === 'failed') {
      this.messageService.error('对话面板不可用, 无法发送生成请求');
      return;
    }
    if (result === 'queued') {
      this.messageService.info('已把生成请求填入对话输入栏, 请点发送');
    }

    // ③ 监听产物出现 → ready
    this.unwatch?.();
    this.unwatch = watchProduct(
      this.fileService,
      absPath,
      () => { void this.markReady(item.id, kind, fileName, absPath); },
      () => { void this.markFailed(item.id, kind, '生成超时 (5 分钟未出现产物)'); },
    );
  }

  private async markReady(id: string, kind: GenerateKind, fileName: string, absPath: string): Promise<void> {
    const anno = this.anno;
    if (!anno) return;
    const item = anno.annotations.find((a) => a.id === id);
    if (!item) return;
    if (kind === 'animation') {
      item.animation = { status: 'ready', file: fileName };
    } else {
      const rel = fileName;
      item.code = { status: 'ready', file: fileName, command: commandForProduct(absPath, rel) };
    }
    await this.persist(anno);
    this.overlay.render(anno.annotations);
    this.messageService.info(kind === 'animation' ? '动画演示已生成' : '代码已生成, 可点击「运行代码」');
  }

  private async markFailed(id: string, kind: GenerateKind, error: string): Promise<void> {
    const anno = this.anno;
    if (!anno) return;
    const item = anno.annotations.find((a) => a.id === id);
    if (!item) return;
    if (kind === 'animation') {
      item.animation = { status: 'failed', error };
    } else {
      item.code = { status: 'failed', error };
    }
    await this.persist(anno);
    this.overlay.render(anno.annotations);
    this.messageService.error(`生成失败: ${error}`);
  }

  /* ─────────── 运行代码 ─────────── */

  private async runCode(id: string): Promise<void> {
    const anno = this.anno;
    if (!anno) return;
    const item = anno.annotations.find((a) => a.id === id);
    const command = item?.code?.command;
    if (!command) {
      this.messageService.warning('该标注还没有可运行的代码, 请先生成');
      return;
    }
    const ok = await runInTerminal(this.terminals, command);
    if (!ok) this.messageService.error('终端不可用, 无法执行');
  }

  private async persist(anno: AnnoFile): Promise<void> {
    await writeAnno(this.fileService, this.hostPath, anno);
  }

  /** PDF 文档缓存 (按 hostPath; 提取圈选文本用, 懒加载) */
  private pdfDocCache: { hostPath: string; promise: Promise<any> } | null = null;

  private loadPdfDoc(): Promise<any> | null {
    const target = this.target;
    if (!target || !this.hostPath) return null;
    if (this.pdfDocCache?.hostPath === this.hostPath) return this.pdfDocCache.promise;
    const win = target.doc.defaultView as any;
    const pdfjsLib = win?.pdfjsLib;
    if (!pdfjsLib) return null;
    const promise = (async () => {
      // 同源 fs API 读字节 (V2 workspace selector 走 ?directory=; fileService 对绝对 file:// 不可靠)
      const ws = getEffectiveCwd();
      const rel = ws ? absToRel(this.hostPath, ws) : null;
      if (!rel) throw new Error('annotate: PDF 不在当前工作区, 无法读取');
      const base = appBaseUrl().replace(/\/+$/, '');
      const url = `${base}/api/fs/read/${encodeURIComponent(rel)}?directory=${encodeURIComponent(ws)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`annotate: 读取 PDF 失败 HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return pdfjsLib.getDocument({ data: bytes }).promise;
    })();
    this.pdfDocCache = { hostPath: this.hostPath, promise };
    return promise;
  }

  /** 圈选区域文本提取 (pdf.js textContent + 归一化 rect 相交; 失败返回空串) */
  private async extractText(page: number, rect: AnnoRect): Promise<string> {
    try {
      const docPromise = this.loadPdfDoc();
      if (!docPromise) return '';
      const doc = await docPromise;
      const pdfPage = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const textContent = await pdfPage.getTextContent();
      const parts: string[] = [];
      for (const item of (textContent.items || []) as any[]) {
        const str = String(item?.str || '');
        const tr = item?.transform;
        if (!str.trim() || !tr) continue;
        const nx = Number(tr[4]) / viewport.width;
        const ny = 1 - Number(tr[5]) / viewport.height;
        if (
          nx >= rect.x - 0.02 && nx <= rect.x + rect.w + 0.02
          && ny >= rect.y - 0.02 && ny <= rect.y + rect.h + 0.02
        ) {
          parts.push(str);
        }
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[annotate] 文本提取失败 (不影响标注):', e?.message || e);
      return '';
    }
  }
}

/** 产物路径 → 运行命令 (按扩展名选解释器; 命令在产物同目录执行) */
function commandForProduct(absPath: string, rel: string): string {
  const lower = rel.toLowerCase();
  const dir = absPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  const file = absPath.replace(/\\/g, '/').split('/').pop() || rel;
  const cd = dir ? `cd '${dir}' && ` : '';
  if (lower.endsWith('.py')) return `${cd}python3 '${file}'`;
  if (lower.endsWith('.js')) return `${cd}node '${file}'`;
  if (lower.endsWith('.sh')) return `${cd}bash '${file}'`;
  return `${cd}'${file}'`;
}

@Injectable()
export class AnnotateModule extends BrowserModule {
  providers = [AnnotateContribution];
  contributionProvider = [ClientAppContribution];
}

export { Disposable };
