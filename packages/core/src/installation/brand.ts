// numas 品牌显示常量 — 仅用于**用户可见文案** (TUI/CLI/提示/弹窗等).
//
// 禁止把这里改成功能标识符: UA (`opencode/<ver>`)、provider id (`opencode`)、
// 配置路径 (`.opencode` / `opencode.json`)、Effect service 标签 (`@opencode/*`)、
// 包名 (`@opencode-ai/*`) 等都有各自语义, 不属于品牌文案, 不要引用本文件.
export const BrandName = "Numas"
/** CLI 可执行名 (与 packages/opencode/package.json 的 bin 一致). */
export const CliName = "numas"
