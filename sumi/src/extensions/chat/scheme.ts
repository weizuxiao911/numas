/**
 * chat 全局配置读取 — extensions/chat/scheme.ts
 *
 * 建议文案单一来源: config/brand.ts (直接 import, 编译期可静态追踪).
 * 不依赖 window.__APP_CONFIG__.chatConfig 中间层, 避免绕路.
 * 注: 品牌信息 (brand) 已不再被 chat 读取 (空会话改为打字机问候).
 */

import { APP_CHAT_CONFIG } from '@/config/brand';

export interface ChatSuggestion {
  icon: string;
  title: string;
  desc: string;
  prompt: string;
}

export function getSuggestions(): ChatSuggestion[] {
  return APP_CHAT_CONFIG.suggestions as unknown as ChatSuggestion[];
}
