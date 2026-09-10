import React, { useState } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { onEvent } from '@/service/event/eventBus';

/**
 * 子 Agent 委派 (对齐官方 task-tool):
 *  - 无框触发行: 状态表现与 shell 工具卡 (ToolView) 完全一致 —
 *    运行中 = .oc-tool__spinner + is-pending (标题 shimmer); 完成 = .oc-tool__indicator 图标;
 *    出错 = 图标 + 标题变红 (oc-sub.is-error .oc-tool__title)
 *  - 标题=专家名 (首字母大写), 副标题=任务描述 (单行截断), 后台任务加 (background)
 *  - 有输出且完成 → chevron 可展开 hairline 盒
 *  - 子代理会话的 pending question/permission 由主会话 dock 提升展示 (session-request-tree),
 *    本卡片只投影执行过程, 不承载作答交互
 */

export const SubAgentCard: React.FC<{ part: any; streaming?: boolean }> = ({ part, streaming }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const status: string = part?.state?.status || 'pending';
  const input = part?.state?.input || {};
  const meta = part?.state?.metadata || {};
  const isError = status === 'error';
  const running = status === 'pending' || status === 'running';
  /** 中断残留: 同 ToolView — 只有当前流式行里的 running 才真在跑 */
  const interrupted = running && !streaming;

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
  // 主消息下方投影子代理会话的对话消息流 (实时跟随)
  const [rows, setRows] = React.useState<Array<{ id: string; role: string; parts: any[] }>>([]);
  const subSessionId: string = part?.state?.metadata?.sessionId || '';
  React.useEffect(() => {
    if (!subSessionId) return;
    return onEvent((ev) => {
      const sid = ev.properties?.sessionID;
      if (!sid || sid !== subSessionId) return;
      if (ev.type === 'message.part.updated') {
        const partEv = ev.properties?.part;
        if (!partEv?.messageID) return;
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === partEv.messageID);
          if (idx < 0) return [...prev, { id: partEv.messageID, role: 'assistant', parts: [partEv] }];
          const next = [...prev];
          const row = { ...next[idx], parts: [...next[idx].parts] };
          const pi = row.parts.findIndex((p: any) => p?.id === partEv.id);
          if (pi >= 0) row.parts[pi] = partEv; else row.parts.push(partEv);
          next[idx] = row;
          return next;
        });
      } else if (ev.type === 'message.updated') {
        const info = ev.properties?.info;
        if (!info?.id || !info.role) return;
        if (info.parts?.length) {
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === info.id);
            if (idx < 0) return [...prev, { id: info.id, role: info.role, parts: info.parts }];
            const next = [...prev];
            next[idx] = { ...next[idx], role: info.role, parts: info.parts };
            return next;
          });
        }
      } else if (ev.type === 'message.removed') {
        const mid = ev.properties?.messageID;
        if (mid) setRows((prev) => prev.filter((r) => r.id !== mid));
      }
    });
  }, [subSessionId]);

  const openSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!subSessionId) return;
    void commandService.executeCommand('chatbot.enterSubSession', subSessionId);
  };

  return (
    <div className={`oc-sub is-${status}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`oc-tool__trigger oc-sub__trigger${subSessionId ? ' is-clickable' : canExpand ? '' : ' is-static'}${running && !interrupted ? ' is-pending' : ''}`}
        onClick={subSessionId ? openSession : (canExpand ? () => setOpen(v => !v) : undefined)}
        title={subSessionId ? '点击查看子代理会话执行过程' : undefined}
      >
        {running && !interrupted ? (
          <span className="oc-tool__spinner" />
        ) : (
          <span className="oc-tool__indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          </span>
        )}
        <span className="oc-tool__title">{title}</span>
        {description && (
          <>
            <span className="oc-tool__sep">·</span>
            <span className="oc-tool__subtitle" title={description}>{description}</span>
          </>
        )}
        {interrupted && <span className="oc-sub__interrupted">已中断</span>}

        {(canExpand || (running && !interrupted)) && (
          <span className={`oc-tool__chevron${open ? ' is-open' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        )}
      </button>
      {subSessionId && rows.length > 0 && (
        <div className="oc-sub__proj">
          {rows.map((r) => {
            const isUser = r.role === 'user';
            const text = (r.parts || []).filter((p: any) => p?.type === 'text').map((p: any) => String(p.text || '')).join('\n').trim();
            return (
              <div key={r.id} className={`oc-sub__proj-row is-${isUser ? 'user' : 'asst'}`}>
                {isUser ? (
                  <div className="oc-sub__proj-user">{text || '(…)'}</div>
                ) : (
                  <div className="oc-sub__proj-asst">
                    {(r.parts || []).map((p: any, i: number) => {
                      if (p?.type === 'reasoning' && String(p.text || '').trim()) {
                        return <div key={i} className="oc-sub__proj-reason">🤔 {String(p.text).replace(/\s+/g, ' ').trim().slice(0, 140)}</div>;
                      }
                      if (p?.type === 'tool') {
                        return <div key={i} className="oc-sub__proj-tool">⚙ {p.tool || 'tool'} · {p.state?.status || ''}</div>;
                      }
                      if (p?.type === 'text' && String(p.text || '').trim()) {
                        return <div key={i} className="oc-sub__proj-text">{String(p.text).replace(/\s+/g, ' ').trim()}</div>;
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
