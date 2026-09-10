/**
 * Chat 面板对外 API — extensions/chat/commands/chatApi
 *
 * chat 激活后由 Chat 组件把「面板自身交互能力」注册到此处, 供 commands 桥接,
 * 供其他拓展 / vsix 通过 executeCommand('chat.xxx') 调用.
 *
 * 不挂 window 全局对象: 走 opensumi 容器 (CommandContribution) 注册命令,
 * 跨拓展/动态拓展通过 VSCode 标准的 executeCommand 使用.
 */

import { pathBase } from '../../../../infra/path';

export type ChatContextItem =
  | {
      kind: 'file';
      path: string;
      name: string;
    }
  | {
      kind: 'selection';
      source: 'editor' | 'terminal';
      path?: string;
      name: string;
      startLine?: number;
      endLine?: number;
      text: string;
    };

export interface AddContextResult {
  added: boolean;
  reason?: 'empty' | 'duplicate';
}

export interface ChatPanelApi {
  /** 新建会话 */
  newSession(): void | Promise<void>;
  /** 显示历史会话弹窗 */
  sessions(): void;
  /** 发送指令 */
  send(text: string): void | Promise<void>;
  /** 切换会话 */
  changeSession(sid: string): void;
  /** 进入子代理会话 (只读查看执行过程) */
  enterSubSession?(sid: string): void;
  /** 从子代理会话返回父会话 */
  leaveSubSession?(): void;
  /** 当前会话 id */
  getCurrentSessionID(): string;
  /** 当前 cwd 的顶层会话列表 (排除 subagent) */
  listSessions(): Promise<any[]>;
  /** 删除会话 */
  deleteSession(sid: string): void | Promise<void>;
  /** 切换当前项目 (workspace 根或根下子目录): 有该项目会话则载入最新, 无则新建草稿 */
  setProject?(dir: string): void | Promise<void>;
  /** 当前项目路径 (= 当前会话 directory, 无会话时 workspace 根) */
  getProject?(): string;
  /** 把上下文挂到当前对话输入栏 (不发送) */
  addContext(item: ChatContextItem): AddContextResult;
}

let registered: ChatPanelApi | null = null;
const pending: ChatContextItem[] = [];

/** 由 Chat 组件在挂载时注册 (一次), 卸载时可传 null 注销 */
export function registerChatPanelApi(api: ChatPanelApi | null): void {
  registered = api;
  if (!api?.addContext || !pending.length) return;
  const flush = pending.splice(0);
  flush.forEach((item) => api.addContext(item));
}

export function getChatPanelApi(): ChatPanelApi | null {
  return registered;
}

/** 跨拓展入口: Chat 未挂载时先入队, 挂载后 flush. */
export function addToConversation(item: ChatContextItem): AddContextResult {
  if (registered?.addContext) return registered.addContext(item);
  pending.push(item);
  return { added: true };
}

export function contextItemKey(item: ChatContextItem): string {
  if (item.kind === 'file') return `file:${item.path}`;
  const loc = item.path
    ? `${item.path}:${item.startLine ?? ''}-${item.endLine ?? ''}`
    : item.name;
  return `sel:${item.source}:${loc}:${item.text}`;
}

export function formatContextNote(items: ChatContextItem[]): string {
  if (!items.length) return '';
  const parts: string[] = [];
  const files = items.filter((i): i is Extract<ChatContextItem, { kind: 'file' }> => i.kind === 'file');
  if (files.length) {
    parts.push('[已添加文件]\n' + files.map((f) => `- ${f.path}`).join('\n'));
  }
  for (const s of items) {
    if (s.kind !== 'selection') continue;
    const from = s.source === 'editor' ? '编辑器' : '终端';
    let loc = s.name;
    if (s.path) {
      loc = s.path;
      if (typeof s.startLine === 'number') {
        loc += `:${s.startLine}`;
        if (typeof s.endLine === 'number' && s.endLine !== s.startLine) loc += `-${s.endLine}`;
      }
    }
    parts.push(`[来自 ${from} ${loc}]\n\`\`\`\n${s.text}\n\`\`\``);
  }
  return parts.length ? '\n\n' + parts.join('\n\n') : '';
}

/** 用户气泡里展示的上下文芯片 (由发送给模型的笔记反解析) */
export interface UserDisplayChip {
  kind: 'file' | 'selection';
  name: string;
  title?: string;
  range?: string;
  source?: 'editor' | 'terminal';
}

