/**
 * SPIKE — 自绘文件树 (不依赖官方 FileTree 的 model 生命周期)
 * 数据: codeblitz IFileServiceClient.getFileStat(uri, true) (走自定义 file provider → HTTP)
 * 打开: CommandService.executeCommand('editor.open', uri)
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';
import { CommandService } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

interface Node {
  uri: string;
  name: string;
  isDir: boolean;
  children?: Node[];
}

function toUri(p: string): string {
  const drive = p.replace(/^\/+/, '').match(/^([A-Za-z]):/);
  const fp = drive ? '/' + drive[1].toLowerCase() + ':' + p.replace(/^[A-Za-z]:/, '') : p;
  return `file://${fp}`;
}

async function loadDir(fs: IFileServiceClient, uri: string): Promise<Node[]> {
  try {
    await fs.shouldWaitProvider('file').catch(() => {});
    const stat = await fs.getFileStat(uri, true);
    const kids: any[] = stat?.children || [];
    const list = kids
      .filter((c) => c && c.uri)
      .map((c) => {
        const rawName = c.name || c.uri.toString().split('/').pop() || '';
        let name = rawName;
        try { name = decodeURIComponent(rawName); } catch { /* keep raw */ }
        return { uri: c.uri.toString(), name, isDir: !!(c.type === 2 || c.isDirectory) };
      });
    list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return list;
  } catch (e) {
    console.warn('[idev-tree] loadDir fail', uri, e);
    return [];
  }
}

const TreeRow: React.FC<{ node: Node; depth: number; fs: IFileServiceClient; editor: WorkbenchEditorService }> = ({ node, depth, fs, editor }) => {
  const [open, setOpen] = React.useState(depth === 0);
  const [children, setChildren] = React.useState<Node[]>([]);
  const [loading, setLoading] = React.useState(false);

  const toggle = React.useCallback(async () => {
    if (!node.isDir) return;
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (children.length === 0) {
      setLoading(true);
      const list = await loadDir(fs, node.uri);
      setChildren(list);
      setLoading(false);
    }
  }, [node, open, children, fs]);

  const openFile = React.useCallback(() => {
    if (node.isDir) return;
    try { void editor.open(URI.parse(node.uri)); } catch (e) { console.warn('[idev] open fail', e); }
  }, [node, editor]);

  return (
    <React.Fragment>
      <div
        className="idev-tree__row"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={node.isDir ? toggle : openFile}
        onDoubleClick={node.isDir ? undefined : openFile}
        title={node.name}
      >
        <span className="idev-tree__caret" aria-hidden>{node.isDir ? (open ? '▾' : '▸') : ''}</span>
        <span className="idev-tree__icon" aria-hidden>{node.isDir ? (open ? '📂' : '📁') : '📄'}</span>
        <span className="idev-tree__name">{node.name}</span>
        {loading && <span className="idev-tree__loading">…</span>}
      </div>
      {node.isDir && open && children.map((c) => (
        <TreeRow key={c.uri} node={c} depth={depth + 1} fs={fs} editor={editor} />
      ))}
    </React.Fragment>
  );
};

export const IdeTree: React.FC<{ workspace: string }> = ({ workspace }) => {
  const fs = useInjectable<IFileServiceClient>(IFileServiceClient);
  const editor = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const [root, setRoot] = React.useState<Node | null>(null);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    if (!workspace) return;
    const uri = toUri(workspace);
    let alive = true;
    let attempt = 0;
    const run = () => {
      loadDir(fs, uri).then((list) => {
        if (!alive) return;
        const name = workspace.split('/').pop() || '';
        if (list.length === 0 && attempt < 3) { attempt += 1; setTimeout(run, 1000); return; }
        if (list.length === 0) setErr('(空目录或读取失败)');
        setRoot({ uri, name, isDir: true, children: list });
      }).catch(() => {
        if (!alive) return;
        if (attempt < 3) { attempt += 1; setTimeout(run, 1000); }
        else setErr('读取失败');
      });
    };
    run();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  if (err) return <div className="idev-tree__err">{err}</div>;
  if (!root) return <div className="idev-tree__empty">加载中…</div>;
  return (
    <div className="idev-tree">
      {root.children?.map((c) => (
        <TreeRow key={c.uri} node={c} depth={0} fs={fs} editor={editor} />
      ))}
    </div>
  );
};
