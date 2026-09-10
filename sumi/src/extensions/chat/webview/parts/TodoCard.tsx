import React, { useMemo } from 'react';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: string;
}

export function extractAssistantTodos(value: any): TodoItem[] {
  if (!value) return [];
  let arr: any = null;
  if (Array.isArray(value)) arr = value;
  else if (Array.isArray(value?.todos)) arr = value.todos;
  else if (Array.isArray(value?.data)) arr = value.data;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const items: TodoItem[] = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const content = (e as any).content;
    const status = (e as any).status;
    const priority = (e as any).priority;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    const normalizedStatus: TodoItem['status'] =
      status === 'completed' || status === 'in_progress' || status === 'pending' || status === 'cancelled'
        ? status
        : 'pending';
    items.push({
      content: content.trim(),
      status: normalizedStatus,
      priority: typeof priority === 'string' ? priority.trim().toLowerCase() : undefined,
    });
  }
  return items;
}

export function findTodosInPart(part: any): TodoItem[] {
  const candidates = [
    part?.state?.output,
    part?.state?.input,
    part?.state?.metadata?.todos,
    part?.state?.metadata,
    part?.state?.raw,
  ];
  for (const c of candidates) {
    const list = extractAssistantTodos(c);
    if (list.length > 0) return list;
  }
  if (typeof part?.state?.output === 'string') {
    try {
      const parsed = JSON.parse(part.state.output);
      const list = extractAssistantTodos(parsed);
      if (list.length > 0) return list;
    } catch { /* noop */ }
  }
  return [];
}

export const TodoCard: React.FC<{ part: any; done?: boolean }> = ({ part }) => {
  const todos = useMemo(() => {
    // 官方 (packages/web part.tsx TodoWriteTool): state.input.todos, 排序 in_progress→pending→completed
    const priority: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
    const raw = findTodosInPart(part);
    return [...raw].sort((a, b) => priority[a.status] - priority[b.status]);
  }, [part]);
  const stats = useMemo(() => {
    let total = todos.length, completed = 0;
    for (const t of todos) if (t.status === 'completed') completed += 1;
    return { total, completed };
  }, [todos]);

  if (todos.length === 0) {
    return (
      <div className="oc-tool">
        <button type="button" className="oc-tool__trigger is-static is-pending">
          <span className="oc-tool__spinner" />
          <span className="oc-tool__title">Todos</span>
        </button>
      </div>
    );
  }

  return (
    <div className="oc-tool oc-todo is-open">
      <div className="oc-tool__trigger is-static">
        <span className="oc-todo__icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
        </span>
        <span className="oc-tool__title">Todos</span>
        <span className="oc-tool__sep">·</span>
        <span className="oc-tool__subtitle">{stats.completed}/{stats.total}</span>
      </div>
      <div className="oc-todo__list">
          {todos.map((t, i) => (
            <label key={i} className={`oc-todo__item is-${t.status}`}>
              <span className="oc-todo__box" data-state={t.status === 'completed' ? 'checked' : t.status === 'in_progress' ? 'progress' : 'none'}>
                {t.status === 'completed' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                {t.status === 'in_progress' && <span className="oc-todo__bar" />}
              </span>
              <span className="oc-todo__content">{t.content}</span>
            </label>
          ))}
        </div>
    </div>
  );
};
