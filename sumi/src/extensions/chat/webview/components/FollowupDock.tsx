import React, { useState } from 'react';

export interface FollowupItem {
  id: string;
  text: string;
}

export const FollowupDock: React.FC<{
  items: FollowupItem[];
  paused: boolean;
  busy: boolean;
  sendingId?: string;
  onSend: (id: string) => void;
  onCancel: (id: string) => void;
}> = ({ items, paused, busy, sendingId, onSend, onCancel }) => {
  const [open, setOpen] = useState(true);
  const total = items.length;
  if (!total) return null;
  const label = paused ? `已暂停 · ${total} 条排队` : `${total} 条排队`;
  const preview = items[0]?.text ?? '';

  return (
    <div className={`oc-followup${open ? ' is-open' : ''}`}>
      <button type="button" className="oc-followup__tray" onClick={() => setOpen(v => !v)}>
        <span className="oc-followup__count">{label}</span>
        {!open && <span className="oc-followup__preview">{preview}</span>}
        <span className="oc-followup__chevron">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4.38 6.75C4.18 6.42 4.42 6 4.81 6h4.38c.39 0 .63.42.43.75L7.43 10.51c-.19.33-.67.33-.86 0L4.38 6.75Z" fill="currentColor" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="oc-followup__items">
          {items.map((item) => (
            <div key={item.id} className={`oc-followup__item${paused ? ' is-paused' : ''}`}>
              <span className="oc-followup__item-text" title={item.text}>{item.text}</span>
              <button
                type="button"
                className="oc-followup__send"
                disabled={busy || !!sendingId}
                title={busy ? '当前回复完成后自动发送' : '立即发送该消息'}
                onClick={() => onSend(item.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
              <button
                type="button"
                className="oc-followup__x"
                disabled={!!sendingId}
                aria-label="取消排队"
                onClick={() => onCancel(item.id)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
