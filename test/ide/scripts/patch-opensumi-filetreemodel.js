#!/usr/bin/env node
/**
 * patch-opensumi-filetreemodel.js — postinstall 自动应用 FileTreeService + FileTreeModelService race 修复
 *
 * 治本 opensumi file-tree-next 两个 race condition:
 *
 * 1) FileTreeService.init() listener race:
 *    framework fire-and-forget 启动 init(), 内部 await workspaceService.roots 时挂起.
 *    如果在 await 期间 module.ts 调 setWorkspace 触发 onWorkspaceChanged emit,
 *    FileTreeService.init() 还没注册 listener → emit 错过 → fileTreeService.root 仍是 undefined
 *    → explorer 只渲染 workspace 三角没子节点.
 *
 *    修复: init 走完 listener 注册好后, 检查 this._roots 是否非空但 this.root 还是 undefined,
 *    手动 fire 一次 onWorkspaceChangeEmitter + refresh, 重建 root + 通知 FileTreeModelService.
 *
 * 2) FileTreeModelService.onWorkspaceChange dispose race:
 *    FileTreeModelService 监听 fileTreeService.onWorkspaceChange, 回调里立即
 *    this.disposableCollection.dispose() + this.initTreeModel().
 *    dispose 把所有 push 进 collection 的 disposable 释放 (含刚 push 的自身 listener 和
 *    initTreeModel 重建期间 push 的新 listener), 中间窗口 emit 丢失 → explorer 空白.
 *
 *    修复: 把即将失效的 collection 暂存, 替换 this.disposableCollection 让 initTreeModel
 *    注册新 listener, 旧 collection 留给异步 dispose.
 *
 * 跟 patch-codeblitz-constant.js 风格一致: 局部字符串替换, 幂等, postinstall 自动应用.
 * npm install 后自动重放, 不会被重装覆盖.
 *
 * 触发场景:
 *   localStorage APP_CWD 残留 (用户之前选过的工作目录) 跟 server PWD (numas) 不一致时,
 *   module.ts onStart setWorkspace 触发 onWorkspaceChanged → FileTreeService.init() 错过 emit
 *   → explorer 子节点空白. 现治本: 两层 race 都修.
 */
const fs = require('node:fs');
const path = require('node:path');

const FTMODEL_FILE = path.resolve(
  __dirname,
  '../node_modules/@opensumi/ide-file-tree-next/lib/browser/services/file-tree-model.service.js',
);
const FTSERVICE_FILE = path.resolve(
  __dirname,
  '../node_modules/@opensumi/ide-file-tree-next/lib/browser/file-tree.service.js',
);

const MARKER_DEFER = '__numasDeferDispose';
const MARKER_RECOVER = '__numasRecoverRoot';
const MARKER_KEEP_ROOT = '__numasKeepRootOnResolve';

// ============================================================================
// Patch 1: FileTreeModelService dispose 推迟
// ============================================================================
const FTMODEL_OLD = `        this.disposableCollection.push(this.fileTreeService.onWorkspaceChange(() => {
            this.disposableCollection.dispose();
            this.initTreeModel();
        }));`;

const FTMODEL_NEW = `        this.disposableCollection.push(this.fileTreeService.onWorkspaceChange(() => {
            // numas patch (__numasDeferDispose): 原版立即 dispose() 会让 initTreeModel()
            // 重建期间新 push 的 onWorkspaceChange listener 被一起释放, 后续 emit 无 listener
            // 接收 → fileTreeService.root 仍是 undefined → explorer 只渲染 workspace 三角没子节点.
            // 改为: 把即将失效的 collection 暂存, 替换 this.disposableCollection 让 initTreeModel
            // 注册新 listener, 旧 collection 留到 initTreeModel 完成再 dispose. 双 collection 隔离.
            const __numasOldColl = this.disposableCollection;
            this.disposableCollection = new ide_core_browser_1.DisposableCollection();
            this.initTreeModel().then(() => {
                __numasOldColl.dispose();
            });
        }));`;

function patchFileTreeModel() {
  if (!fs.existsSync(FTMODEL_FILE)) {
    console.warn('[patch-filetreemodel] target not found:', FTMODEL_FILE);
    return false;
  }
  let src = fs.readFileSync(FTMODEL_FILE, 'utf-8');
  if (src.includes(MARKER_DEFER)) {
    console.log('[patch-filetreemodel] FileTreeModelService.dispose 已 patch, 跳过');
    return true;
  }
  if (!src.includes(FTMODEL_OLD)) {
    console.warn('[patch-filetreemodel] FileTreeModelService OLD pattern 未匹配, 版本可能变化, 请检查', FTMODEL_FILE);
    return false;
  }
  fs.writeFileSync(FTMODEL_FILE, src.replace(FTMODEL_OLD, FTMODEL_NEW));
  console.log('[patch-filetreemodel] FileTreeModelService.dispose 推迟 patch applied');
  return true;
}

