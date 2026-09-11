/**
 * node:child_process 浏览器 shim (codeblitz web 扩展宿主无 Node API).
 * git 相关功能 (compareWithHead) 在 web 宿主不可用 — 调用即抛错, 由上层 catch 显示友好提示.
 */
export function execFile(
  _file: string,
  _args?: readonly string[],
  _options?: unknown,
  callback?: (error: Error | null, stdout: string, stderr: string) => void,
): void {
  const err = new Error('[docx] child_process is not available in the web extension host (git features disabled)')
  if (typeof callback === 'function') {
    callback(err, '', '')
    return
  }
  throw err
}

export default { execFile }