/** 发给模型的笔记以 `\n\n[已添加文件]` / `[已上传文件]` / `[来自 …]` 开头 */
const NOTE_START = /\n\n\[(?:已添加文件|已上传文件|来自 )/;

/**
 * 把用户消息正文拆成「可见文字 + 芯片」.
 * 模型仍收到完整笔记; 气泡只渲染芯片和用户自己打的字.
 */
export function parseUserMessageDisplay(text: string): { body: string; chips: UserDisplayChip[] } {
  if (!text) return { body: '', chips: [] };
  const splitAt = text.search(NOTE_START);
  const rawBody = splitAt >= 0 ? text.slice(0, splitAt) : text;
  const body = rawBody.replace(/^\n+/, '').replace(/\n+$/, '');
  const rest = splitAt >= 0 ? text.slice(splitAt + 2) : '';
  if (!rest) return { body, chips: [] };

  const chips: UserDisplayChip[] = [];
  const fileBlock = /\[(已添加文件|已上传文件)\]\n((?:- .+(?:\n|$))*)/g;
  let fm: RegExpExecArray | null;
  while ((fm = fileBlock.exec(rest))) {
    const lines = fm[2].split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean);
    for (const p of lines) {
      chips.push({ kind: 'file', name: pathBase(p) || p, title: p });
    }
  }

  const selBlock = /\[来自 (编辑器|终端) ([^\]]*)\]\n```[\s\S]*?```/g;
  let sm: RegExpExecArray | null;
  while ((sm = selBlock.exec(rest))) {
    const source = sm[1] === '终端' ? 'terminal' as const : 'editor' as const;
    const loc = sm[2].trim();
    const lineMatch = loc.match(/:(\d+)(?:-(\d+))?$/);
    const pathOrName = lineMatch ? loc.slice(0, -lineMatch[0].length) : loc;
    const start = lineMatch?.[1];
    const end = lineMatch?.[2];
    const range = start
      ? (end && end !== start ? `${start}-${end}` : start)
      : undefined;
    chips.push({
      kind: 'selection',
      source,
      name: pathBase(pathOrName) || pathOrName,
      title: loc,
      range,
    });
  }

  return { body, chips: [] };
}

export type ComposerSnapshot = {
  body: string;
  contextItems: ChatContextItem[];
  attachments: Array<{ name: string; path: string; dataUrl?: string }>;
};

/** 从历史用户消息还原输入框正文 + 芯片 (已添加文件 / 选区 / 已上传附件) */
export function parseComposerFromUserMessage(text: string, parts?: any[]): ComposerSnapshot {
  const { body } = parseUserMessageDisplay(text);
  const contextItems: ChatContextItem[] = [];
  const attachments: ComposerSnapshot['attachments'] = [];
  const splitAt = text.search(NOTE_START);
  const rest = splitAt >= 0 ? text.slice(splitAt + 2) : '';

  const added = /\[已添加文件\]\n((?:- .+(?:\n|$))*)/g;
  let am: RegExpExecArray | null;
  while ((am = added.exec(rest))) {
    const lines = am[1].split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean);
    for (const p of lines) {
      contextItems.push({ kind: 'file', path: p, name: pathBase(p) || p });
    }
  }

  const uploaded = /\[已上传文件\]\n((?:- .+(?:\n|$))*)/g;
  let um: RegExpExecArray | null;
  while ((um = uploaded.exec(rest))) {
    const lines = um[1].split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean);
    for (const p of lines) {
      attachments.push({ name: pathBase(p) || p, path: p });
    }
  }

  const selBlock = /\[来自 (编辑器|终端) ([^\]]*)\]\n```[^\n]*\n([\s\S]*?)```/g;
  let sm: RegExpExecArray | null;
  while ((sm = selBlock.exec(rest))) {
    const source = sm[1] === '终端' ? 'terminal' as const : 'editor' as const;
    const loc = sm[2].trim();
    const lineMatch = loc.match(/:(\d+)(?:-(\d+))?$/);
    const pathOrName = lineMatch ? loc.slice(0, -lineMatch[0].length) : loc;
    const startLine = lineMatch ? Number(lineMatch[1]) : undefined;
    const endLine = lineMatch?.[2] ? Number(lineMatch[2]) : startLine;
    contextItems.push({
      kind: 'selection',
      source,
      path: pathOrName || undefined,
      name: pathBase(pathOrName) || pathOrName,
      startLine,
      endLine,
      text: sm[3].replace(/\n$/, ''),
    });
  }

  for (const p of parts || []) {
    if (p?.type !== 'file' || !p.url) continue;
    const path = String(p.filename || p.url);
    const name = pathBase(path) || path;
    const dataUrl = String(p.url);
    const hit = attachments.find((a) => a.path === path || a.name === name);
    if (hit) {
      if (!hit.dataUrl) hit.dataUrl = dataUrl;
    } else {
      attachments.push({ name, path, dataUrl });
    }
  }

  return { body, contextItems, attachments };
}
