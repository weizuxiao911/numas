import * as esbuild from 'esbuild'

// 1) extension host bundle (vscode API 外部化)
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: true,
  keepNames: true,
  tsconfig: 'tsconfig.json',
})

// 2) webview bundle (React, 由 shell HTML 以 <script src> 从 registry 加载)
await esbuild.build({
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: true,
  jsx: 'automatic',
  tsconfig: 'tsconfig.json',
  define: { 'process.env.NODE_ENV': '"production"' },
})
