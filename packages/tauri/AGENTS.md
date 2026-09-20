# AGENTS.md — numas Tauri 桌面壳子工程维护规范

> 本文件是 `packages/tauri/` 子工程的**维护协议**（AI 与用户协作时遵守）,
> 与根 `AGENTS.md` 配合使用。冲突时以本文件为准（子工程更具体）。

---

## 1. 子工程定位与职责

tauri 壳把 **numas CLI（opencode fork）打包成桌面应用**, 支持:
1. `numas://` 深链唤起
2. **无 Dock、仅托盘**后台运行, 托管 numas server (`http://127.0.0.1:24096`)
3. 托盘点击 → [打开]（浏览器访问 24096）/ [退出]（停 24096 + 退出）

壳不依赖系统已安装的 numas, 二进制随包分发（sidecar）。

---

## 2. 铁律（不可违反, 违反=回归历史 bug）

### 2.1 无 Dock 必须用静态 LSUIElement, 禁止运行时切 Accessory

- ✅ `Info.plist` 静态 `<key>LSUIElement</key><true/>`
- ❌ **禁止** `app.set_activation_policy(tauri::ActivationPolicy::Accessory)`（运行时切换）
  - 原因: macOS 26 按 bundle id 记住"托盘隐藏状态", 运行时切换会被系统**持续记忆**,
    之后同 id 重装托盘不再显示 / Dock 闪现。已两次踩坑（2026-09-18 / 2026-09-20）。
- `lib.rs` 中**不得出现** `set_activation_policy` 调用

### 2.2 bundle id 固定 `com.numas.app`, 禁止随版本换 id

- ✅ `tauri.conf.json` → `"identifier": "com.numas.app"`（固定, 与微信等常规 app 一致）
- ❌ **禁止** build.ts 注入 `identifier: dev.numas.<semver>` 之类按版本换 id
  - 曾误用"每版换 id"规避记忆（`dev.numas.0.1.18`）, 治本后已弃用。
  - 正确姿势: 固定 id + LSUIElement 静态声明, 靠 `lsregister -u` 清残留（见 §2.3）。
- `scripts/build.ts` 的 configOverride **只能注入 `version`, 不注入 identifier**

### 2.3 启动时清理 LaunchServices 陈旧注册（macOS）

- `lib.rs` 保留 `cleanup_stale_registrations()`: 启动后台线程, 用 `lsregister -u`
  清掉**非当前运行 app** 的所有 numas.app 注册（继承当前, 移除旧的）。
- 覆盖所有安装方式（拖拽 / 脚本 / 手动 cp）; 失败静默, 不阻塞启动。
- [退出] 时同步执行 `cleanup_registrations_now()` 清一次。
- 手动排查残留: `lsregister -dump | grep numas`; 清理脚本见根 AGENTS.md §4.2 经验。

### 2.4 [退出] 语义 = 无条件停 24096 + 清注册 + 退出

- `stop_server` 先 kill 自己拉起的 sidecar, 再 `pkill -f "numas serve --port 24096"` 无条件停端口进程。
- [退出] 按钮: `stop_server` + `cleanup_registrations_now` + `app.exit(0)`。
- **不是**"只停自己拉起的"（那是旧语义, 已废弃）。

### 2.5 托盘交互 = 纯菜单, 禁止左键单击直接开浏览器

- 点击托盘只弹菜单 [打开] [退出]; [打开] 才开浏览器。
- ❌ 禁止 `on_tray_icon_event` 里左键单击直接 `open_when_ready`（历史行为, 已移除）。

---

## 3. 生命周期速查

| 场景 | 行为 |
|---|---|
| 双击 app | 进托盘 → 确保 server 跑 → 不开浏览器 |
| 二次双击 | 单实例转发 → 只确保 server 跑 |
| `numas://serve?port=24096` | 进托盘 → 确保 server 跑 → 不开浏览器 |
| 点击托盘图标 | 弹菜单 [打开] [退出] |
| [打开] | 确保 server + 等健康 → 浏览器访问 24096 |
| [退出] | 停 24096 进程 + 清注册 + 退出 app |
| 系统退出/关机 | `RunEvent::Exit` → `stop_server` |

