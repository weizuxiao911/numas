/**
 * node:buffer 浏览器注入 (esbuild inject) — 扩展宿主为 web worker, 无 Node 全局.
 * 代码里对 Buffer 的自由引用 (Buffer.from(...).toString('base64'|'utf8') 等) 由此注入.
 */
export { Buffer } from 'buffer'
