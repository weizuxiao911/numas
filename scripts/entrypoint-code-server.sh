#!/bin/bash
# vscode + opencode 组合镜像 entrypoint
#
# 由 scripts/Dockerfile.code-server ENTRYPOINT exec form 调用:
#   /usr/bin/tini -- /usr/local/bin/entrypoint.sh [args]
#
# 进程模型: 单进程 code-server; opencode 不跑常驻 serve, 由容器内 sst-dev.opencode
# VSCode 扩展在用户点击时拉起 `opencode --port <rand>` TUI 终端.
#
# env 配置 (短名优先, 长名兜底, 再默认):
#   CODE_SERVER_PORT → code-server 监听端口 (默认 8080)
#   WORKDIR          → 工作区 cwd          (默认 /home/community)

set -eu

CODE_PORT="${CODE_SERVER_PORT:-8080}"
WORKDIR_VAL="${WORKDIR:-/home/community}"

cd "$WORKDIR_VAL" || { echo "[entrypoint] cannot cd to $WORKDIR_VAL" >&2; exit 1; }

# nvm 环境 (opencode CLI 装在 nvm node 22 下); code-server 终端继承 env 让用户
# 在容器内 zsh/bash 里可直接 which opencode. entrypoint 是 bash 非交互, source nvm.sh.
export NVM_DIR=/home/.nvm
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "[entrypoint] workdir=$WORKDIR_VAL"
echo "[entrypoint] code-server → 0.0.0.0:$CODE_PORT"

# exec 让 code-server 成为 PID 1 子进程, tini 直接管理信号
exec code-server --bind-addr "0.0.0.0:$CODE_PORT" "$WORKDIR_VAL"
