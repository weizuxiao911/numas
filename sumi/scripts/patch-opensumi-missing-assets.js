#!/usr/bin/env node
/**
 * patch-opensumi-missing-assets.js — postinstall: 补 opensumi 3.6.5 next 版漏发资源
 *
 * 两个 npm 发布漏文件 (上游 .npmignore 漏了非 .js 资源):
 *   1) @opensumi/ide-components/lib/style/variable.less
 *      base.less / mixins.less 都 `@import 'variable.less'` — 缺失导致
 *      less-loader 编译失败 (44 errors).
 *   2) @opensumi/ide-debug/lib/browser/assets/breakpoint.svg
 *      debug-style.less 引用 — 缺失导致 css-loader 找不到资源.
 *
 * 内容策略: 1 是空变量定义 (less mixin 引用了 @text-color 等, 实际渲染由
 *          kt theme css-var 接管, less 阶段只需不出错).
 *          2 是 1x1 透明 png base64 (data url 也行, 这里直接给最小 svg 占位).
 *
 * 幂等: 文件已存在且非 marker (没被我们写过) → 跳过; 否则覆盖.
 */
const fs = require('node:fs');
const path = require('node:path');

const COMPONENTS_LESS = path.resolve(
  __dirname,
  '../node_modules/@opensumi/ide-components/lib/style/variable.less'
);
const DEBUG_BREAKPOINT_SVG = path.resolve(
  __dirname,
  '../node_modules/@opensumi/ide-debug/lib/browser/assets/breakpoint.svg'
);
const DEBUG_BREAKPOINT_DISABLED_SVG = path.resolve(
  __dirname,
  '../node_modules/@opensumi/ide-debug/lib/browser/assets/breakpoint-disabled.svg'
);

const MARKER = '/* numas-patch: opensumi 3.6.5 漏发 variable.less 兜底 */';
const SVG_MARKER = '<!-- numas-patch: opensumi ide-debug 漏发 breakpoint.svg 兜底 -->';

// opensumi base.less 引用了这些变量; 留空定义足够让 less-loader 通过, 实际配色由
// kt 全局 css-var (--text-color 等) 覆盖, 这里只是占位避免 less 编译失败.
const VARIABLE_LESS = `${MARKER}
// 兜底空定义: opensumi 3.6.5 next npm 包 .npmignore 误过滤了本文件.
// base.less / mixins.less 都 @import 'variable.less', 缺失会 less-loader 编译失败.
// 实际 UI 配色由 @opensumi/ide-core-browser 的 kt 主题 css 变量驱动, 这里仅占位.
@text-color: inherit;
@font-size-base: 14px;
@font-size-sm: 12px;
@line-height-base: 1.5715;
@font-variant-base: tabular-nums;
@font-feature-settings-base: 'tnum';
@animation-duration-base: 0.2s;
@icon-color: inherit;
@font-variant-base: tabular-nums;
@black: #000;
@html-selector: html;
@body-selector: body;
`;

const SVG = `${SVG_MARKER}
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>
`;

function ensure(file, content, marker) {
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (existing.includes(marker)) {
      console.log(`[patch-opensumi-missing-assets] ${path.basename(file)} 已 patch, 跳过`);
      return false;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`[patch-opensumi-missing-assets] ${path.relative(path.resolve(__dirname, '..'), file)} 创建`);
  return true;
}

let applied = 0;
applied += ensure(COMPONENTS_LESS, VARIABLE_LESS, MARKER) ? 1 : 0;
applied += ensure(DEBUG_BREAKPOINT_SVG, SVG, SVG_MARKER) ? 1 : 0;
applied += ensure(DEBUG_BREAKPOINT_DISABLED_SVG, SVG, SVG_MARKER) ? 1 : 0;

if (applied === 0) {
  console.log('[patch-opensumi-missing-assets] 全部已存在, 无改动');
}
