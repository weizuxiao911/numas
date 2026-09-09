import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMessageService } from '@opensumi/ide-overlay';
import { PartRenderer } from '../parts/PartRenderer';
import { getQuestionStore, extractText, formatDuration, type Row } from '../helpers';

export const MessageRow: React.FC<{
  row: Row;
  streaming: boolean;
  done?: boolean;
  sessionID: string;
  onReplyQuestion: (sid: string, rid: string, answers: string[][]) => Promise<void>;
  /** question 卡片「取消」: abort 当前会话对话 */
  onAbortSession?: (sid: string) => void;
  busy?: boolean;
}> = ({ row, streaming, done, sessionID, onReplyQuestion, onAbortSession, busy }) => {
  const messageService = useInjectable<IMessageService>(IMessageService);
  const notifyCopied = React.useCallback(() => {
    try { messageService?.info('已复制'); } catch { /* 容器外无 DI 时静默 */ }
  }, [messageService]);

  if (row.role === 'user') {
    const text = extractText(row.parts);
    const copy = () => { navigator.clipboard?.writeText(text); notifyCopied(); };
    const fileParts = (row.parts || []).filter((p: any) => p?.type === 'file');
    return (
      <div className="chat__msg is-user">
        <div className="chat__msg-user-col">
          <div className="chat__msg-bubble is-user">
            {text && <div className="chat__msg-user-text">{text}</div>}
            {fileParts.map((p: any, i: number) => {
              const mime = String(p.mime || '');
              const url = String(p.url || '');
              if (!url) return null;
              return mime.startsWith('image/')
                ? <img key={i} className="chat__part-file chat__part-file--image" src={url} alt={p.filename || 'image'} />
                : <div key={i} className="chat__part-file">
                    <a href={url} target="_blank" rel="noreferrer" download={p.filename}>
                      <span className="chat__part-file-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </span>
                      <span className="chat__part-file-name">{p.filename || url}</span>
                    </a>
                  </div>;
            })}
          </div>
          <div className="chat__msg-meta is-user">
            <button className="chat__msg-copy" onClick={copy} title="复制">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepFinish = row.parts?.find((p: any) => p?.type === 'step-finish');
  const modelID = stepFinish?.modelID
    || row.parts?.find((p: any) => p?.type === 'text' && p?.modelID)?.modelID
    || row.modelID
    || '';
  // 耗时: 优先 step-finish time, 回退到消息 info.time (created→completed)
  const start = stepFinish?.time?.start ?? row.time?.created;
  const end = stepFinish?.time?.end ?? row.time?.completed;
  const duration = formatDuration(start, end);
  const tokens = stepFinish?.tokens?.total;
  const cost = stepFinish?.cost;
  const textParts = row.parts?.filter((p: any) => p?.type === 'text') || [];
  const fullText = textParts.map((p: any) => p.text).join('\n');
  const copy = () => { navigator.clipboard?.writeText(fullText); notifyCopied(); };

  // 中断在模型产出任何内容前: 后端留下 parts 为空 (或仅有无内容的 step-start/step-finish) 的
  // assistant 消息, finish=None. 非流式中时显式给一个「已停止生成」占位, 避免渲染成空白气泡.
  const hasContent = (row.parts || []).some((p: any) =>
    (p?.type === 'text' && String(p.text || '').trim()) ||
    (p?.type === 'reasoning' && String(p.text || '').trim()) ||
    p?.type === 'tool' || p?.type === 'file'
  );
  const showAborted = !streaming && !hasContent;
  // 流式中但尚未产出任何内容 → 首 token 等待期, 显示骨架屏 shimmer
  const showWaiting = streaming && !hasContent;

  return (
    <div className="chat__msg is-assistant">
      <div className="chat__msg-body">
        {showAborted && (
          <div className="chat__msg-aborted">已停止生成</div>
        )}
        {showWaiting && (
          <div className="chat__msg-waiting" aria-label="正在生成回复">
            <div className="chat__msg-waiting-bar" />
            <div className="chat__msg-waiting-bar" />
            <div className="chat__msg-waiting-bar" />
          </div>
        )}
        {(row.parts || []).map((part: any, i: number) => {
          const questionMeta = part?.type === 'tool' && part?.tool === 'question'
            ? getQuestionStore().get(sessionID) : null;
          return (
            <PartRenderer
              key={part.id || i}
              part={part}
              streaming={streaming}
              done={done}
              sessionID={sessionID}
              onReply={onReplyQuestion}
              onAbortSession={onAbortSession}
              preferredQuestionRequestID={questionMeta?.requestID}
              busy={busy}
            />
          );
        })}
        {/* 底部操作/信息 (复制 · 模型 · 耗时 · tokens · 费用): 仅在对话一轮终止
            (非流式且已有内容) 后显示; 生成中不显示. */}
        {!streaming && hasContent && (
        <div className="chat__msg-meta is-assistant">
            <button className="chat__msg-copy" onClick={copy} title="复制">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          {modelID && <span className="chat__msg-model">{modelID}</span>}
          {duration && <>
            <span className="chat__msg-sep">·</span>
            <span className="chat__msg-duration">{duration}</span>
          </>}
          {typeof tokens === 'number' && tokens > 0 && <>
            <span className="chat__msg-sep">·</span>
            <span className="chat__msg-duration">{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tokens</span>
          </>}
          {typeof cost === 'number' && cost > 0 && <>
            <span className="chat__msg-sep">·</span>
            <span className="chat__msg-duration">${cost.toFixed(4)}</span>
          </>}
        </div>
        )}
      </div>
    </div>
  );
};