import React, { useState, useEffect } from 'react';
import { type QuestionInfo } from '../parts/QuestionCard';

/** 官方 cache 同款: 按 requestID 暂存 tab/answers/custom, 重挂载恢复; 提交/忽略后删除 */
const qdCache = new Map<string, { tab: number; answers: string[][]; custom: string[]; customOn: boolean[] }>();

/**
 * QuestionDock — 未回答提问在输入框上方的 dock (对齐官方 session-question-dock).
 * 官方语义: footer「忽略」/ Esc = question.reject (AI 继续干活, 不 abort 会话);
 * 提交 = question.reply。tab/答案/自定义输入按 requestID 缓存, 重挂载可恢复 (官方同款)。
 */
export const QuestionDock: React.FC<{
  questions: QuestionInfo[];
  requestID: string;
  submitting?: boolean;
  onSubmit: (requestID: string, answers: string[][]) => Promise<void> | void;
  onCancel: () => void;
}> = ({ questions, requestID, submitting, onSubmit, onCancel }) => {
  const [tab, setTab] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(() => qdCache.get(requestID)?.answers ?? []);
  const [custom, setCustom] = useState<string[]>(() => qdCache.get(requestID)?.custom ?? []);
  const [customOn, setCustomOn] = useState<boolean[]>(() => qdCache.get(requestID)?.customOn ?? []);
  const [editing, setEditing] = useState(false);
  const doneRef = React.useRef(false);

  const total = questions.length;
  const qi = Math.min(tab, total - 1);
  const q = questions[qi];
  const multi = !!q?.multiple;
  const last = qi >= total - 1;
  const options = q?.options ?? [];

  // requestID 变化时: 恢复该 request 的缓存 (官方 cache 语义)
  useEffect(() => {
    const cached = qdCache.get(requestID);
    setTab(cached?.tab ?? 0);
    setAnswers(cached?.answers ?? []);
    setCustom(cached?.custom ?? []);
    setCustomOn(cached?.customOn ?? []);
    doneRef.current = false;
  }, [requestID]);
  // 卸载且未提交 → 写回缓存 (重挂/切 tab 后恢复)
  useEffect(() => () => {
    if (doneRef.current) { qdCache.delete(requestID); return; }
    qdCache.set(requestID, { tab, answers: answers.map(a => [...a]), custom: [...custom], customOn: [...customOn] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestID]);
  if (!q) return null;

  const curAnswers = () => answers[qi] ?? [];
  const curInput = () => custom[qi] ?? '';
  const isOn = () => customOn[qi] === true;
  const answered = (i: number) => (answers[i]?.length ?? 0) > 0 || (customOn[i] === true && (custom[i] ?? '').trim().length > 0);
  const canNext = answered(qi);

  const pick = (label: string) => { setAnswers(p => { const n = [...p]; n[qi] = [label]; return n; }); setCustomOn(p => { const n = [...p]; n[qi] = false; return n; }); setEditing(false); };
  const toggleOpt = (label: string) => setAnswers(p => {
    const n = [...p]; const cur = n[qi] ? [...n[qi]!] : [];
    const i = cur.indexOf(label); i >= 0 ? cur.splice(i, 1) : cur.push(label); n[qi] = cur; return n;
  });
  const customUpdate = (v: string, selected = isOn()) => {
    setCustom(p => { const n = [...p]; n[qi] = v; return n; });
    if (!selected) return;
    const next = v.trim();
    setAnswers(p => {
      const n = [...p];
      if (multi) {
        const cur = (n[qi] ? [...n[qi]!] : []).filter(x => x.trim() !== curInput().trim());
        if (next && !cur.includes(next)) cur.push(next);
        n[qi] = cur;
      } else { n[qi] = next ? [next] : []; }
      return n;
    });
  };
  const openCustom = () => { setCustomOn(p => { const n = [...p]; n[qi] = true; return n; }); setEditing(true); customUpdate(curInput(), true); };
  const selectOption = (i: number) => {
    if (i === options.length) { openCustom(); return; }
    const opt = options[i]; if (!opt) return;
    if (multi) { setEditing(false); toggleOpt(opt.label); } else pick(opt.label);
  };
  const commitCustom = () => { setEditing(false); customUpdate(curInput()); };

  const submitAll = async () => {
    if (submitting) return;
    qdCache.delete(requestID);
    doneRef.current = true;
    const out = questions.map((_, i) => {
      const sel = [...(answers[i] ?? [])];
      return sel;
    });
    await onSubmit(requestID, out);
  };
  /** 官方「忽略」/ Esc 语义: question.reject, dock 移除由外部处理 */
  const skipAll = () => {
    qdCache.delete(requestID);
    doneRef.current = true;
    onCancel();
  };
  const next = () => {
    if (editing) commitCustom();
    if (last) { void submitAll(); return; }
    setTab(tab + 1); setEditing(false);
  };
  const back = () => { if (qi <= 0) return; setTab(qi - 1); setEditing(false); };

  const Mark = ({ picked }: { picked: boolean }) => (
    <span className="oc-qd-check">
      <span className="oc-qd-box" data-type={multi ? 'checkbox' : 'radio'} data-picked={picked || undefined}>
        {multi ? (picked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>) : (picked && <span className="oc-qd-dot" />)}
      </span>
    </span>
  );

  return (
    <div className="oc-qd" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); skipAll(); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); next(); } }}>
      <div className="oc-qd__shell">
      <div className="oc-qd__header">
        <div className="oc-qd__title">{qi + 1}/{total} 个问题</div>
        <div className="oc-qd__header-actions">
          {total > 1 && (
            <div className="oc-qd__progress">
              {questions.map((_, i) => (
                <button key={i} type="button" className="oc-qd__seg" data-active={i === qi || undefined} data-answered={answered(i) || undefined} onClick={() => setTab(i)} aria-label={`问题 ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="oc-qd__body">
        <div className="oc-qd__text">{q.question}</div>
        <div className="oc-qd__hint">{multi ? '可多选, 提交前可切换' : '选择一个答案'}</div>
        <div className="oc-qd__options">
            {options.map((opt, i) => {
              const picked = curAnswers().includes(opt.label);
              return (
                <button key={i} type="button" className="oc-qd__option" data-picked={picked || undefined} disabled={submitting} onClick={() => selectOption(i)}>
                  <Mark picked={picked} />
                  <span className="oc-qd__option-main">
                    <span className="oc-qd__label">{opt.label}</span>
                    {opt.description && <span className="oc-qd__desc">{opt.description}</span>}
                  </span>
                </button>
              );
            })}
            {q.custom !== false && (
              editing ? (
                <form className="oc-qd__option oc-qd__custom" data-picked={isOn() || undefined} onSubmit={(e) => { e.preventDefault(); commitCustom(); }}>
                  <Mark picked={isOn()} />
                  <span className="oc-qd__option-main">
                    <span className="oc-qd__label">输入自己的答案</span>
                    <textarea
                      className="oc-qd__custom-input"
                      placeholder="输入你的答案…"
                      rows={1}
                      value={curInput()}
                      autoFocus
                      disabled={submitting}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitCustom(); } }}
                      onInput={(e) => { const el = e.currentTarget; el.style.height = '0'; el.style.height = el.scrollHeight + 'px'; customUpdate(el.value); }}
                    />
                  </span>
                </form>
              ) : (
                <button type="button" className="oc-qd__option oc-qd__custom" data-picked={isOn() || undefined} disabled={submitting} onClick={openCustom}>
                  <Mark picked={isOn()} />
                  <span className="oc-qd__option-main">
                    <span className="oc-qd__label">输入自己的答案</span>
                    <span className="oc-qd__desc">{curInput() || '输入你的答案…'}</span>
                  </span>
                </button>
              )
            )}
          </div>
      </div>
      </div>

      <div className="oc-qd__tray">
          <button type="button" className="oc-qd__btn oc-qd__btn--ghost" disabled={submitting} onClick={skipAll}>忽略</button>
          <div className="oc-qd__footer-actions">
            {qi > 0 && <button type="button" className="oc-qd__btn oc-qd__btn--secondary" disabled={submitting} onClick={back}>上一步</button>}
            <button type="button" className={`oc-qd__btn ${last ? 'oc-qd__btn--primary' : 'oc-qd__btn--secondary'}`} disabled={submitting || !canNext} onClick={next}>
              {last ? '提交' : '下一个'}
            </button>
          </div>
        </div>
    </div>
  );
};
