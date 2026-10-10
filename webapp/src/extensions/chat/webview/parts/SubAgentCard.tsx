import React, { useEffect, useRef, useState } from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { CommandService } from '@opensumi/ide-core-common';
import { onEvent } from '@/service/event/eventBus';
import { aiListMessages } from '@/extensions/chat/commands/api';
import { MessageRow } from '../components/MessageRow';

/**
 * 子 Agent 委派 (对齐官方 task-tool):
 *  - 无框触发行: 状态表现与 shell 工具卡 (ToolView) 完全一致 —
 *    运行中 = .oc-tool__spinner + is-pending (标题 shimmer); 完成 = .oc-tool__indicator 图标;
 *    出错 = 图标 + 标题变红 (oc-sub.is-error .oc-tool__title)
 *  - 标题=专家名 (首字母大写), 副标题=任务描述 (单行截断), 后台任务加 (background)
 *  - 内联消息区: 直接复用主消息组件 (MessageRow/PartRenderer) 渲染子会话消息流,
 *    与主会话同款格式 (markdown/代码窗/工具卡/diff); 数据 = 挂载回补 (aiListMessages) + 实时事件
 *  - 交互: 点标题行进子会话 (只读); 右侧 chevron 单独折叠/展开内联区
 *  - 默认态: 运行中展开实时跟随, 完成后自动折叠
 *  - 子代理会话的 pending question/permission 由主会话 dock 提升展示 (session-request-tree)
 */

interface ChildRow {
  id: string;
  role: string;
  parts: any[];
}

/** 内联区只读: question 交互由主会话 dock 承载, 这里 no-op */
const noopReply = async (): Promise<void> => {};

export const SubAgentCard: React.FC<{ part: any; streaming?: boolean }> = ({ part, streaming }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const status: string = part?.state?.status || 'pending';
  const input = part?.state?.input || {};
  const meta = part?.state?.metadata || {};
  const isError = status === 'error';
  const running = status === 'pending' || status === 'running';
  /** 中断残留: 同 ToolView — 只有当前流式行里的 running 才真在跑 */
  const interrupted = running && !streaming;
  const active = running && !interrupted;

  const rawType: string = input.subagent_type || input.agent_name || input.name || input.subagent || input.agent || 'agent';
  const title = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Agent';

  let description: string = typeof input.description === 'string' ? input.description : (input.prompt || meta.description || '');
  if (description) description = description.replace(/\s+/g, ' ').trim();
  if (meta.background === true || input.background === true) description = description ? `${description} (background)` : '(background)';

  const output = part?.state?.output;
  const outputText = typeof output === 'string' ? output : output ? JSON.stringify(output, null, 2) : '';
  const errText = (() => { const e = part?.state?.error; if (!e) return ''; return typeof e === 'string' ? e : (e.message || JSON.stringify(e)); })();

  const subSessionId: string = part?.state?.metadata?.sessionId || '';
  const canExpand = !running && (!!outputText || isError);
  const showToggle = !!subSessionId || canExpand;

  // 默认态: 运行中展开; 完成后 (或中断残留) 自动折叠一次; 用户点 chevron 可随时切换
  const [open, setOpen] = useState(active);
  const wasRunning = useRef(active);
  useEffect(() => {
    if (active) {
      wasRunning.current = true;
      setOpen(true);
      return;
    }
    if (wasRunning.current) {
      wasRunning.current = false;
      setOpen(false);
    }
  }, [active]);

  // 子会话消息流: 挂载回补 (进入子会话再返回后不丢) + 实时事件跟随
  const [rows, setRows] = useState<ChildRow[]>([]);
  useEffect(() => {
    if (!subSessionId) return;
    let cancelled = false;
    void aiListMessages(subSessionId)
      .then((msgs) => {
        if (cancelled) return;
        const seeded: ChildRow[] = (msgs || []).map((m: any) => {
          const info = m.info || m;
          return { id: info?.id || m.id, role: info?.role || m.role, parts: m.parts || info?.parts || [] };
        });
        setRows((prev) => {
          const byId = new Map<string, ChildRow>();
          for (const r of seeded) byId.set(r.id, r);
          for (const r of prev) byId.set(r.id, r); // 实时行覆盖回补行
          return Array.from(byId.values());
        });
      })
      .catch(() => { /* 命令未就绪时忽略 */ });
    return () => { cancelled = true; };
  }, [subSessionId]);

  useEffect(() => {
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
      <div className="oc-sub__head">
        <button
          type="button"
          className={`oc-tool__trigger oc-sub__trigger${subSessionId ? ' is-clickable' : ' is-static'}${active ? ' is-pending' : ''}`}
          onClick={subSessionId ? openSession : undefined}
          title={subSessionId ? '点击进入子代理会话 (只读)' : undefined}
        >
          {active ? (
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
        </button>
        {showToggle && (
          <button
            type="button"
            className={`oc-sub__toggle${open ? ' is-open' : ''}`}
            title={open ? '折叠执行过程' : '展开执行过程'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        )}
      </div>

      {/* 内联消息区: 复用主消息组件渲染子会话消息流 (只读) */}
      {subSessionId && open && rows.length > 0 && (
        <div className="oc-sub__stream">
          {rows.map((r, i) => (
            <MessageRow
              key={r.id}
              row={r as any}
              streaming={active && i === rows.length - 1}
              done={!active}
              sessionID={subSessionId}
              onReplyQuestion={noopReply}
              busy={active}
            />
          ))}
        </div>
      )}

      {/* 无子会话时的输出盒 (兜底) */}
      {!subSessionId && canExpand && open && (
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
