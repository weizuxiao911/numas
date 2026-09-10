/**
 * 抽屉两列: 官方 explorer (FileTree) + 编辑器容器 (EditorView)
 * - workspace 切换 → 同步 codeblitz workspace root → 刷新文件树
 * - 官方树在 roots 正确指向项目后才挂载 (避免 root_0 空根)
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace.interface';
import { IFileTreeService } from '@opensumi/ide-file-tree-next/lib/common';
import { URI, FileStat } from '@opensumi/ide-core-common';
import { FileTree } from '@opensumi/ide-file-tree-next/lib/browser/file-tree';
import { EditorView } from '@opensumi/ide-editor/lib/browser/editor.view';

import { getWorkspace, subscribeWorkspace } from '../../../infra/url';
import { normalizeCwdPath } from '../../../infra/path';

const styles = `
.dexplorer { display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--editor-background, #fff); color: var(--editor-foreground, #1f2328); }
.dexplorer__head { padding: 8px 14px; font-size: 12px; font-weight: 600; flex-shrink: 0;
  box-shadow: 0 1px 0 color-mix(in srgb, currentColor 10%, transparent);
  display: flex; justify-content: space-between; align-items: center; }
.dexplorer__ws { font-weight: 400; opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dexplorer__body { flex: 1; min-height: 0; display: flex; }
.dexplorer__tree { width: 250px; flex-shrink: 0; overflow: hidden;
  border-right: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
.dexplorer__editor { flex: 1; min-width: 0; min-height: 0; display: flex; }
.dexplorer__editor > * { flex: 1; min-width: 0; }
.dexplorer__editor [class*='kt_editor_tabs'] { display: none; }
.dexplorer__loading { padding: 14px; font-size: 12px; opacity: .65; }
`;

function toCodeblitzPath(ws: string): string {
  const driveLower = ws.replace(/^\/+/, '').match(/^([A-Za-z]):/);
  return driveLower ? '/' + driveLower[1].toLowerCase() + ':' + ws.replace(/^[A-Za-z]:/, '') : ws;
}

export const ExplorerView: React.FC = () => {
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const fileTreeService = useInjectable<IFileTreeService>(IFileTreeService);
  const [workspace, setWorkspace] = React.useState<string>(() => getWorkspace());
  const [treeReady, setTreeReady] = React.useState(false);
  const [vs, setVs] = React.useState({ width: 250, height: 400 });
  const treeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => subscribeWorkspace((w: string) => setWorkspace(w)), []);

  // 项目切换 → 同步 codeblitz workspace root → 刷新文件树 (门控: 树在正确根后才挂载)
  React.useEffect(() => {
    const ws = normalizeCwdPath(workspace || '');
    if (!ws) return;
    setTreeReady(false);
    let alive = true;
    const filePath = toCodeblitzPath(ws);
    const targetUri = `file://${filePath}`;
    const stat: FileStat = { uri: URI.parse(targetUri), lastModification: 0, isDirectory: true, name: '' } as any;

    const apply = async () => {
      try {
        await workspaceService.setWorkspace(stat);
        // 轮询 roots 确认已指向目标项目 (避免 root_0 空根)
        for (let i = 0; i < 10; i++) {
          if (!alive) return;
          const roots = await workspaceService.roots;
          const r0 = roots?.[0]?.uri?.toString?.() || '';
          if (r0 === targetUri) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        fileTreeService.refresh?.().catch(() => {});
        setTimeout(() => fileTreeService.refresh?.().catch(() => {}), 800);
        if (alive) setTreeReady(true);
      } catch (e) {
        console.warn('[explorer] sync workspace:', e);
        if (alive) setTreeReady(true);
      }
    };
    void apply();
    return () => { alive = false; };
  }, [workspace, workspaceService, fileTreeService]);

  React.useEffect(() => {
    const el = treeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVs((p) => (p.width === el.clientWidth && p.height === el.clientHeight ? p : { width: el.clientWidth, height: el.clientHeight }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="dexplorer">
      <style>{styles}</style>
      <div className="dexplorer__head">
        <span>Explorer</span>
        <span className="dexplorer__ws">{workspace ? workspace.split('/').slice(-2).join('/') : ''}</span>
      </div>
      <div className="dexplorer__body">
        <div className="dexplorer__tree" ref={treeRef}>
          {treeReady ? <FileTree viewState={vs} /> : <div className="dexplorer__loading">加载文件树…</div>}
        </div>
        <div className="dexplorer__editor">
          <EditorView />
        </div>
      </div>
    </div>
  );
};
