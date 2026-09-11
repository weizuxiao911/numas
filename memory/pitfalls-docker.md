## 避坑指南 — Docker 构建 / 镜像源 / 产物 / 运行时

#### 11. 代码/patch 改了但运行镜像没重建 → "改了没修复"假象

- **问题描述**: sumi postinstall patch (storage 路径) 与 Dockerfile 已改, 但容器内 binary 仍是旧产物 (marker 为 0), 用户验证仍失败, 误判方案无效.
- **复现路径**: 改 Dockerfile/package.json/patch 后直接跑旧镜像验证.
- **解决方案**: 验证前先确认"运行中产物"确实含改动: docker 镜像用 `docker exec strings /home/.numas/exec/opencode | grep marker`; 本地 dist 用 grep marker; 交叉/重编产物看构建时间戳. 先对产物版本, 再谈方案对错.

#### 12. 改完源码忘了重编产物就验证 → 旧产物报错误导排查

- **问题描述**: 修 opencode 注入链后直接起旧 binary 验证, 反复报 `provideService is not a function`, 误以为修复方向错.
- **复现路径**: 源码改动后, 运行验证用的 binary/dist 是改动前构建的.
- **解决方案**: 改服务端/前端源码后, 验证前必须重新构建对应产物 (记录构建时间/日志尾部 smoke 通过), 或先 `git log`/时间戳确认产物新于源码改动.

#### 14. ubuntu 镜像预置 uid 1000 用户, useradd 撞 UID

- **问题描述**: Dockerfile `useradd --uid 1000` 在 debian:12-slim 正常, 换 ubuntu:24.04 后 exit 4 "UID 1000 is not unique" (官方镜像预置 ubuntu 用户 uid 1000).
- **复现路径**: 基础镜像 debian → ubuntu 后不检查预置用户直接构建.
- **解决方案**: 换 base 镜像先核对预置用户/包差异 (apt 包可用性实测一次通过); 本项目按用户拍板直接 USER root, 不自建服务用户.

#### 15. 镜像层 ENV 默认值抢占用户 `-e` 覆盖 → "改端口没生效"

- **问题描述**: Dockerfile `ENV NUMAS_PORT=4096` + entrypoint 优先读长名 NUMAS_PORT → `docker run -e PORT=8080` 永远 4096.
- **复现路径**: 镜像留默认 ENV, entrypoint 长名优先.
- **解决方案**: 约定"短名 env (-e PORT) 是用户替换镜像默认的主通道": 读值顺序 短名 → 长名 → 内置默认 (entrypoint v() 已实现); `-e PORT` 与 `-p` 映射必须配套 (8080:8080), 提示文案写明.

#### 16. fork flag 传了但没人消费 → 前端永远用编译期默认 (dev 碰巧掩盖)

- **问题描述**: opencode `--registry` 参数从未 provide 到 UI 注入层 (RegistryConfig 无 provide 点), 前端 registryBaseUrl 恒为 sumi webpack 编译期默认 `http://127.0.0.1:7790`; dev 时浏览器本机恰好跑着 registry 所以"碰巧工作", 容器部署语义反转 (浏览器侧 127.0.0.1 是用户电脑) 才暴露.
- **复现路径**: 注入链无 provide; 验证只看"功能正常"没查运行时注入值.
- **解决方案**: 验证"配置/注入链"要看运行时实际值 (页面 evaluate `window.__APP_CONFIG__.registryBaseUrl`), 不能只凭功能 OK; 容器场景 registry 必须经同源反代 (--registry /proxy/7790), 启动方显式传参, 不写死编译期.

#### 18. 容器缺 lsof → opencode 端口 scan 全空 → /proxy 反代 404 (非竞态)

- **问题描述**: fork 的 /proxy 只代理 "known ports" (scan + whitelist); 容器精简镜像没装 lsof → scan `listenCands=0` → /proxy/7790 永远 404. 排查时先看到页面 500ms 请求失败, 误判为 scan 3s 窗口竞态.
- **复现路径**: 容器内起服务 (绑 0.0.0.0) 后经 /proxy/<port> 访问持续 404; docker logs 里 `[ports] scan: listenCands=0`.
- **解决方案**: 看 scan 日志区分竞态 (listenCands>0 但尚未收录) vs 工具缺失 (listenCands=0); 容器镜像 apt 装 lsof (scan POSIX 用 lsof). 后续架构已绕开该链: 扩展市场改 opencode 内置 /extensions 同源端点, 无端口反代依赖.

#### 22. ENV HOME=/home 但交互工具链 (nvm/oh-my-zsh) 装在 /root → zsh 终端 node 缺失、主题不加载

