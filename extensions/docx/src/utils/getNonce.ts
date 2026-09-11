import { randomBytes } from 'node:crypto';

export function getNonce(length = 32): string {
  if (!Number.isInteger(length) || length < 16) {
    throw new RangeError('Nonce length must be an integer of at least 16 characters.');
  }

  // numas 适配: 浏览器 buffer polyfill 不支持 'base64url' 编码, 手动做 url-safe 转换
  // (base64 → +/= 替换成 -/_ 并去 padding), 结果等价.
  const bytes = randomBytes(Math.ceil(length * 0.75) + 2);
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, length);
}
