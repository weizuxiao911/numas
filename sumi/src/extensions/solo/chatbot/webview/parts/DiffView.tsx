import React from 'react';

/**
 * DiffView — edit 工具结果的左右对照 (split) diff.
 *
 * 数据源: edit 工具 metadata.filediff.patch (unified diff), 无 before/after 全文,
 * 所以按 hunk 解析: 上下文行两侧同显; 删除/新增按行配对 (左=旧/红, 右=新/绿).
 * 视觉与 Markdown 代码块一致 (macOS 窗口: 标题栏三色点 + 居中语言标签).
 */

interface DiffRow {
  type: 'hunk' | 'row';
  text?: string;
  leftNo?: number | null;
  rightNo?: number | null;
  left?: string;
  right?: string;
  leftType?: 'ctx' | 'del' | 'empty';
  rightType?: 'ctx' | 'add' | 'empty';
}

export function parseUnifiedDiff(patch: string): DiffRow[] {
  const lines = String(patch || '').replace(/\r\n?/g, '\n').split('\n');
  const rows: DiffRow[] = [];
  let leftNo = 0;
  let rightNo = 0;
  let dels: string[] = [];
  let adds: string[] = [];
  let started = false;

  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) {
      const d = dels[i];
      const a = adds[i];
      rows.push({
        type: 'row',
        leftNo: d != null ? leftNo++ : null,
        rightNo: a != null ? rightNo++ : null,
        left: d ?? '',
        right: a ?? '',
        leftType: d != null ? 'del' : 'empty',
        rightType: a != null ? 'add' : 'empty',
      });
    }
    dels = [];
    adds = [];
  };

  for (const line of lines) {
    if (line.startsWith('@@')) {
      flush();
      started = true;
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (m) {
        leftNo = parseInt(m[1], 10);
        rightNo = parseInt(m[2], 10);
      }
      rows.push({ type: 'hunk', text: line.replace(/^@@\s*/, '').replace(/\s*@@.*$/, '') });
      continue;
    }
    if (!started) continue; // 跳过 Index/====/---/+++ 头部
    if (line.startsWith('-')) { dels.push(line.slice(1)); continue; }
    if (line.startsWith('+')) { adds.push(line.slice(1)); continue; }
    if (line.startsWith(' ')) {
      flush();
      const text = line.slice(1);
      rows.push({ type: 'row', leftNo: leftNo++, rightNo: rightNo++, left: text, right: text, leftType: 'ctx', rightType: 'ctx' });
      continue;
    }
    // '\ No newline at end of file' 等元信息行忽略
  }
  flush();
  return rows;
}

export const DiffView: React.FC<{ patch: string }> = ({ patch }) => {
  const rows = React.useMemo(() => parseUnifiedDiff(patch), [patch]);
  return (
    <div className="oc-diff">
      <div className="oc-diff__bar">
        <span className="oc-diff__label">diff</span>
      </div>
      <div className="oc-diff__body">
        {rows.map((r, i) => r.type === 'hunk' ? (
          <div key={i} className="oc-diff__hunk">{r.text}</div>
        ) : (
          <div key={i} className="oc-diff__row">
            <span className="oc-diff__no">{r.leftNo ?? ''}</span>
            <span className={`oc-diff__cell is-${r.leftType}`}>{r.left}</span>
            <span className="oc-diff__no oc-diff__no--right">{r.rightNo ?? ''}</span>
            <span className={`oc-diff__cell is-${r.rightType}`}>{r.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
