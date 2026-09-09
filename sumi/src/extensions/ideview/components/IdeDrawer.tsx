/**
 * SPIKE — 抽屉内 Explorer(自绘树) + EditorView 双栏
 * - 树: IdeTree (IFileServiceClient 懒加载, 双击/单击文件 → editor.open)
 * - 编辑器: @opensumi/ide-editor EditorView (任意容器可挂, 承接不同 editor component)
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace.interface';
import { URI, FileStat } from '@opensumi/ide-core-common';
import { EditorView } from '@opensumi/ide-editor/lib/browser/editor.view';

import { getWorkspace, subscribeWorkspace } from '../../../infra/url';
import { normalizeCwdPath } from '../../../infra/path';
import { IdeTree } from './IdeTree';

const styles = `
.idev { display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--editor-background, #fff); color: var(--editor-foreground, #1f2328); }
.idev__head { display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; font-size: 12px; font-weight: 600; flex-shrink: 0;
  box-shadow: 0 1px 0 color-mix(in srgb, currentColor 10%, transparent); }
.idev__ws { font-weight: 400; opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.idev__body { display: flex; flex: 1; min-height: 0; }
.idev__tree { width: 250px; flex-shrink: 0; overflow: auto;
  border-right: 1px solid color-mix(in srgb, currentColor 10%, transparent); padding: 6px 0; }
.idev-tree__row { display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 4px;
  cursor: pointer; font-size: 13px; line-height: 1.5; white-space: nowrap; user-select: none; }
.idev-tree__row:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.idev-tree__caret { width: 12px; flex-shrink: 0; opacity: .6; font-size: 11px; }
.idev-tree__icon { flex-shrink: 0; font-size: 14px; }
.idev-tree__name { overflow: hidden; text-overflow: ellipsis; }
.idev-tree__loading { opacity: .5; }
.idev-tree__empty, .idev-tree__err { padding: 14px 12px; font-size: 12px; opacity: .65; }
.idev__editor { flex: 1; min-width: 0; min-height: 0; display: flex; }
.idev__editor > * { flex: 1; min-width: 0; }
`;

export const IdeDrawer: React.FC = () => {
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const [workspace, setWorkspace] = React.useState<string>(() => getWorkspace());
  React.useEffect(() => subscribeWorkspace((w: string) => setWorkspace(w)), []);

  // workspace → codeblitz workspace root (编辑器/资源解析依赖)
  React.useEffect(() => {
    const ws = normalizeCwdPath(workspace || '');
    if (!ws) return;
    const driveLower = ws.replace(/^\/+/, '').match(/^([A-Za-z]):/);
    const filePath = driveLower ? '/' + driveLower[1].toLowerCase() + ':' + ws.replace(/^[A-Za-z]:/, '') : ws;
    const stat: FileStat = { uri: URI.parse(`file://${filePath}`), lastModification: 0, isDirectory: true, name: '' } as any;
    void workspaceService.setWorkspace(stat).catch((e) => console.warn('[idev] setWorkspace:', e));
  }, [workspace, workspaceService]);

  return (
    <div className="idev">
      <style>{styles}</style>
      <div className="idev__head">
        <span>Explorer</span>
        <span className="idev__ws">{workspace ? workspace.split('/').slice(-2).join('/') : ''}</span>
      </div>
      <div className="idev__body">
        <div className="idev__tree">
          <IdeTree workspace={workspace} />
        </div>
        <div className="idev__editor">
          <EditorView />
        </div>
      </div>
    </div>
  );
};
