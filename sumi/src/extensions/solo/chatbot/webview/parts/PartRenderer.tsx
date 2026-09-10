import React from 'react';
import { Markdown } from './Markdown';
import { ReasoningView } from './Reasoning';
import { TodoCard } from './TodoCard';
import { extractQuestions } from './QuestionCard';
import { SubAgentCard } from './SubAgentCard';
import { ToolView } from './ToolView';

/** 已回答提问: 官方折叠摘要行 (Questions · N answered), 展开看问答 */
const AnsweredQuestion: React.FC<{ part: any }> = ({ part }) => {
  const questions = extractQuestions(part);
  const answers = part?.state?.metadata?.answers;
  const [open, setOpen] = React.useState(false);
  if (!questions) return null;
  return (
    <div className={`oc-tool${open ? ' is-open' : ''}`}>
      <button type="button" className="oc-tool__trigger" onClick={() => setOpen(v => !v)}>
        <span className="oc-tool__title">Questions</span>
        <span className="oc-tool__sep">·</span>
        <span className="oc-tool__subtitle">{questions.length} answered</span>
        <span className={`oc-tool__chevron${open ? ' is-open' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <div className="oc-qanswers">
          {questions.map((q, i) => {
            const a = Array.isArray(answers) ? answers[i] : undefined;
            const text = Array.isArray(a) ? a.map((x: string) => String(x).replace(/^__custom__:/, '')).join(', ') : a ? String(a) : '未回答';
            return (
              <div key={i} className="oc-qanswers__item">
                <div className="oc-qanswers__q">{q.question}</div>
                <div className="oc-qanswers__a">{text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export type ToolKind = 'question' | 'subagent' | 'todowrite' | 'default';

export function getToolKind(tool: string): ToolKind {
  if (!tool) return 'default';
  const n = tool.toLowerCase();
  if (n === 'question' || n.includes('question')) return 'question';
  if (n === 'todowrite' || n === 'todo_write') return 'todowrite';
  if (n === 'task' || n === 'subagent' || n === 'subagent_task' || n.includes('subagent')) return 'subagent';
  return 'default';
}

export const PartRenderer: React.FC<{
  part: any;
  streaming?: boolean;
  /** 对话是否已结束 (busy=false): 结束后卡片自动折叠 */
  done?: boolean;
  sessionID: string;
  onReply: (sid: string, rid: string, answers: string[][]) => Promise<void>;
  onAbortSession?: (sid: string) => void;
  preferredQuestionRequestID?: string;
  preferredQuestionQuestions?: any[];
  /** 对话是否正忙: 仅 busy 时显示提交按钮等交互 */
  busy?: boolean;
}> = ({ part, streaming, done, sessionID, onReply, onAbortSession, preferredQuestionRequestID, preferredQuestionQuestions, busy }) => {
  if (!part || part.synthetic || part.ignored) return null;

  switch (part.type) {
    case 'text': {
      const text = String(part.text || '');
      if (!text) return null;
      return <Markdown content={text} streaming={streaming} expand={streaming} />;
    }
    case 'reasoning':
      return <ReasoningView part={part} streaming={streaming} done={done} />;
    case 'file': {
      const mime = String(part.mime || '');
      const url = String(part.url || '');
      if (!url) return null;
      if (mime.startsWith('image/')) {
        return <img className="oc-att__img" src={url} alt={part.filename || 'image'} />;
      }
      return (
        <a className="oc-att__file" href={url} target="_blank" rel="noreferrer" download={part.filename}>
          <span className="oc-att__file-ic">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          </span>
          <span className="oc-att__file-name">{part.filename || url}</span>
        </a>
      );
    }
    case 'tool': {
      const kind = getToolKind(String(part.tool || ''));
      switch (kind) {
        case 'question': {
          const status: string = part?.state?.status || 'pending';
          const answered = status === 'completed' || !!part?.state?.metadata?.answers;
          // 官方: 忽略 (question.reject) → tool state.error 含 "dismissed this question"
          // → timeline 弱灰右对齐行「问题已忽略」, 不是已停止/空.
          const errRaw: any = part?.state?.error;
          const errStr = typeof errRaw === 'string' ? errRaw : (errRaw?.message || '');
          if (status === 'error' && errStr.toLowerCase().includes('dismissed this question')) {
            return <div className="oc-msg__qignored"><span>问题已忽略</span></div>;
          }
          // 未回答提问由输入框上方 QuestionDock 承载, 消息流不渲染
          if (!answered) return null;
          return <AnsweredQuestion part={part} />;
        }
        case 'todowrite':
          return <TodoCard part={part} done={done} />;
        case 'subagent':
          return <SubAgentCard part={part} />;
        default:
          return <ToolView part={part} done={done} />;
      }
    }
    case 'step-start':
    case 'step-finish':
    case 'snapshot':
    case 'patch':
    case 'agent':
    case 'retry':
    case 'compaction':
      return null;
    default:
      return null;
  }
};
