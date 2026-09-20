/**
 * gate/numas.ts — 前端前置: 检测/唤起本地 numas 服务端
 *
 * 前后端分离: 前端 (codeblitz) 有两种运行形态, 探测目标统一取"配置的后端基址":
 *   - CLI/内嵌模式: 由 `numas serve --web-ui` 提供 (同源) → 后端 = 页面自身 origin
 *   - 独立部署模式: 平台侧托管 site/ 产物 → 后端 = 用户本机 numas (127.0.0.1:24096)
 *
 * 链路 (2026-09-20 修正):
 *   - 探测:  GET <backend>/global/health  (no-cors, 只验可达)
 *   - 唤起:  **仅在用户显式点击时** 用隐藏 iframe fire `numas://serve`
 *            (未安装时触发 scheme 会被系统接管 → 弹「未设定用来打开URL…」,
 *            且 Chrome 对外部协议跳转要求用户手势 → 绝不自动 fire)
 *   - 引导:  未探测到 → 下载引导 (GitHub latest asset) + 「启动 Numas」+ 自动轮询
 */

import { appBaseUrl } from '../infra/url';
import { getPlatform } from '../infra/os';

export const NUMAS_PORT = 24096;
/** 唤起 scheme: 不带端口参数 — tauri 壳未收到 ?port= 时默认 24096 (packages/tauri/src/lib.rs) */
export const NUMAS_SCHEME = 'numas://serve';
/** GitHub 仓库 (桌面安装包发布源; 由 §3.2 约定: 下载走 API 匹配 latest asset, 不写死版本/文件名) */
export const NUMAS_REPO = 'weizuxiao911/numas';
/** 兜底: 直接跳 release 页面 (API 失败时用) */
export const NUMAS_RELEASES_URL = `https://github.com/${NUMAS_REPO}/releases/latest`;

/** 调试/演示: URL `?numasPort=` 可覆盖后端端口 (模拟未安装/自定义端口), 便于验证引导分支. */
function overridePort(): number | null {
  try {
    const raw = new URL(window.location.href).searchParams.get('numasPort');
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 && n < 65536 ? n : null;
  } catch {
    return null;
  }
}

/** 后端基址 (去尾 /): 调试覆盖优先; 否则 = 配置的后端 (同源模式=页面自身, 独立部署=注入的本机 numas) */
export function backendBaseUrl(): string {
  const override = overridePort();
  if (override) return `http://127.0.0.1:${override}`;
  return appBaseUrl().replace(/\/+$/, '');
}

/** 后端端口 (展示用): 默认 24096; 调试覆盖时用覆盖值 */
export const ACTIVE_PORT = overridePort() ?? NUMAS_PORT;
/** 仅调试覆盖端口时带 ?port= (让壳起在自定义端口); 默认端口无需参数 */
export const ACTIVE_SCHEME = ACTIVE_PORT === NUMAS_PORT ? NUMAS_SCHEME : `${NUMAS_SCHEME}?port=${ACTIVE_PORT}`;

/** no-cors 健康探测: 不读 body, 只验 TCP/HTTP 可达; CORS/opaque 都算 up. */
export async function pingNumas(timeoutMs = 1500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await fetch(`${backendBaseUrl()}/global/health`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** 通过隐藏 iframe 触发 numas:// scheme (浏览器无 JS API 可直启应用).
 *  ⚠️ 铁律: 仅允许在**用户显式手势**回调里调用 (如按钮 onClick).
 *  禁止在页面加载/自动流程里调用 — Chrome 对非手势的外部协议跳转会拦截并弹
 *  「未设定用来打开URL」系统框 (2026-09-20 实测; 自动唤起已从 Gate 移除). */
export function fireScheme(): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;border:0;';
    iframe.src = ACTIVE_SCHEME;
    document.body.appendChild(iframe);
    setTimeout(() => { try { iframe.remove(); } catch { /* ignore */ } }, 3000);
  } catch {
    /* 浏览器忽略 scheme 失败 */
  }
}

// ============================================================
// 下载引导: GitHub Releases API latest 按 OS/arch 匹配安装包
// ============================================================

export interface DownloadInfo {
  /** 可下载的安装包 URL (latest 对应 asset) */
  url: string;
  /** 展示名 (asset 名) */
  label: string;
  /** 版本 (latest release tag, 仅展示) */
  version: string;
  /** 当前平台是否有可用安装包 */
  available: boolean;
}

/** 当前浏览器 CPU 架构: arm64 / x64 / unknown */
function detectArch(): 'arm64' | 'x64' | 'unknown' {
  try {
    const uaData: any = (navigator as any).userAgentData;
    const a: string = typeof uaData?.architecture === 'string' ? uaData.architecture : '';
    if (/arm|aarch/i.test(a)) return 'arm64';
    if (/x86|amd|64/i.test(a)) return 'x64';
  } catch { /* ignore */ }
  const ua = navigator.userAgent;
  if (/arm|aarch64/i.test(ua)) return 'arm64';
  if (/x86_64|amd64|i386|i686|Win64|WOW64|Intel/.test(ua)) return 'x64';
  return 'unknown';
}

/**
 * 从 GitHub latest release 按 OS/arch 匹配安装包 asset 并返回下载信息.
 * 匹配表 (与 packages/tauri/scripts/release.ts 发布命名一致):
 *   mac     : numas-darwin-arm64.dmg / numas-darwin-x64.dmg
 *   windows : numas-windows-arm64.msi / numas-windows-x64.msi
 *   linux   : numas-linux-arm64.AppImage / numas-linux-x64.AppImage
 * API 失败或平台无包 → available=false, 兜底跳 release 页面.
 */
export async function resolveDownload(): Promise<DownloadInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${NUMAS_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rel: any = await res.json();
    const assets: any[] = Array.isArray(rel.assets) ? rel.assets : [];
    const names = assets.map((a) => a.name ?? '');
    const ver = typeof rel.tag_name === 'string' ? rel.tag_name : '';

    const platform = getPlatform();
    const arch = detectArch();
    // 同平台候选 asset 名: 先精确 arch, 再同平台任意 arch (release 只发单 arch 时也能命中)
    const candidates = new Set<string>();
    if (platform === 'mac') {
      if (arch === 'arm64') candidates.add('numas-darwin-arm64.dmg');
      if (arch === 'x64') candidates.add('numas-darwin-x64.dmg');
      candidates.add('numas-darwin-arm64.dmg').add('numas-darwin-x64.dmg');
    } else if (platform === 'windows') {
      if (arch === 'arm64') candidates.add('numas-windows-arm64.msi');
      if (arch === 'x64') candidates.add('numas-windows-x64.msi');
      candidates.add('numas-windows-arm64.msi').add('numas-windows-x64.msi');
    } else if (platform === 'linux') {
      if (arch === 'arm64') candidates.add('numas-linux-arm64.AppImage');
      if (arch === 'x64') candidates.add('numas-linux-x64.AppImage');
      candidates.add('numas-linux-arm64.AppImage').add('numas-linux-x64.AppImage');
    }
    const want = Array.from(candidates).find((w) => w && names.includes(w));
    if (want) {
      const asset = assets.find((a) => a.name === want);
      const url = asset?.browser_download_url || `${NUMAS_RELEASES_URL}/${want}`;
      return { url, label: want, version: ver, available: true };
    }
    // 平台无对应包: 跳 release 页让用户自选
    return { url: NUMAS_RELEASES_URL, label: 'release 页面', version: ver, available: false };
  } catch {
    return { url: NUMAS_RELEASES_URL, label: 'release 页面', version: '', available: false };
  }
}