server 生命周期: `port_listening(port)` 探测 → 已在跑则复用; 自己拉起存 `ServerState`, 退出 kill。

---

## 4. 版本与打包（单一事实源）

- **版本号唯一源**: 根 `version.json`（`major.minor.patch`）。
  - `version.json` 只作用于 **codeblitz / tauri 壳** 版本。
  - opencode 二进制版本**固定官方 `1.18.30`**（`packages/script/src/index.ts` 的 `NUMAS_VERSION`）,
    与 `version.json` 无关, 禁止让 version.json 影响 opencode 二进制 UA。
- **bundle id**: 固定 `com.numas.app`, 不随版本变（见 §2.2）。
- 发版流程: 改 `version.json` → `bun run build`（自动注入 version）→ `release.ts` 发布。
- asset 命名: `numas-darwin-<arch>.dmg` / `numas-windows-<arch>.msi` / `numas-linux-<arch>.AppImage`。

---

## 5. 构建 / 验证 / 安装

### 构建顺序
```bash
cd packages/opencode && bun run build --single   # 先建 numas CLI (内嵌 codeblitz)
cd packages/tauri && bun run build               # 再建壳 (prepare.ts 同步 sidecar)
```

### 打包后必验（防止静默回归）
```bash
# 1. bundle id
/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' target/release/bundle/macos/numas.app/Contents/Info.plist
#   期望: com.numas.app
# 2. LSUIElement 静态生效
/usr/libexec/PlistBuddy -c 'Print :LSUIElement' target/release/bundle/macos/numas.app/Contents/Info.plist
#   期望: true
# 3. 无 Accessory 运行时调用
grep -n 'set_activation_policy' src/lib.rs   # 期望: 无输出
# 4. 版本
/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' target/release/bundle/macos/numas.app/Contents/Info.plist
#   期望: 0.1.x (与 version.json 一致)
```

### 安装（macOS）
- 脚本: `bash scripts/install-macos.sh <numas_x.y.z_arch.dmg>`（杀旧进程→装→去 quarantine→启动）
- 拖拽: dmg 里拖 `numas.app` 到 `/Applications`, 首次启动自动清注册, 无需手动清表。
- 若 Gatekeeper 拦: `xattr -cr /Applications/numas.app` 或 系统设置→隐私与安全→仍要打开。

### 常见排查
- 托盘不显示 / Dock 闪现 → 检查 §2.1（是否误加 set_activation_policy）+ §2.2（id 是否被改）+ §2.3（注册表残留）
- 24096 端口占用 → `lsof -iTCP:24096 -sTCP:LISTEN -n -P`; `pkill -9 -f 'numas serve --port 24096'`
- 构建 404 / 端口残留 → 查残留进程（根 AGENTS.md §4.2）

---

## 6. 目录职责

```
src/main.rs          # 入口 → numas_tauri_lib::run()
src/lib.rs           # 托盘 / server 生命周期 / 深链 / LaunchServices 清理
scripts/prepare.ts   # 构建前同步 numas CLI → binaries/numas-<triple>
scripts/build.ts     # 打包 (注入 version, 不注入 identifier)
scripts/release.ts   # GitHub Release 发布
scripts/install-macos.sh
icons/tray.png       # 22px 单色模板托盘图标 (纯黑+alpha)
Info.plist           # 文件夹访问描述 + LSUIElement=true (无 Dock)
tauri.conf.json      # 壳配置 (identifier=com.numas.app, externalBin)
CHANGELOG.md         # 发版说明 (release.ts 读作 notes)
binaries/            # gitignored, prepare.ts 生成
```
