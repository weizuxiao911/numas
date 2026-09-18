import { context } from 'esbuild';
import { rm } from 'node:fs/promises';

const watchMode = process.argv.includes('--watch');
const production = !watchMode;

await rm('dist', { recursive: true, force: true });

const shared = {
  bundle: true,
  logLevel: 'info',
  minify: production,
  sourcemap: watchMode,
};

const extensionContext = await context({
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  // numas 适配: codeblitz 扩展宿主是 web worker (无 Node API), 扩展侧必须按 browser 构建;
  // Node 内置用 shim 别名 + Buffer 注入 (对齐网关 show-docx 的 web 适配做法).
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  external: ['vscode'],
  alias: {
    'node:path': 'path-browserify',
    'node:crypto': './shims/crypto.ts',
    'node:child_process': './shims/child_process.ts',
    'node:fs/promises': './shims/fs-promises.ts',
  },
  inject: ['./shims/buffer-inject.ts'],
  banner: {
    js: 'var process = typeof process !== "undefined" ? process : { env: {}, nextTick: function (f) { setTimeout(f, 0); } };',
  },
});

const webviewContext = await context({
  ...shared,
  entryPoints: ['webview-src/main.ts'],
  outfile: 'dist/webview/main.js',
  platform: 'browser',
  format: 'iife',
  target: 'chrome114',
  assetNames: 'assets/[name]-[hash]',
  loader: {
    '.ttf': 'file',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
  },
});

if (watchMode) {
  await Promise.all([extensionContext.watch(), webviewContext.watch()]);
  console.log('Watching extension and webview sources...');
} else {
  await Promise.all([extensionContext.rebuild(), webviewContext.rebuild()]);
  await Promise.all([extensionContext.dispose(), webviewContext.dispose()]);
}
