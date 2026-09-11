/**
 * node:fs/promises 浏览器 shim (codeblitz web 扩展宿主无 Node API).
 * 只用到 realpath — web 宿主下按原样返回 (git 功能本就不可用, 该路径不会被真正依赖).
 */
export async function realpath(value: string): Promise<string> {
  return value
}

export default { realpath }
