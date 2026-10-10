/**
 * tiktoken stub — numas 构建期替换.
 *
 * 背景: @opensumi/ide-ai-native 的 inline-completions/tokenizer.js 顶层
 * `require("tiktoken")` 会把 3.13MB 的 tiktoken_bg.wasm 打进启动包 (eager),
 * 而 get_encoding 实际只在 inline-completions 功能被使用时才调用 — numas 不使用该功能.
 *
 * 该 stub 由 webpack resolve.alias 替换 "tiktoken": 启动不再加载 3MB wasm;
 * 若未来真的调用, 返回一个近似的假 tokenizer (不崩, 但计数不精确) 并打一次 warn.
 */
let warned = false;

export function get_encoding(_name?: string): {
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
  free: () => void;
} {
  if (!warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn('[numas] tiktoken 已被 stub (inline-completions 未使用), token 计数为近似值');
  }
  return {
    encode: (text: string) => Array.from(String(text ?? '')).map((_, i) => i),
    decode: () => '',
    free: () => {},
  };
}

export default { get_encoding };
