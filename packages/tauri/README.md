# numas desktop shell (Tauri)

最小化后台运行的 numas 桌面壳：托盘常驻，托管随包的 numas server（`http://127.0.0.1:24096`），
浏览器作为 UI，支持 `numas://serve?port=24096` scheme 唤起。

## 行为

- 无 Dock（Accessory），只有菜单栏单色托盘图标
- 双击启动：进托盘 → 启动 numas server → 等健康就绪后打开系统浏览器 `http://127.0.0.1:24096`
- `numas://serve?port=<port>`：进托盘并确保 server 在跑，不打开浏览器（触发页自行轮询健康）
- 托盘「打开」：打开浏览器；托盘「退出」：结束壳进程并停止自己拉起的 numas server
- 只停自己拉起的 server；若 24096 上已有服务（例如手动 `numas serve`），退出时不碰它

## 本地构建

先构建当前平台的 numas CLI（内嵌 codeblitz）：

```bash
cd packages/opencode
bun run build --single
```

再构建壳（自动把二进制同步到 `binaries/numas-<target-triple>`）：

```bash
cd packages/tauri
bun run build                 # 当前平台
bun run build:arm64           # macOS arm64
bun run build:x64             # macOS x64（需先 rustup target add x86_64-apple-darwin）
bun run build:universal       # macOS universal（需两个架构的 numas 二进制）
```

跨架构时先用 `NUMAS_TARGET` 交叉构建对应二进制，例如：

```bash
cd packages/opencode
NUMAS_WEB_DIST=../codeblitz/dist NUMAS_TARGET=darwin-x64 bun run script/build.ts
```

产物在 `packages/tauri/target/release/bundle/`（macOS: dmg/app，Windows: nsis，Linux: appimage/deb/rpm）。

开发调试：

```bash
cd packages/tauri
bun run dev
```

## 同事安装（macOS，无开发者账号）

把 dmg 和 `scripts/install-macos.sh` 一起发给同事，运行：

```bash
bash install-macos.sh numas_0.1.17_aarch64.dmg
```

脚本会自动替换安装到 `/Applications`、去除 quarantine 并启动。手动方式：拖入 `/Applications` 后执行 `xattr -cr /Applications/numas.app`，或首次打开时到 系统设置 → 隐私与安全性 → 「仍要打开」。

## macOS 签名 + 公证

无凭据时构建会自动 ad-hoc 整包签名（仅本机可用；分发到别的机器会被 Gatekeeper 拦）。对外分发需要 Developer ID：

1. 安装 `Developer ID Application` 证书到登录钥匙串
2. `cp .env.example .env.local`，填入证书名与公证凭据（Bun 自动加载 `.env.local`）
3. `bun run build` → 自动签名 + 公证 + staple

凭据只放 `.env.local`（已 gitignore），不入库。

## 说明

- 全平台打包靠本机构建（macOS/Windows/Linux × x64/arm64），不使用 CI
- `icons/` 为 🐮 占位图标（`bunx @tauri-apps/cli icon <1024.png>` 生成），可随时替换
- 壳不依赖系统已安装的 numas，二进制随包分发
