# numas (牛马 AI) 轻量组装镜像 — 无容器内编译, 本地产物直接 COPY
#
# 产物来源 (本地已构建, 与本仓库 dev 流程一致):
#   sumi web UI:  cd sumi && npm run build            → sumi/dist/        (35MB, 含 framework patch)
#   opencode:     cd opencode/packages/opencode && \
#                 NUMAS_TARGET=linux-arm64 bun run script/build.ts --skip-embed-web-ui
#                                                       → dist/opencode-linux-arm64/bin/opencode
#                 (NUMAS_TARGET 只编单平台; 产物 arch 必须与运行平台一致:
#                  docker desktop mac arm64 → linux-arm64; x86 服务器 → linux-x64)
#
# 运行 (entrypoint 拼参, env 映射见 scripts/entrypoint.sh):
#   docker run --rm -p 4096:4096 numas:latest
#   → opencode web --hostname 0.0.0.0 --port 4096 --cors '*' --web-ui /home/.numas/sumi
#   改端口: -e PORT=8080 改容器内监听, -p 映射需配套: docker run -p 8080:8080 -e PORT=8080 numas:latest
#
# 为什么轻量: 旧版多阶段在容器内 npm/bun install + build (网络依赖, 30+ 分钟/次);
# 本版只做 COPY, 迭代 UI/代码 = 本地重跑对应 build + 重构建镜像 (秒~分钟级).
# --web-ui 固定指向 /home/.numas/sumi, 替换 UI 成本有固定规则.
#
# 构建 (见 scripts/docker-build.sh):
#   bash scripts/docker-build.sh          # 本机默认 arch
#   bash scripts/docker-build.sh --platform linux/arm64|linux/amd64
#   bash scripts/docker-build.sh --push --registry gitlab.grjky.com/new-app/numas

ARG NUMAS_VERSION=0.0.0
ARG NUMAS_GIT_SHA=unknown

FROM ubuntu:24.04

ARG NUMAS_VERSION
ARG NUMAS_GIT_SHA

LABEL org.opencontainers.image.title="numas" \
      org.opencontainers.image.description="Numas (牛马 AI) — 打工人首选工作模式 (轻量组装镜像)" \
      org.opencontainers.image.version="${NUMAS_VERSION}" \
      org.opencontainers.image.revision="${NUMAS_GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/weizuxiao911/numas" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.authors="weizuxiao911" \
      maintainer="Numas <numas@local>"

ENV DEBIAN_FRONTEND=noninteractive

# HOME=/home: 工作区是 /home/community (k8s PVC 挂载点), 而 codeblitz 虚拟家目录前缀
# 也是 /home (storage 在 /home/.codeblitz). 若 HOME=/root, opencode /path 返回 home=/root,
# 前端 toHostPath 把虚拟 /home/* 映射到 /root/* → 工作区 /home/community 被错映成
# /root/community: explorer 根 stat/list 全部打到工作区外 (x-opencode-directory: /root),
# PTY 创建 cwd=/root/community 不存在 → 终端连不上. HOME=/home 后 home 锚点 = /home,
# /home/community 映射后仍是自身, 虚拟家目录 /home/.codeblitz 也自洽.
ENV HOME=/home

