/**
 * gate/numas.ts — test/ide 前置: 检测/唤起本地 numas 服务端
 *
 * 工作台 (:7788) 是纯 web, 前后端分离: 后端 = 用户本地的 numas 应用
 * (tauri 壳, 注册 numas:// scheme, 内嵌 numas serve). 页面加载必须先
 * 确认本地 numas 可达, 否则无法访问任何 API.
 *
 * 链路:
 *   - 探测:  GET http://127.0.0.1:24096/global/health  (no-cors, 只验可达)
 *   - 唤起:  iframe 触发 numas://serve?port=24096 (浏览器无 JS 直启进程能力,
 *            只能靠 scheme handler; 成功与否浏览器不暴露, 靠后续轮询推断)
 *   - 引导:  未探测到 → 展示下载/安装引导 + 「重试」按钮
 */

export const NUMAS_PORT = 24096;
export const NUMAS_SCHEME = `numas://serve?port=${NUMAS_PORT}`;
/** 健康探测端点 (绝对地址直连本地 numas; CORS 由 no-cors 规避) */
export const NUMAS_HEALTH = `http://127.0.0.1:${NUMAS_PORT}/global/health`;
/** GitHub 仓库 (桌面安装包发布源; 由 §3.2 约定: 下载走 API 匹配 latest asset, 不写死版本/文件名) */
export const NUMAS_REPO = 'weizuxiao911/numas';
/** 兜底: 直接跳 release 页面 (API 失败时用) */
export const NUMAS_RELEASES_URL = `https://github.com/${NUMAS_REPO}/releases/latest`;

import { getPlatform } from '../infra/os';

/** 调试/演示: URL `?numasPort=` 可覆盖探测端口 (模拟未安装/自定义端口), 便于验证引导分支. */
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
const _port = overridePort() ?? NUMAS_PORT;
export const ACTIVE_PORT = _port;
export const ACTIVE_SCHEME = `numas://serve?port=${_port}`;
export const ACTIVE_HEALTH = `http://127.0.0.1:${_port}/global/health`;

export type NumasGateState =
  | { status: 'checking' }
  | { status: 'connecting' }
  | { status: 'ready' }
  | { status: 'install'; reason: 'timeout' | 'unreachable' };

/** no-cors 健康探测: 不读 body, 只验 TCP/HTTP 可达; CORS/opaque 都算 up. */
export async function pingNumas(timeoutMs = 1500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await fetch(ACTIVE_HEALTH, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** 通过隐藏 iframe 触发 numas:// scheme (浏览器无 JS API 可直启应用). */
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

export interface NumasProbeResult {
  ok: boolean;
  /** 触发 scheme 唤醒前是否已在线 (直接进入 ready, 不弹引导) */
  wasUp: boolean;
}

/** 轮询等待本地 numas 上线; 返回最终可达结果.
 *  @param maxAttempts 轮询次数 (含首次探测)
 *  @param intervalMs  轮询间隔 */
export async function pollNumas(maxAttempts = 12, intervalMs = 500): Promise<NumasProbeResult> {
  let up = await pingNumas();
  if (up) return { ok: true, wasUp: true };
  fireScheme();
  for (let i = 1; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    up = await pingNumas();
    if (up) return { ok: true, wasUp: false };
  }
  return { ok: false, wasUp: false };
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