// ============================================================================
// Patch 2: FileTreeService.init() setWorkspace 后兜底 fire
// ============================================================================
// init() 末尾插入兜底 fire: 如果 init 期间 setWorkspace 已 emit 但 listener 错过, 这里补一次.
// 锚点: 最后那个 onPreferenceChanged 的 `}));` 之后, 紧接着 `}` (init 结束) 之前.
const FTSERVICE_OLD = `        this.toDispose.push(this.corePreferences.onPreferenceChanged((change) => {
            if (change.preferenceName === 'explorer.fileTree.baseIndent') {
                this._baseIndent = change.newValue || 8;
                this.onTreeIndentChangeEmitter.fire({
                    indent: this.indent,
                    baseIndent: this.baseIndent,
                });
            }
            else if (change.preferenceName === 'explorer.fileTree.indent') {
                this._indent = change.newValue || 8;
                this.onTreeIndentChangeEmitter.fire({
                    indent: this.indent,
                    baseIndent: this.baseIndent,
                });
            }
            else if (change.preferenceName === 'explorer.compactFolders') {
                this._isCompactMode = change.newValue;
                this.refresh();
            }
        }));
    }`;

const FTSERVICE_NEW = `        this.toDispose.push(this.corePreferences.onPreferenceChanged((change) => {
            if (change.preferenceName === 'explorer.fileTree.baseIndent') {
                this._baseIndent = change.newValue || 8;
                this.onTreeIndentChangeEmitter.fire({
                    indent: this.indent,
                    baseIndent: this.baseIndent,
                });
            }
            else if (change.preferenceName === 'explorer.fileTree.indent') {
                this._indent = change.newValue || 8;
                this.onTreeIndentChangeEmitter.fire({
                    indent: this.indent,
                    baseIndent: this.baseIndent,
                });
            }
            else if (change.preferenceName === 'explorer.compactFolders') {
                this._isCompactMode = change.newValue;
                this.refresh();
            }
        }));
        // numas patch (__numasRecoverRoot + __numasKeepRootOnResolve): init 是 framework fire-and-forget 启动的,
        // await workspaceService.roots 期间 module.ts 的 setWorkspace 可能已经触发 emit,
        // 我们的 onWorkspaceChanged listener 错过 → fileTreeService.root 仍是 undefined →
        // explorer 只渲染 workspace 三角没子节点. 现在 init 走完 listener 都注册好,
        // 但 emit 不会再触发 — 手动 fire 一次让 FileTreeModelService.initTreeModel() 跑.
        //
        // 副作用: 原版 fire(newRoot) → FileTreeService.resolveChildren 没 parent → line 230
        //   this.root = children[0] (根目录的第一个子文件, 比如 .DS_Store) — 覆盖我们的根.
        // 治本: 在 FileTreeService.resolveChildren 同样标 __numasRecoverRoot 标志位, 检测
        //   this.root 已经是非空新根时, 不再覆盖, 直接返回 [this.root, ...children].
        if (this._roots && this._roots.length > 0 && !this.root) {
            const __numasRoots = this._roots;
            const __numasUri = new ide_core_browser_1.URI(__numasRoots[0].uri);
            const __numasRoot = new file_tree_node_define_1.Directory(this, undefined, __numasUri, __numasUri.displayName, __numasRoots[0], this.fileTreeAPI.getReadableTooltip(__numasUri));
            this.root = __numasRoot;
            this.onWorkspaceChangeEmitter.fire(__numasRoot);
            if (typeof window !== 'undefined') {
                window.__numasInit = window.__numasInit || {};
                window.__numasInit.fired = true;
                window.__numasInit.rootAfter = !!this.root;
                window.__numasInit.rootName = __numasRoot.name;
            }
        }
    }`;
    // numas patch 配套: FileTreeService.resolveChildren 没 parent 时, 不让 children[0] 覆盖
    // 已存在的根 (numasRecoverRoot 创建的) — 返回 [this.root, ...children] 让 explorer
    // 既显示根节点也能列出子项.
    const FTSERVICE_RESOLVE_OLD = `                if (this._roots.length > 0) {
                    children = await (await this.fileTreeAPI.resolveChildren(this, this._roots[0])).children;
                    children.forEach((child) => {
                        // 根据workspace更新Root名称
                        const rootName = this.workspaceService.getWorkspaceName(child.uri);
                        if (rootName && rootName !== child.name) {
                            child.updateMetaData({
                                name: rootName,
                            });
                        }
                        if (child.filestat.isSymbolicLink || child.filestat.isInSymbolicDirectory) {
                            this._symbolicFiles.set(child.filestat.uri, child);
                        }
                    });
                    this.watchFilesChange(new ide_core_browser_1.URI(this._roots[0].uri));
                    this.root = children[0];
                    return children;
                }`;
    const FTSERVICE_RESOLVE_NEW = `                if (this._roots.length > 0) {
                    children = await (await this.fileTreeAPI.resolveChildren(this, this._roots[0])).children;
                    children.forEach((child) => {
                        // 根据workspace更新Root名称
                        const rootName = this.workspaceService.getWorkspaceName(child.uri);
                        if (rootName && rootName !== child.name) {
                            child.updateMetaData({
                                name: rootName,
                            });
                        }
                        if (child.filestat.isSymbolicLink || child.filestat.isInSymbolicDirectory) {
                            this._symbolicFiles.set(child.filestat.uri, child);
                        }
                    });
                    this.watchFilesChange(new ide_core_browser_1.URI(this._roots[0].uri));
                    // numas patch (__numasKeepRootOnResolve): 根已被 recover 创建 (this.root 非空) 时,
                    // 不要再用 children[0] 覆盖 — 保留 numasRoot 当作项目根, children 挂它下面.
                    if (!this.root) this.root = children[0];
                    return [this.root, ...children];
                }`;

