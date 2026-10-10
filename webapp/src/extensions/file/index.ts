/**
 * File 组 — 文件相关功能模块
 *
 *   picker:    文件/目录选择器 (requestFilePicker, 供 workspace / main 调用)
 *   ops:       上传 / 下载 / 压缩 zip (文件树右键 + 标题栏)
 *   open-type: explorer 右键「打开方式... / 配置默认编辑器」重写 (修复原生 bug)
 *
 * 每个子目录仍是独立 BrowserModule; 这里只做分组 barrel, 多 export 汇总.
 */
export * from './picker';
export * from './ops';
export * from './open-type';