# 运行时依赖: 容器内跑 opencode web + 工作区开发常用工具.
#   ca-certificates/tini = 运行必需; git/curl/wget/jq/python* = 容器内工作区开发 (AI agent 常用).
#   zsh = root 默认交互 shell (oh-my-zsh), nvm + node 22 走 ~/.nvm 在 zsh 交互时自动加载.
#     sumi 前端跑浏览器, opencode binary 自含运行时 — 容器内 node 22 仅供工作区 AI agent / 用户的
#     脚本/工具链使用, 不用作 opencode 自身运行依赖.
#   apt 源: 内建阿里云镜像 (mirrors.aliyun.com/ubuntu, arm64 走 ubuntu-ports),
#   服务器/国内网络构建不直连官方源. ubuntu 24.04 用 deb822 格式
#   (/etc/apt/sources.list.d/ubuntu.sources 的 URIs: 行).
RUN sed -i \
      -e 's|http://archive.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g' \
      -e 's|http://security.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g' \
      -e 's|http://ports.ubuntu.com/ubuntu-ports/|https://mirrors.aliyun.com/ubuntu-ports/|g' \
      /etc/apt/sources.list.d/ubuntu.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates tini \
       # shell
       bash zsh \
       # 编辑器 / 监控
       vim nano htop tmux less file \
       # 网络 / 工具 (lsof: opencode 端口 scan 依赖, 缺失 → /proxy 反代 known-ports 全空)
       curl wget jq lsof netcat-openbsd \
       # 版本控制
       git \
       # python (含 pip / venv)
       python3 python3-pip python3-venv python3-dev \
       # C/C++ 编译工具 (给用户装 python 包 / 编译 native 模块)
       build-essential pkg-config \
       # sqlite: CLI 工具 + 运行时库
       sqlite3 libsqlite3-0 \
       # locales: opencode fs/list 等 node fs 读中文路径要 UTF-8 locale, 否则 readdir
       # dirent.name 字节流被 POSIX locale 当 Latin-1 截断, explorer 显示乱码
       locales \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/local/bin/python \
  # 生成 C.UTF-8 locale (镜像内不装 zh_CN.UTF-8 太重, C.UTF-8 已是 POSIX 兼容的 UTF-8 locale)
  && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
  && locale-gen \
  && update-locale LANG=C.UTF-8 \
  # git 中文: core.quotepath=false 让 git status/diff 直接显示中文文件名 (默认 true 会把
  # 非 ASCII 路径转义成八进制 "\346\226\260...", 终端/AI 看到乱码串); 显式声明 UTF-8 编码.
  # 写 $HOME=/home/.gitconfig (ENV HOME 见下), 全局对 root 的所有仓库生效.
  && git config --global core.quotepath false \
  && git config --global i18n.commitEncoding utf-8 \
  && git config --global i18n.logOutputEncoding utf-8

# 默认 UTF-8 locale: opencode fs 操作 (readdir/stat) 读中文路径正确解码, 容器内 zsh/python 也
# 默认 UTF-8 输出. C.UTF-8 是 POSIX 兼容的 UTF-8, 不依赖额外语言包.
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Python 全局依赖预装 (实验一~六依赖汇总, 用户拍板"轻量依赖 + 中科大镜像").
#   pip.conf 写 /etc/pip.conf (全局): venv / 用户级 pip 都会读, 容器内所有 pip install
#   默认走中科大镜像 (调研结论: 中科大最稳最快; 阿里云大包易超时 / 清华慢 / 官方失败).
#   --break-system-packages: ubuntu 24.04 系统 python3 是 externally-managed, 不加会被
#   PEP 668 拒绝; 装到 /usr/local/lib/python3.12/dist-packages (系统 python 可见).
#   --no-cache-dir: 不留 wheel 缓存, 保持镜像精简.
#   跳过 paddleocr (会拉 paddlepaddle, 镜像 +1~2GB), 需要时容器内自行安装.
RUN printf '[global]\nindex-url = https://pypi.mirrors.ustc.edu.cn/simple\ntrusted-host = pypi.mirrors.ustc.edu.cn\ntimeout = 120\n' > /etc/pip.conf \
  && python3 -m pip install --break-system-packages --no-cache-dir \
       flask==3.1.3 \
       flask-sock==0.7.0 \
       dashscope==1.27.4 \
       python-docx==1.2.0 \
       cryptography==50.0.1 \
       pillow==12.3.0 \
       requests==2.34.2 \
       beautifulsoup4==4.15.0 \
       pandas==2.2.3 \
       openpyxl==3.1.5 \
       pyecharts==2.0.7 \
       python-dotenv==1.2.3 \
       qrcode==8.2 \
       APScheduler \
       alibabacloud_dysmsapi20170525 \
  && python3 -c "import flask, dashscope, pandas, cryptography, pyecharts, qrcode; print('python deps ok')"