function patchFileTreeService() {
  if (!fs.existsSync(FTSERVICE_FILE)) {
    console.warn('[patch-filetreemodel] target not found:', FTSERVICE_FILE);
    return false;
  }
  let src = fs.readFileSync(FTSERVICE_FILE, 'utf-8');
  // 新版 patch 双 marker (init 端 + resolveChildren 端), 都在即视为完整应用
  if (src.includes(MARKER_KEEP_ROOT)) {
    console.log('[patch-filetreemodel] FileTreeService 新版 patch 已应用, 跳过');
    return true;
  }
  // 旧版 patch (只有 __numasRecoverRoot, 没 __numasKeepRootOnResolve): revert 后重打
  if (src.includes(MARKER_RECOVER)) {
    console.log('[patch-filetreemodel] 检测到旧版 __numasRecoverRoot patch, revert 后重打');
    const oldInitBlock = /        \/\/ numas patch \(__numasRecoverRoot\):[\s\S]*?window\.__numasInit\.rootName = __numasRoot\.name;\n            \}\n        \}\n/;
    src = src.replace(oldInitBlock, '');
    // resolveChildren 旧版 (含 __numasRecoverRoot 注释) 也 revert 到原版
    const oldResolveBlock = /                    \/\/ numas patch \(__numasRecoverRoot\):[\s\S]*?return children;\n/;
    src = src.replace(oldResolveBlock, '                    this.root = children[0];\n                    return children;\n');
  }
  if (!src.includes(FTSERVICE_OLD)) {
    console.warn('[patch-filetreemodel] FileTreeService.init OLD pattern 未匹配, 版本可能变化, 请检查', FTSERVICE_FILE);
    return false;
  }
  // 1) init() 末尾插入 __numasRecoverRoot (fire + 创建根)
  let out = src.replace(FTSERVICE_OLD, FTSERVICE_NEW);
  // 2) resolveChildren() line 216 配套: children[0] 不再覆盖 this.root
  if (out.includes(FTSERVICE_RESOLVE_OLD)) {
    out = out.replace(FTSERVICE_RESOLVE_OLD, FTSERVICE_RESOLVE_NEW);
  } else {
    console.warn('[patch-filetreemodel] FileTreeService.resolveChildren OLD pattern 未匹配, 已 patch init 但 resolveChildren 仍是原版, 请检查', FTSERVICE_FILE);
  }
  fs.writeFileSync(FTSERVICE_FILE, out);
  console.log('[patch-filetreemodel] FileTreeService.init 兜底 fire patch applied (+ resolveChildren 配套)');
  return true;
}

const ok1 = patchFileTreeModel();
const ok2 = patchFileTreeService();
if (!ok1 || !ok2) process.exitCode = 1;
