import React, { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';

/**
 * 思考过程 — 可折叠区 (对齐 chat 旧版交互, 视觉沿用官方弱化风格):
 *  - 流式中默认展开 (实时看到思考), 流式结束自动折叠
 *  - 历史消息默认折叠; 点击「思考过程」行可随时展开/折叠
 *  - 正文弱化: 12.5px + muted + 左侧 hairline 竖线 (与回答正文 14px 正常前景色区分)
 */
export const ReasoningView: React.FC<{ part: any; streaming?: boolean; done?: boolean }> = ({ part, streaming }) => {
  const text = String(part?.text || '').trim();
  const [open, setOpen] = useState(!!streaming);
  const wasStreaming = useRef(!!streaming);
  useEffect(() => {
    if (streaming) {
      wasStreaming.current = true;
      setOpen(true);
      return;
    }
    // 流式结束: 自动折叠一次; 之后用户手动展开不受影响
    if (wasStreaming.current) {
      wasStreaming.current = false;
      setOpen(false);
    }
  }, [streaming]);

  if (!text) return null;

  return (
    <div className={`oc-reason${open ? ' is-open' : ''}`}>
      <button type="button" className="oc-reason__trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="oc-reason__icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" /></svg>
        </span>
        <span>思考过程</span>
        <span className={`oc-reason__caret${open ? ' is-open' : ''}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <div className="oc-reason__body">
          <Markdown content={text} streaming={streaming} expand={streaming} />
        </div>
      )}
    </div>
  );
};
