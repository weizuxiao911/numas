/**
 * annotate 拓展 — AI 生成链路
 *
 * 约定 (docs/PDF标注与AI动画代码生成功能设计与测试用例.md §1.6):
 *   ① 调用方先把 anno 写入 status=generating 并落盘校验成功
 *   ② 本模块构建 prompt → chatbot.send (全局命令, 自动发送; 缺失时降级 addContext)
 *   ③ 轮询产物文件出现 → onReady; 超时 → onTimeout
 */
import type { CommandService } from '@opensumi/ide-core-common';
import type { IFileServiceClient } from '@opensumi/ide-file-service';

import { productExists, productAbsPathFor, pathToFileUri } from './anno-file';
import type { AnnoRect } from './types';

export type GenerateKind = 'animation' | 'code';

export interface GenerateContext {
  hostPath: string;
  page: number;
  rect: AnnoRect;
  text: string;
  annoId: string;
}

const WATCH_INTERVAL_MS = 2000;
const WATCH_TIMEOUT_MS = 5 * 60 * 1000;

/** 构建 prompt (标注信息 + 能力指令 + 产物确定性路径) */
export function buildPrompt(kind: GenerateKind, ctx: GenerateContext, productAbsPath: string): string {
  const rect = [ctx.rect.x, ctx.rect.y, ctx.rect.w, ctx.rect.h].map((n) => n.toFixed(4)).join(', ');
  const head = [
    'PDF 圈选标注:',
    `- 源文件: ${ctx.hostPath}`,
    `- 页码: ${ctx.page}`,
    `- 圈选区域(页内归一化 x,y,w,h): [${rect}]`,
    ctx.text ? `- 圈选内容: ${ctx.text}` : '- 圈选内容: (未能自动提取, 请依据源文件与页码位置自行读取)',
  ].join('\n');
  const task = kind === 'animation'
    ? [
        '任务: 为该区域内容生成一个"可交互的 HTML5 动画讲解"页面.',
        '要求:',
        '1. 单文件自包含 (所有 CSS/JS 内联, 不引用任何外部资源/CDN)',
        '2. 提供数据输入框 (如逗号分隔数字/文本), 用户可输入任意数据',
        '3. 点击「开始演示」后用动画逐步演示算法/概念过程 (每一步有高亮与说明)',
        '4. 控制按钮: 开始 / 暂停 / 重置',
        '5. 界面美观 (深色/浅色自适应), 中文文案',
      ].join('\n')
    : [
        '任务: 为该区域内容生成一个可直接运行的代码示例文件.',
        '要求:',
        '1. 代码自包含, 不依赖外部服务; 使用 Python 3 标准库优先 (需要三方库时在文件头注释 pip 安装命令)',
        '2. 关键逻辑有中文注释; 运行后打印清晰结果',
        '3. 只输出代码文件内容, 不要解释',
      ].join('\n');
  return [
    head,
    '',
    task,
    '',
    `产物要求: 直接写入文件 ${productAbsPath} (不要创建其它文件, 不要输出解释文字)`,
  ].join('\n');
}

/** 发送 prompt: 优先 chatbot.send (自动发送), 不可用时降级 addContext (填入输入栏) */
export async function sendPrompt(commandService: CommandService, prompt: string): Promise<'sent' | 'queued' | 'failed'> {
  try {
    await commandService.executeCommand('chatbot.send', prompt);
    return 'sent';
  } catch {
    /* fallthrough */
  }
  try {
    await commandService.executeCommand('chatbot.addContext', {
      kind: 'selection',
      source: 'editor',
      name: 'PDF 标注生成请求',
      text: prompt,
    });
    return 'queued';
  } catch {
    return 'failed';
  }
}

/** 轮询等待产物文件出现 (2s 间隔, 5min 超时); 返回取消函数 */
export function watchProduct(
  client: IFileServiceClient,
  productAbsPath: string,
  onReady: () => void,
  onTimeout: () => void,
): () => void {
  let stopped = false;
  const startedAt = Date.now();
  const tick = async () => {
    if (stopped) return;
    try {
      if (await productExists(client, productAbsPath)) {
        if (!stopped) onReady();
        return;
      }
    } catch { /* 忽略单次失败 */ }
    if (Date.now() - startedAt >= WATCH_TIMEOUT_MS) {
      if (!stopped) onTimeout();
      return;
    }
    setTimeout(() => { void tick(); }, WATCH_INTERVAL_MS);
  };
  void tick();
  return () => { stopped = true; };
}

export { productAbsPathFor, pathToFileUri };
