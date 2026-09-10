"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const webpack_1 = __importDefault(require("webpack"));
const html_webpack_plugin_1 = __importDefault(require("html-webpack-plugin"));
const node_polyfill_webpack_plugin_1 = __importDefault(require("node-polyfill-webpack-plugin"));
// 配置在 web/ 内, 自身即 web 根; .env 在 web/, 显式 ./.env.${DEPLOY_ENV}
const WEB = __dirname;
const PROJECT_ROOT = path_1.default.resolve(WEB, '..');
function loadEnvVar(name, fallback = '') {
    // 优先 web/.env, 兜底项目根 .env (兼容老配置)
    const candidates = [
        path_1.default.resolve(WEB, `.env.${process.env.DEPLOY_ENV || 'development'}`),
        path_1.default.resolve(PROJECT_ROOT, `.env.${process.env.DEPLOY_ENV || 'development'}`),
    ];
    for (const envFile of candidates) {
        try {
            if (!fs_1.default.existsSync(envFile))
                continue;
            const content = fs_1.default.readFileSync(envFile, 'utf-8');
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const eq = trimmed.indexOf('=');
                if (eq <= 0)
                    continue;
                const key = trimmed.slice(0, eq).trim();
                if (key === name) {
                    return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
                }
            }
        }
        catch { /* ignore */ }
    }
    return fallback;
}
/** env var 解析: process.env (cli 注入) 优先, 兜底 .env (直接 cd client && npm run dev 用), 最后 hardcoded 默认 */
function getEnv(name, fallback = '') {
    return process.env[name] || loadEnvVar(name, '') || fallback;
}
const isDev = process.env.NODE_ENV !== 'production';
const config = {
    mode: isDev ? 'development' : 'production',
    target: 'web',
    entry: path_1.default.resolve(WEB, 'src/index.tsx'),
    output: {
        path: path_1.default.resolve(WEB, 'dist'),
        filename: '[name].[contenthash:8].js',
        publicPath: '/',
    },
    // cache 策略:
    //   - dev (webpack serve): memory. filesystem pack 在 watch 重建时常被并发写/清理,
    //     触发 `Caching failed for pack: ENOENT ... .webpack-cache/default-development/N.pack`
    //     并把 dev server 进程带崩 (需人工 rm -rf .webpack-cache 重启). 内存缓存不落盘,
    //     增量 rebuild 仍在 300ms 级, 换来 dev 不再崩.
    //   - production build: filesystem, 保留大依赖 (monaco 等) 的跨次构建缓存收益.
    cache: isDev
        ? { type: 'memory' }
        : {
            type: 'filesystem',
            cacheDirectory: path_1.default.resolve(WEB, '.webpack-cache'),
            buildDependencies: {
                config: [__filename],
            },
        },
    watchOptions: {
        // 排除输出/缓存/运行期数据目录, 避免删除/重建目录时 watcher ENOENT 风暴杀掉 webpack
        ignored: [
            '**/node_modules/**',
            '**/.webpack-cache/**',
            '**/dist/**',
            '**/.playwright-screenshots/**',
            '**/.playwright-mcp/**',
        ],
        poll: false,
        aggregateTimeout: 200,
    },
    optimization: {
        // 把 monaco-editor 这种超大模块拆到独立 chunk, 避免单个 bundle 过大
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                monaco: {
                    test: /[\\/]node_modules[\\/]@opensumi[\\/]monaco-editor-core[\\/]/,
                    name: 'monaco-core',
                    chunks: 'all',
                    priority: 30,
                },
                opensumi: {
                    test: /[\\/]node_modules[\\/]@opensumi[\\/]/,
                    name: 'opensumi',
                    chunks: 'all',
                    priority: 20,
                },
                codeblitz: {
                    test: /[\\/]node_modules[\\/]@codeblitzjs[\\/]/,
                    name: 'codeblitz',
                    chunks: 'all',
                    priority: 25,
                },
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 10,
                },
            },
        },
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
        alias: {
            '@': path_1.default.resolve(WEB, 'src'),
            '@/': path_1.default.resolve(WEB, 'src') + path_1.default.sep,
            // 注: customEditors.js (customEditor webview 挂载) 由 postinstall 就地改 node_modules
            //     (scripts/patch-opensumi-customeditors.js), 不走 alias
            //     (opensumi 包内相对路径互引, alias 匹配不上)
            // 注: WORKSPACE_ROOT patch 不走 alias (codeblitz 包内相对路径互引 alias 不生效),
            //     由 postinstall 脚本就地改 node_modules (scripts/patch-codeblitz-constant.js)
        },
        fallback: {
            // 构建期 fallback: 供第三方库（opensumi/codeblitz）浏览器兼容, src 本身零 node 依赖
            path: require.resolve('path-browserify'),
            fs: false,
            crypto: false,
            stream: false,
            buffer: false,
            os: false,
            process: false,
        },
    },
    experiments: {
        asyncWebAssembly: true,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                // 排除 numas 自己的 node_modules (相对 web/ 项目根), 不用 /node_modules/ 这种
                // 简单 regex, 因为 npx 跑时 file path 包含 /node_modules/numas/, 用简单 regex
                // 会错误排除 numas 自己的源码, 导致 esbuild-loader 不匹配, 走默认 js parser 报错.
                exclude: /\/node_modules\/(?!numas\/)/,
                use: [{
                        loader: 'esbuild-loader',
                        options: {
                            // esbuild-loader 默认 tsx=transform, target=es2015; loader 内置 ts 配置
                            // 不需要 tsconfig (但项目里有 src/ tsconfig.json 给 src/ 自己的 typecheck 用, 不影响构建)
                            loader: 'tsx',
                            target: 'es2020',
                        },
                    }],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.module\.less$/,
                use: [
                    { loader: 'style-loader', options: { esModule: false } },
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 1,
                            sourceMap: true,
                            esModule: false,
                            modules: { mode: 'local', localIdentName: '[local]___[hash:base64:5]' },
                        },
                    },
                    { loader: 'less-loader', options: { lessOptions: { javascriptEnabled: true } } },
                ],
            },
            {
                test: /^((?!\.module).)*less$/,
                use: [
                    { loader: 'style-loader', options: { esModule: false } },
                    {
                        loader: 'css-loader',
                        options: { importLoaders: 1, sourceMap: true, esModule: false },
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                javascriptEnabled: true,
                                modifyVars: {
                                    'kt-html-selector': 'alex-root',
                                    'kt-body-selector': 'alex-root',
                                    // opensumi 组件类名前缀 (默认 'kt', codeblitz/opensumi 模板约定)
                                    'prefix': 'kt',
                                    // opensumi motion less 缓动函数 (antd 标准, opensumi 3.6.5 next
                                    // 漏发 default-variables.less, 需手动注入)
                                    'ease-in-out': 'cubic-bezier(0.645, 0.045, 0.355, 1)',
                                    'ease-in-out-circ': 'cubic-bezier(0.78, 0.14, 0.15, 0.86)',
                                    'ease-out-circ': 'cubic-bezier(0.08, 0.82, 0.17, 1)',
                                    'ease-in-circ': 'cubic-bezier(0.6, 0.04, 0.98, 0.34)',
                                    'ease-out-quint': 'cubic-bezier(0.23, 1, 0.32, 1)',
                                    'ease-in-quint': 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
                                    'ease-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
                                    'item-active-bg': '#e6f7ff',
                                    'item-hover-bg': '#f5f5f5',
                                    'padding-xs': '8px',
                                    'menu-popup-bg': '#fff',
                                    'menu-item-active-border-width': '3px',
                                    'screen-sm-max': '576px',
                                    // 通用 antd-style 主题变量 (opensumi 漏发)
                                    'animation-duration-base': '0.2s',
                                    'animation-duration-fast': '0.1s',
                                    'animation-duration-slow': '0.3s',
                                    'border-color-split': 'rgba(0, 0, 0, 0.09)',
                                    'border-radius-base': '2px',
                                    'border-style-base': 'solid',
                                    'border-width-base': '1px',
                                    'box-shadow-base': '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                                    'checkbox-default-size': '16px',
                                    'checkbox-large-size': '18px',
                                    'code-family': 'Menlo, Monaco, Consolas, "Courier New", monospace',
                                    'component-background': '#fff',
                                    'control-padding-horizontal': '16px',
                                    'disabled-color': 'rgba(0, 0, 0, 0.25)',
                                    'font-size-base': '14px',
                                    'font-size-lg': '16px',
                                    'font-size-sm': '12px',
                                    'line-height-base': '1.5715',
                                    'link-color': '#1890ff',
                                    'link-hover-color': '#40a9ff',
                                    'link-active-color': '#096dd9',
                                    'link-decoration': 'none',
                                    'link-hover-decoration': 'underline',
                                    'menu-prefix-cls': 'kt-menu',
                                    'modal-prefix-cls': 'kt-modal',
                                    'notification-prefix-cls': 'kt-notification',
                                    'message-prefix-cls': 'kt-message',
                                    'table-prefix-cls': 'kt-table',
                                    'dropdown-prefix-cls': 'kt-dropdown',
                                    'dialog-prefix-cls': 'kt-dialog',
                                    'text-color': 'rgba(0, 0, 0, 0.85)',
                                    'text-color-secondary': 'rgba(0, 0, 0, 0.45)',
                                    'text-color-dark': 'rgba(0, 0, 0, 0.85)',
                                    'primary-color': '#1890ff',
                                    'success-color': '#52c41a',
                                    'white': '#fff',
                                    'black': '#000',
                                    'zindex-dropdown': '1050',
                                    'zindex-modal': '1000',
                                    'zindex-modal-mask': '999',
                                    'zindex-notification': '1010',
                                    'zindex-message': '1010',
                                    'zindex-popup-close': '1080',
                                    'html-selector': 'html',
                                    'body-selector': 'body',
                                    'icon-color': 'inherit',
                                    'icon-color-hover': 'inherit',
                                    'iconfont-css-prefix': 'kt-icon',
                                    'menu-item-color': 'rgba(0, 0, 0, 0.85)',
                                    'menu-item-group-title-color': 'rgba(0, 0, 0, 0.45)',
                                    'menu-item-height': '40px',
                                    'menu-item-font-size': '14px',
                                    'menu-item-vertical-margin': '4px',
                                    'menu-item-boundary-margin': '8px',
                                    'menu-collapsed-width': '80px',
                                    'menu-inline-toplevel-item-height': '40px',
                                    'menu-icon-size-lg': '18px',
                                    'menu-highlight-color': '#1890ff',
                                    'menu-item-active-bg': '#e6f7ff',
                                    'menu-icon-size': '14px',
                                    'menu-bg': '#fff',
                                    'dropdown-edge-child-vertical-padding': '4px',
                                    'dropdown-vertical-padding': '5px',
                                    'dropdown-font-size': '14px',
                                    'dropdown-line-height': '1.5715',
                                    'dropdown-selected-color': '#1890ff',
                                    'heading-color': 'rgba(0, 0, 0, 0.85)',
                                    'modal-body-padding': '24px',
                                    'modal-header-bg': '#fff',
                                    'modal-footer-bg': 'transparent',
                                    'modal-footer-border-color-split': 'rgba(0, 0, 0, 0.09)',
                                    'modal-mask-bg': 'rgba(0, 0, 0, 0.45)',
                                    'yellow-1': '#fffbe6',
                                    'message-notice-content-padding': '10px 16px',
                                    'modal-heading-color': 'rgba(0, 0, 0, 0.85)',
                                    'shadow-2': '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                                    'wave-animation-width': '6px',
                                },
                            },
                        },
                    },
                ],
            },
            {
                test: /\.(woff2?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: { name: '[name].[ext]', esModule: false, publicPath: './' },
                    },
                ],
            },
            {
                test: /\.(png|jpe?g|gif|webp|ico|svg)(\?.*)?$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            name: '[name].[ext]',
                            esModule: false,
                            fallback: { loader: 'file-loader', options: { name: '[name].[ext]', esModule: false } },
                        },
                    },
                ],
            },
            {
                test: /\.(txt|text|md)$/,
                use: 'raw-loader',
            },
        ],
    },
    plugins: [
        new html_webpack_plugin_1.default({
            template: path_1.default.resolve(WEB, 'src/index.html'),
            favicon: path_1.default.resolve(WEB, 'src/assets/favicon.ico'),
        }),
        // 纯前端: 编译期读 env var, DefinePlugin 注入为全局常量（产物无 process/node 引用）
        // 单一事实源: cli's --port 注入 process.env.APP_BASE_URL, 此处优先; .env 兜底
        new webpack_1.default.DefinePlugin({
            __APP_BASE_URL__: JSON.stringify(getEnv('APP_BASE_URL', '/')),
            // 扩展市场默认同源 /extensions: opencode fork 内置控制器 (扫 --extensions-dir vsix),
            // dev/容器一致无跨源; 运行时 --registry 注入覆盖 (外部自建市场 URL 亦可).
            __APP_REGISTRY_BASE_URL__: JSON.stringify(getEnv('REGISTRY_BASE_URL', '/extensions')),
            __APP_DEPLOY_ENV__: JSON.stringify(process.env.DEPLOY_ENV || 'development'),
        }),
        // 第三方库（opensumi/codeblitz）浏览器 fallback: 构建期 polyfill, src 本身零 node 依赖
        new node_polyfill_webpack_plugin_1.default({ includeAliases: ['process', 'Buffer'] }),
    ],
    // @ts-ignore - devServer 不在 webpack.Configuration 类型里, 但 CLI serve 模式接受
    devServer: {
        allowedHosts: 'all',
        host: '0.0.0.0',
        // 端口由 cli.js 注入 (WEB_PORT env), 兜底 7788
        port: parseInt(process.env.WEB_PORT || '7788', 10),
        historyApiFallback: { disableDotRule: true },
        hot: true,
        client: {
            overlay: { errors: true, warnings: false, runtimeErrors: false },
        },
        // 反向代理: 同源托管 opencode API (appBaseUrl='/' → 页面 origin → 这里转发到 opencode)
        proxy: [
            {
                context: [
                    '/api',
                    '/path',
                    '/pty',
                    '/global',
                    '/auth',
                    '/config',
                    '/provider',
                    '/agent',
                    '/command',
                    '/skill',
                    '/event',
                    '/export',
                    '/session',
                    '/models',
                    '/question',
                    '/permission',
                    '/message',
                    '/share',
                    '/debug',
                    '/template',
                    '/extensions',
                    '/instance',
                ],
                target: process.env.OPENCODE_PROXY_URL || 'http://127.0.0.1:24096',
                changeOrigin: true,
                ws: true,
                logLevel: 'warn',
            },
        ],
    },
};

exports.default = config;
