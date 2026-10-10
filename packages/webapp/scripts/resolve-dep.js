#!/usr/bin/env node
/**
 * resolve-dep.js — 定位依赖包目录, 兼容 bun isolated 与 hoisted 两种 node_modules 布局。
 *
 * 背景: bun 1.4 对 workspace 默认 isolated (依赖装在各包自己的 node_modules);
 * bunfig 设 linker="hoisted" 后 (Windows 上 webapp webpack 解析 opensumi 全套
 * 传递依赖需要扁平布局), 传递依赖被提升到仓库根 node_modules, 包内
 * node_modules/@codeblitzjs|@opensumi 下不再有这些包。
 *
 * patch-*.js 是就地改第三方包源码, 目标多为 codeblitz/opensumi 的**传递依赖**, 不能
 * 写死 '../node_modules/<pkg>'; 改为从脚本目录逐级向上找 node_modules/<pkg>。
 */
const fs = require('node:fs');
const path = require('node:path');

/** 返回离 from 最近的、真实存在的 node_modules/<pkg> 目录绝对路径。 */
function resolvePkg(pkg, from = __dirname) {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', pkg);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(from, '..', 'node_modules', pkg);
    dir = parent;
  }
}

module.exports = { resolvePkg };
