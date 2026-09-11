import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMessageService } from '@opensumi/ide-overlay';
import { PartRenderer } from '../parts/PartRenderer';
import { getQuestionStore, extractText, formatDuration, formatTokens, formatCost, type Row } from '../helpers';

/**
 * MessageRow — 按官方 (session-ui message-part) 直接重写:
 *   user:     user-message-copy-wrapper = [meta(flex 右) 撤销 复制] 整行 hover 浮现
 *   assistant: text-part-copy-wrapper = [复制回复 "Agent · 模型 · 耗时"] 整行 hover 浮现
 *   meta 文案 join(" · ") / 用户 tail = HH:MM; 复制后按钮变 check 2s (官方同款)
 */
const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const UndoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
);

function FileAttachment({ p }: { p: any }) {
  const mime = String(p.mime || '');
  const url = String(p.url || '');
  if (!url) return null;
  if (mime.startsWith('image/')) {
    return <img className="oc-att__img" src={url} alt={p.filename || 'image'} />;
  }
  return (
    <a className="oc-att__file" href={url} target="_blank" rel="noreferrer" download={p.filename}>
      <span className="oc-att__file-ic">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
      </span>
      <span className="oc-att__file-name">{p.filename || url}</span>
    </a>
  );
}

/** 复制文本: clipboard API 失败 (iframe/权限) 时回退 execCommand, 返回是否成功 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 官方 clipboard 写 + 2s 后复位 check 图标; 复制失败不谎报"已复制" */
function useCopyNotifier() {
  const messageService = useInjectable<IMessageService>(IMessageService);
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = React.useCallback((text: string) => {
    void copyTextToClipboard(text).then((ok) => {
      if (!ok) {
        try { messageService?.warning('复制失败: 剪贴板不可用'); } catch { /* 容器外无 DI */ }
        return;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      try { messageService?.info('已复制'); } catch { /* 容器外无 DI */ }
    });
  }, [messageService]);
  return { copied, notify };
}

function fmtClock(ts?: number): string {
  if (typeof ts !== 'number') return '';
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function cap(s: string): string {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
}

/** 路径 basename (跨平台分隔符) */
function fileBasename(p: string): string {
  const parts = String(p || '').split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

const MessageRowInner: React.FC<{
  row: Row;
  streaming: boolean;
  done?: boolean;
  sessionID: string;
  onReplyQuestion: (sid: string, rid: string, answers: string[][]) => Promise<void>;
  onAbortSession?: (sid: string) => void;
  onRevert?: (mid: string) => void;
  turnAgent?: string;
  turnModel?: string;
  busy?: boolean;
  resolveModelName?: (modelID: string, providerID?: string) => string;
}> = ({
  row, streaming, done, sessionID, onReplyQuestion, onAbortSession,
  onRevert, turnAgent, turnModel, busy, resolveModelName,
}) => {
  const { copied, notify } = useCopyNotifier();
  const fileParts = (row.parts || []).filter((p: any) => p?.type === 'file');

  if (row.role === 'user') {
    const rawText = extractText(row.parts);
    // 发送时文本尾部拼了 [已上传文件] 清单 → 解析成附件卡片渲染, 气泡只显示正文
    const attachPaths: string[] = (() => {
      const m = rawText.match(/\[已上传文件\]\n((?:- .*(?:\n|$))*)/);
      if (!m) return [];
      return m[1].split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
    })();
    const text = rawText.replace(/\n*\[已上传文件\]\n(?:- .*(?:\n|$))*/g, '').trimEnd();
    // 官方用户 meta: "Agent · 模型 · HH:MM" (tail 时间), 整行 hover 浮现
    const modelLabel = (resolveModelName && turnModel ? resolveModelName(turnModel) : '') || turnModel || '';
    const metaItems = [cap(turnAgent || ''), modelLabel, fmtClock(row.time?.created)].filter(Boolean);
    return (
      <div className="oc-msg is-user">
        <div className="oc-msg__user-col">
          {(fileParts.length > 0 || attachPaths.length > 0) && (
            <div className="oc-att oc-att--row oc-att--user">
              {fileParts.map((p: any, i: number) => <FileAttachment key={i} p={p} />)}
              {attachPaths.map((p, i) => (
                <span key={`f${i}`} className="oc-att__file" title={p}>
                  <span className="oc-att__file-ic">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </span>
                  <span className="oc-att__file-name">{fileBasename(p)}</span>
                </span>
              ))}
            </div>
          )}
          {text && <div className="oc-msg__user-bubble" dir="auto">{text}</div>}
          <div className="oc-msg__user-foot">
            {metaItems.length > 0 && (
              <span className="oc-msg__user-meta">{metaItems.join(' · ')}</span>
            )}
            {!busy && onRevert && (
              <button type="button" className="oc-icon-btn" title="撤销此消息" aria-label="撤销此消息" onClick={() => onRevert(row.id)}>
                <UndoIcon />
              </button>
            )}
            <button
              type="button"
              className="oc-icon-btn"
              title={copied ? '已复制' : '复制消息'}
              aria-label={copied ? '已复制' : '复制消息'}
              onClick={() => notify(text)}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
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
  const start = stepFinish?.time?.start ?? row.time?.created;
  const end = stepFinish?.time?.end ?? row.time?.completed;
  const duration = formatDuration(start, end);
  const textParts = row.parts?.filter((p: any) => p?.type === 'text') || [];
  const fullText = textParts.map((p: any) => p.text).join('\n');
  const hasTool = (row.parts || []).some((p: any) => p?.type === 'tool');
  const hasContent = (row.parts || []).some((p: any) =>
    (p?.type === 'text' && String(p.text || '').trim()) ||
    (p?.type === 'reasoning' && String(p.text || '').trim()) ||
    p?.type === 'tool' || p?.type === 'file'
  );
  // 提问/工具等待轮不显示"已停止"; 空行且非 busy → 中断态
  const showAborted = !streaming && !hasContent && !hasTool && !busy;
  const showWaiting = !hasContent && (streaming || busy);
  const agentLabel = cap(row.mode || row.agent || '');
  const modelName = (resolveModelName ? resolveModelName(modelID, row.providerID) : '') || modelID;
  const tokenLabel = formatTokens(row.tokens);
  const costLabel = formatCost(row.cost);
  const metaText = [agentLabel, modelName, duration, tokenLabel, costLabel].filter(Boolean).join(' · ');

  return (
    <div className="oc-msg is-assistant">
      <div className="oc-msg__body">
        {showAborted && <div className="oc-msg__aborted">已停止生成</div>}
        {showWaiting && (
          <div className="oc-msg__waiting" aria-label="思考中">
            <span className="oc-msg__waiting-text">思考中</span>
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
        {!streaming && hasContent && (
          <div className="oc-msg__meta">
            <div className="oc-msg__meta-inner">
              <button
                type="button"
                className="oc-icon-btn"
                title={copied ? '已复制' : '复制回复'}
                aria-label={copied ? '已复制' : '复制回复'}
                onClick={() => notify(fullText)}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              {metaText && <span className="oc-msg__meta-item">{metaText}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** memo: 流式 token 更新只重建变化行 (rows 其余元素引用稳定 → 跳过重渲染), 消除全列表卡顿 */
export const MessageRow = React.memo(MessageRowInner);
