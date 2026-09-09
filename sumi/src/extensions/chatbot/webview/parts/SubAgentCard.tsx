import React, { useState } from 'react';

/**
 * 子 Agent 委派 (对齐官方 task-tool):
 *  - 无框触发行: 左 agent 色状态指示器 (运行=三点脉冲, 完成=subagent 图标, 失败=红 !)
 *  - 标题=专家名 (首字母大写), 副标题=任务描述 (单行截断), 后台任务加 (background)
 *  - 有输出且完成 → chevron 可展开 hairline 盒
 */
export const SubAgentCard: React.FC<{ part: any }> = ({ part }) => {
  const status: string = part?.state?.status || 'pending';
  const input = part?.state?.input || {};
  const meta = part?.state?.metadata || {};
  const isError = status === 'error';
  const running = status === 'pending' || status === 'running';

  const rawType: string = input.subagent_type || input.agent_name || input.name || input.subagent || input.agent || 'agent';
  const title = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Agent';

  let description: string = typeof input.description === 'string' ? input.description : (input.prompt || meta.description || '');
  if (description) description = description.replace(/\s+/g, ' ').trim();
  if (meta.background === true || input.background === true) description = description ? `${description} (background)` : '(background)';

  const output = part?.state?.output;
  const outputText = typeof output === 'string' ? output : output ? JSON.stringify(output, null, 2) : '';
  const errText = (() => { const e = part?.state?.error; if (!e) return ''; return typeof e === 'string' ? e : (e.message || JSON.stringify(e)); })();

  const [open, setOpen] = useState(false);
  const canExpand = !running && (!!outputText || isError);

  return (
    <div className={`oc-sub is-${status}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`oc-tool__trigger oc-sub__trigger${canExpand ? '' : ' is-static'}`}
        onClick={() => canExpand && setOpen(v => !v)}
      >
        <span className={`oc-sub__indicator is-${status}`}>
          {running ? (
            <span className="oc-sub__dots"><span /><span /><span /></span>
          ) : isError ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="13" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          )}
        </span>
        <span className="oc-tool__title">{title}</span>
        {description && (
          <>
            <span className="oc-tool__sep">·</span>
            <span className="oc-tool__subtitle" title={description}>{description}</span>
          </>
        )}
        {canExpand && (
          <span className={`oc-tool__chevron${open ? ' is-open' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        )}
      </button>
      {canExpand && open && (
        isError ? (
          <div className="oc-tool__error"><pre className="oc-tool__pre">{errText}</pre></div>
        ) : (
          <div className="oc-tool__box">
            <div className="oc-tool__scroll"><pre className="oc-tool__pre">{outputText.slice(0, 6000)}</pre></div>
          </div>
        )
      )}
    </div>
  );
};
