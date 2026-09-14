#!/bin/bash
# numas code-server + opencode 双进程 entrypoint
#
# 由 scripts/Dockerfile.code-server ENTRYPOINT exec form 调用:
#   /usr/bin/tini -- /usr/local/bin/entrypoint.sh [args]
#
# 进程模型:
#   - code-server: 主进程 (PID 1 子), 监听 0.0.0.0:8080, 对外唯一入口
#   - opencode:    后台进程, 监听 127.0.0.1:4096, 只对容器内 code-server 扩展/终端可见
#   - tini:        PID 1, 回收僵尸; code-server 退出时 entrypoint 收到信号收尾
#
# env 配置 (短名优先, 长名兜底, 再默认):
#   CODE_SERVER_PORT / NUMAS_CODE_SERVER_PORT → code-server 监听端口 (默认 8080)
#   OPENCODE_PORT    / NUMAS_OPENCODE_PORT    → opencode 监听端口   (默认 4096)
#   WORKDIR          / NUMAS_WORKDIR          → 双进程 cwd          (默认 /home/community)
#   OPENCODE_ARGS                             → opencode 额外参数    (默认空)

set -eu

v() {
  if [ -n "$2" ]; then
    short_val=$(eval "printf '%s' \"\${$2:-}\"")
    if [ -n "$short_val" ]; then printf '%s' "$short_val"; return; fi
  fi
  long_val=$(eval "printf '%s' \"\${$1:-}\"")
  if [ -n "$long_val" ]; then printf '%s' "$long_val"; return; fi
  printf '%s' "$3"
}

CODE_PORT=$(v NUMAS_CODE_SERVER_PORT CODE_SERVER_PORT 8080)
OPENCODE_PORT=$(v NUMAS_OPENCODE_PORT OPENCODE_PORT 4096)
WORKDIR_VAL=$(v NUMAS_WORKDIR WORKDIR /home/community)
OPENCODE_EXTRA_ARGS="${OPENCODE_ARGS:-}"

cd "$WORKDIR_VAL" || { echo "[numas] cannot cd to $WORKDIR_VAL" >&2; exit 1; }

# 需要 nvm 环境跑 opencode (npm i -g opencode-ai 装在 nvm node 22 下)
# entrypoint 是 bash 非交互, 需手动 source nvm.sh
export NVM_DIR=/home/.nvm
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "[numas] workdir=$WORKDIR_VAL"
echo "[numas] code-server → 0.0.0.0:$CODE_PORT (对外)"
echo "[numas] opencode    → 127.0.0.1:$OPENCODE_PORT (容器内)"

# 后台拉 opencode serve (headless, 只绑回环)
# shellcheck disable=SC2086
opencode serve --hostname 127.0.0.1 --port "$OPENCODE_PORT" $OPENCODE_EXTRA_ARGS &
OPENCODE_PID=$!

# 主进程退出时连带杀掉 opencode
cleanup() {
  echo "[numas] shutting down (opencode pid=$OPENCODE_PID)"
  kill -TERM "$OPENCODE_PID" 2>/dev/null || true
  wait "$OPENCODE_PID" 2>/dev/null || true
}
trap cleanup TERM INT EXIT

# 前台跑 code-server (exec 让 tini 直接管理; 但 trap 已经挂上, 用 wait 等退出)
code-server --bind-addr "0.0.0.0:$CODE_PORT" "$WORKDIR_VAL" &
CODE_PID=$!

# 任一进程退出即收尾
wait -n "$OPENCODE_PID" "$CODE_PID" || true
echo "[numas] one of the processes exited, cleaning up"
