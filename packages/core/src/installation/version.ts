declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENCODE_APP_VERSION: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
/** numas 应用版本 (packages/tauri/version.json, 构建注入); 空 = 非 numas 构建. 升级判断用 (与 UA 的 InstallationVersion 分离). */
export const InstallationAppVersion = typeof OPENCODE_APP_VERSION === "string" ? OPENCODE_APP_VERSION : ""
