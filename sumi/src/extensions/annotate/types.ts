/**
 * annotate 拓展 — 类型定义
 *
 * 标注数据 (anno 文件) 的 schema. 详见
 * docs/PDF标注与AI动画代码生成功能设计与测试用例.md §1.4.
 */

/** 页内归一化坐标 [0,1] (x/y 左上角, w/h 宽高) */
export interface AnnoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CapabilityStatus = 'generating' | 'ready' | 'failed';

/** AI 能力产物记录 (动画演示 / 代码) */
export interface AnnoCapability {
  status: CapabilityStatus;
  /** 产物文件名 (与 anno 同目录, 相对路径) */
  file?: string;
  /** 运行命令 (code 能力) */
  command?: string;
  /** 失败原因 (status=failed) */
  error?: string;
}

export interface Annotation {
  /** 唯一 id (a1/a2... 递增), 产物文件靠它关联 */
  id: string;
  /** 页码 (1 起) */
  page: number;
  /** 页内归一化 rect */
  rect: AnnoRect;
  /** 蒙层色 (rgba 带透明度) */
  color: string;
  /** 圈选提取文本 (AI 上下文) */
  text: string;
  createdAt: number;
  /** 动画演示能力 (无 = 未生成过) */
  animation?: AnnoCapability;
  /** 代码能力 (无 = 未生成过) */
  code?: AnnoCapability;
}

export interface AnnoFile {
  version: 1;
  /** 源文件名 (冗余, 校验 anno 与源文件对应) */
  file: string;
  annotations: Annotation[];
}

/** 当前激活的 PDF 目标 (适配器解析结果) */
export interface PdfTarget {
  /** PDF webview 的 iframe 元素 */
  iframe: HTMLIFrameElement;
  /** iframe 内的 document */
  doc: Document;
  /** 滚动容器 .ab-pdf__viewerContainer */
  viewer: HTMLElement;
  /** 源 PDF 宿主机绝对路径 */
  hostPath: string;
}

/** 蒙层默认色板 */
export const ANNO_PALETTE: Array<{ label: string; value: string }> = [
  { label: '黄', value: 'rgba(250, 204, 21, 0.28)' },
  { label: '蓝', value: 'rgba(96, 165, 250, 0.25)' },
  { label: '绿', value: 'rgba(52, 211, 153, 0.25)' },
  { label: '粉', value: 'rgba(244, 114, 182, 0.25)' },
  { label: '紫', value: 'rgba(167, 139, 250, 0.25)' },
];

export const DEFAULT_ANNO_COLOR = ANNO_PALETTE[0].value;
