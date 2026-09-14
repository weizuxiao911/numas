import React from 'react';

/**
 * PermissionModal — 工具权限请求 (官方 DockPrompt kind=permission)
 * 结构抄官方 session-permission-dock:
 *   shell: header(标题) + body(工具描述 + pattern 代码行)
 *   tray:  [拒绝(ghost)] [始终允许(secondary)] [允许一次(primary)]
 * 颜色走主题变量 (与 oc-qd 相同推导); 尺寸/字号按官方.
 * 注: 出现时输入发送区被 dockPromptActive 顶替 (官方同款).
 */
export const PermissionModal: React.FC<{
  permission: any;
  onReply: (permissionID: string, response: 'once' | 'always' | 'reject') => void;
  onDismiss: () => void;
}> = ({ permission, onReply, onDismiss }) => {
  if (!permission?.id) return null;
  // 官方 payload: { id, sessionID, permission: 'bash', patterns: [...], metadata:{command}, always:[...] }
  const toolName = String(permission.permission || permission.tool || permission.type || '').toUpperCase();
  const title = toolName ? `权限请求 · ${toolName}` : (permission.title || '权限请求');
  const patterns: string[] = [
    ...(Array.isArray(permission.patterns) ? permission.patterns : []),
    ...(Array.isArray(permission.pattern) ? permission.pattern : permission.pattern ? [permission.pattern] : []),
  ];
  if (permission.metadata?.command && !patterns.includes(permission.metadata.command)) {
    patterns.unshift(permission.metadata.command);
  }
  const btn = (label: string, resp: 'once' | 'always' | 'reject', variant: string, disabled = false) => (
    <button
      type="button"
      className={`oc-qd__btn ${variant}`}
      onClick={() => onReply(permission.id, resp)}
      disabled={disabled}
    >
      {label}
    </button>
  );
  return (
    <div className="oc-qd oc-qd--permission">
      <div className="oc-qd__shell">
        <div className="oc-qd__header">
          <span className="oc-qd__title">{title}</span>
        </div>
        <div className="oc-qd__body">
          <div className="oc-qd__hint">允许 AI 执行以下命令/操作:</div>
          {patterns.length > 0 && (
            <div className="oc-perm__patterns">
              {patterns.map((p: string, i: number) => (
                <code key={i} className="oc-perm__pattern">{p}</code>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="oc-qd__tray">
        {btn('拒绝', 'reject', 'oc-qd__btn--ghost')}
        <div className="oc-qd__footer-actions">
          {btn('始终允许', 'always', 'oc-qd__btn--secondary')}
          {btn('允许一次', 'once', 'oc-qd__btn--primary')}
        </div>
      </div>
    </div>
  );
};
