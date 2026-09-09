import React from 'react';
import { Markdown } from './Markdown';

/**
 * 思考过程 — 100% 官方 (session-ui message-part ReasoningPart):
 * 无折叠按钮, 直接以弱化色 (muted) markdown 平铺在消息流中:
 *   [data-component="reasoning-part"]: 13px / muted / line-height normal
 *   markdown margin-top 16px (非首个 part)
 * 流式中也即时平铺 (官方 PacedMarkdown streaming 同款).
 */
export const ReasoningView: React.FC<{ part: any; streaming?: boolean; done?: boolean }> = ({ part, streaming }) => {
  const text = String(part?.text || '').trim();
  if (!text) return null;
  return (
    <div className="oc-reason-part">
      <Markdown content={text} streaming={streaming} expand={streaming} />
    </div>
  );
};