# oh-my-zsh + nvm + node 22 — 运行 uid=root 但家目录统一 $HOME=/home (见上 ENV HOME).
#   所有交互工具链都装在 /home 下, 不使用 /root:
#     oh-my-zsh → /home/.oh-my-zsh,  nvm+node 22 → /home/.nvm,  zsh 配置 → /home/.zshrc.
#   zsh 启动按 $HOME=/home 读 /home/.zshrc → 自动加载 oh-my-zsh 主题 + nvm (node/npm/npx),
#   与 codeblitz 虚拟家目录 /home/.codeblitz 同根自洽. (root 仅为运行 uid, 家目录不是 /root;
#   /etc/passwd 里 root 的 home 字段仍 /root 但 zsh 认 $HOME 环境变量, docker/PTY 都继承 ENV HOME.)
#   - nvm 仅 zsh 交互自动加载 (官方设计); 非交互 sh/python 子进程需脚本开头 source nvm.sh.
#   - oh-my-zsh/nvm 走 gitee 镜像, node 二进制走 npmmirror (国内网).
#   - python 3.12 走 apt 全局 (上方 line 69), 不受家目录影响.
ENV NVM_DIR=/home/.nvm
RUN mkdir -p /home \
  && git clone --depth=1 https://gitee.com/mirrors/ohmyzsh.git /home/.oh-my-zsh \
  && cp /home/.oh-my-zsh/templates/zshrc.zsh-template /home/.zshrc \
  && printf '\n# nvm auto-load (zsh)\nexport NVM_DIR="/home/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\n[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"\n' >> /home/.zshrc \
  # nvm 国内源: gitee 镜像 git clone; node 二进制走 npmmirror (NVM_NODEJS_ORG_MIRROR,
  # 临时 export 限本 RUN — 不持久到镜像 ENV, 避免污染运行时). PROFILE=/dev/null 跳过 nvm 写 profile.
  && export PROFILE=/dev/null \
  && git clone --depth=1 https://gitee.com/mirrors/nvm.git "$NVM_DIR" \
  && /bin/zsh -c 'export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node && . "$NVM_DIR/nvm.sh" && nvm install 22 && nvm alias default 22 && nvm use default' \
  && chsh -s /bin/zsh root \
  && /bin/zsh -ic 'node --version && npm --version'

# 按用户拍板: 容器内直接以 root 运行 (ubuntu:24.04 预置 uid 1000 的 ubuntu 用户,
# 与自建服务用户冲突, 不再 useradd)
USER root

# 容器内工作区根 = /home/community (workdir + 默认工作区根, explorer 只见用户文件);
# 程序目录 ~/.numas 与 HOME=/home 对齐 (root → /home/.numas, 不进工作区) — 挂载点
# (设计文档 docs/Docker产物目录挂载点与扩展注册功能设计与测试用例.md):
#   exec/        opencode 可执行程序 (含内置 /extensions 扩展市场控制器)
#   ui/          sumi web 静态产物 (entrypoint 默认 --web-ui /home/.numas/ui)
#   extensions/  vsix 扩展包集合 (--extensions-dir 指向, opencode 内置市场扫描; 与工程
#                registry/vsix 同构, 动态识别新增 .vsix)
# 每目录镜像内置默认产物 (交付即用), 运维可 -v volume 覆盖任一目录升级, 不重建镜像.
# 注: 扩展市场由 opencode fork 内置 (/extensions 同源端点), 无独立 registry 进程.
# 注: /home/.numas/ 是路径统一后的最终位置 (2026-09 全量迁移 /root → /home, 与 HOME=/home
#   一致; 历史镜像若用 /root/.numas/ 路径, --volume 挂载会找不到, 重新部署即可).
WORKDIR /home/community
RUN mkdir -p /home/.numas/exec /home/.numas/ui /home/.numas/extensions

# ① exec: opencode 单二进制 — arch 由构建脚本显式传入 (docker-build.sh 传 OPENCODE_ARTIFACT,
#   与 --platform 一一对应: linux/arm64→opencode-linux-arm64, linux/amd64→opencode-linux-x64).
#   禁止用 glob (dist 里可能同时存在多平台产物, 会 COPY 冲突/装错 arch). 构建期 --version
#   冒烟即验证 arch 匹配 (exec format error 会在此暴露).
ARG OPENCODE_ARTIFACT=opencode-linux-arm64
COPY opencode/packages/opencode/dist/${OPENCODE_ARTIFACT}/bin/opencode /home/.numas/exec/opencode
# ② ui: sumi web 静态产物
COPY sumi/dist /home/.numas/ui/
# ③ extensions: 镜像内置空目录 (vsix 不进镜像, 用户拍板 2026-09); 扩展运行时 -v 挂载
#    vsix 目录到 /home/.numas/extensions/ (opencode --extensions-dir 扫描, 空目录返回空正常)

COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && chmod +x /home/.numas/exec/opencode \
  && /home/.numas/exec/opencode --version

# 端口/host/registry 默认值 (entrypoint 可见的镜像默认; 用户可用短名 env 覆盖, 如
# -e PORT=8080 替换默认 4096 — entrypoint 读值规则: 短名优先, 长名兜底, 再默认)
ENV NUMAS_HOST=0.0.0.0
ENV NUMAS_PORT=4096
ENV NUMAS_REGISTRY=https://gateway.cloudlab.top/api/v2/agent-registry/plugins

EXPOSE 4096

# ENTRYPOINT 启 entrypoint (cd 工作目录 + 拼参 exec opencode); CMD 留空用 env 配参
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD []
