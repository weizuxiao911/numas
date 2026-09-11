/**
 * node:crypto 浏览器 shim (codeblitz web 扩展宿主无 Node API)
 * 只用 randomBytes — 用 Web Crypto 的 getRandomValues 实现.
 * 注意: 必须返回 Buffer (不是 Uint8Array) — 调用方会对结果调 .toString('base64').
 */
import { Buffer } from 'buffer'

export function randomBytes(size: number): Buffer {
  const bytes = new Uint8Array(size)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Buffer.from(bytes)
}

export default { randomBytes }
