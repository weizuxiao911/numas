#!/usr/bin/env bash
set -euo pipefail

APP_NAME="numas.app"
DEST="/Applications/${APP_NAME}"
DMG="${1:-}"

if [[ -z "${DMG}" ]]; then
  for dir in "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" "${PWD}" "${HOME}/Downloads"; do
    candidate="$(ls -t "${dir}"/numas_*.dmg 2>/dev/null | head -1 || true)"
    if [[ -n "${candidate}" ]]; then
      DMG="${candidate}"
      break
    fi
  done
fi

if [[ -z "${DMG}" || ! -f "${DMG}" ]]; then
  echo "用法: bash install-macos.sh <numas_x.y.z_arch.dmg>" >&2
  exit 1
fi

echo "[numas] 安装包: ${DMG}"

pkill -f "numas-tauri" 2>/dev/null || true
pkill -f "MacOS/numas serve" 2>/dev/null || true
sleep 1

MOUNT_POINT="$(hdiutil attach -nobrowse -readonly "${DMG}" | grep -o '/Volumes/.*' | head -1)"
if [[ -z "${MOUNT_POINT}" ]]; then
  echo "[numas] 挂载失败" >&2
  exit 1
fi

cleanup() {
  hdiutil detach "${MOUNT_POINT}" -quiet 2>/dev/null || true
}
trap cleanup EXIT

if [[ ! -d "${MOUNT_POINT}/${APP_NAME}" ]]; then
  echo "[numas] 安装包内未找到 ${APP_NAME}" >&2
  exit 1
fi

rm -rf "${DEST}"
ditto "${MOUNT_POINT}/${APP_NAME}" "${DEST}"
xattr -cr "${DEST}"

echo "[numas] 已安装: ${DEST}"
open "${DEST}"
