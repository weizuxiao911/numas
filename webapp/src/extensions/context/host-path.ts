/**
 * OpenSumi URI → 宿主机绝对路径. 走 infra/path.ts, 禁止手拼前导 /.
 */
import { URI } from '@opensumi/ide-core-common';
import { getHostAnchors } from '../../infra/host';
import { normalizeCwdPath, pathBase, toHostPath } from '../../infra/path';

export function hostPathFromUri(uri: URI | undefined | null): string {
  if (!uri) return '';
  const raw = String((uri as any).codeUri?.fsPath || uri.path?.toString?.() || '');
  if (!raw) return '';
  const host = toHostPath(raw, getHostAnchors());
  return normalizeCwdPath(host || raw);
}

export function displayNameFromPath(p: string): string {
  return pathBase(p) || p;
}