- **问题描述**: 容器内 root (uid 0) 运行, Dockerfile `ENV HOME=/home` (codeblitz 虚拟家目录 `/home/.codeblitz` 自洽需要, 见 Dockerfile:44-50); 但 oh-my-zsh 装 `/root/.oh-my-zsh`、nvm 装 `/root/.nvm`、auto-load 写 `/root/.zshrc`. zsh 启动按 `$HOME=/home` 读 `/home/.zshrc` (不存在) → **nvm 不加载 (node/npm command not found)、oh-my-zsh 主题不加载 (提示符裸 `容器ID#`)**. python/git 走 apt 全局 `/usr/bin` 不受影响.
- **复现路径**: `docker exec <c> bash -lc 'which node'` → 空 (bash 不读 zshrc); `docker exec <c> zsh -lic 'node --version'` → command not found; 但 `zsh -ic 'source /root/.nvm/nvm.sh; node --version'` 手动 source 后正常 → 锁定加载位置错配, 非 node 未装.
- **解决方案 (用户拍板「家目录统一 /home, 不使用 /root」)**: 所有**交互工具链**装到 `$HOME=/home` 下: oh-my-zsh → `/home/.oh-my-zsh`, nvm+node 22 → `/home/.nvm` (`ENV NVM_DIR=/home/.nvm`), 配置 → `/home/.zshrc`; 验证 `zsh -ic 'node --version; echo $ZSH_THEME'`.
  - **注**: 程序目录 `/home/.numas` (opencode binary/ui/extensions) 与 `HOME=/home` 对齐 (2026-09 全量迁移 /root → /home, 见 Dockerfile 注释), entrypoint 默认 `--web-ui /home/.numas/ui`; 与工作区根 `/home/community` 同前缀, 不再分两个 root.
- **排查方法**: 容器内 `echo $HOME` + `ls $HOME/.zshrc $HOME/.nvm` 确认工具链是否在 $HOME 下; `zsh -lic '...'` 测 login+interactive (numas PTY 实际是 `zsh --login -i`); oh-my-zsh 是否加载看 `$ZSH` 变量非空 / `$ZSH_THEME`.
- **附加 (终端慢/卡 spinner 误判)**: zsh login 实测仅 ~0.45s (`time zsh -ic 'node --version'`), nvm/ohmyzsh 不是瓶颈; 终端面板卡 spinner 真因常是 **codeblitz workbench storage 初始化失败** (`/api/fs/mkdir` 500) 拖住整个工作台模块加载, 与 shell 速度无关. 验证终端先确认 mkdir 204/200 + explorer 树已渲染, 再测 shell.

#### 58. ubuntu:24.04 基础镜像未预装 ca-certificates → `https://` apt 源证书校验失败 → 所有包 "Unable to locate package"

- **现象**: Dockerfile `apt-get update` 后 `apt-get install` 全报 `E: Unable to locate package <pkg>`, build exit 100; update 无 Err 行但 `W: ... No system certificates available. Try installing ca-certificates.` + `W: Failed to fetch ... Certificate verification failed: The certificate is NOT trusted.`
- **根因**: 基础镜像**没有预装 ca-certificates**, 任何 `https://` apt 源 (如 `https://mirrors.aliyun.com/ubuntu/`) 在握手阶段证书校验直接失败 → 包索引没拉下来 → 包列表空. 原始 Dockerfile 用官方默认 `http://archive.ubuntu.com/ubuntu/` 所以从未暴露.
- **复现**: `docker run --rm ubuntu:24.04` 里 sed 换 https 源 → `apt-get update` 包列表为空; `apt-cache policy python3` 无输出.
- **解决方案**: 镜像内 apt 源**必须用 `http://`** (`http://mirrors.aliyun.com/ubuntu/`, arm64 走 `http://mirrors.aliyun.com/ubuntu-ports/`), 与官方默认 http 行为一致; 阿里云 http 实测 200. 别用 https 源 + `Acquire::https::Verify-Peer=false` (明文信任所有源, 安全性差).
- **排查方法**: ① build 报 "Unable to locate package" 先看 update 输出有没有 "No system certificates available" / "Certificate verification failed"; ② 注意代理 MITM 会伪装成证书问题 (IP 198.18.0.170 等), 先关代理再复现; ③ sed 目标是 deb822 文件 `/etc/apt/sources.list.d/ubuntu.sources` 的 `URIs:` 行, 不是旧式 `/etc/apt/sources.list` (24.04 已废弃).

#### 59. pip 镜像源 USTC/清华对部分 wheel 返 403 (pyecharts 2.0.7), 阿里云可下

- **现象**: `pip install pyecharts==2.0.7` 从 `pypi.mirrors.ustc.edu.cn` (重定向 `pypi.tuna.tsinghua.edu.cn`) 下载 wheel 报 `HTTP error 403 Client Error: Forbidden`; 前 11 个依赖 (flask/dashscope/pandas...) 都正常.
- **根因**: 镜像源对特定文件的访问权限/同步问题 (该 wheel 在 USTC 403、清华 403, 阿里云 200). docx 调研"中科大最稳最快"是当时整包测速结论, 不代表所有文件无问题.
- **复现**: `curl -I https://mirrors.ustc.edu.cn/pypi/packages/<hash>/pyecharts-2.0.7-py3-none-any.whl` → 403; 阿里云同路径 → 200.
- **解决方案**: pip.conf 主源换阿里云 `https://mirrors.aliyun.com/pypi/simple` (实测 pyecharts whl 200, 全量 12 依赖安装+import 通过). 大包偶发超时用 `timeout = 120` 兜底.
- **排查方法**: ① 装到某个包 403/失败时, 用 `curl -I <wheel 完整 URL>` 直接验证该文件的 3 个镜像 (USTC/清华/阿里云) 返回码, 别整体换源再全量重试; ② 改源后先在独立容器验证完整依赖清单再 build.
