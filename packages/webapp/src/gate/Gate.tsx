import React, { useEffect, useRef, useState } from 'react';
import { ACTIVE_PORT, NUMAS_RELEASES_URL, backendBaseUrl, fireScheme, pingNumas, resolveDownload, type DownloadInfo } from './numas';
import './gate.css';

interface GateProps {
  /** 就绪后渲染 (通常为 App). */
  children: React.ReactNode;
}

type Phase = 'checking' | 'waking' | 'install' | 'ready';

/** 读应用当前主题 id (opensumi 偏好持久化): workbench.colorTheme 优先, 兜底 general.theme. */
function storedThemeId(): string {
  try {
    let fallback = '';
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.endsWith(':workbench.colorTheme')) return window.localStorage.getItem(key) || '';
      if (key.endsWith(':general.theme')) fallback = window.localStorage.getItem(key) || '';
    }
    return fallback;
  } catch {
    return '';
  }
}

/** gate 配色跟随应用主题 (缺省 light, 与应用默认 opensumi-design-light-theme 一致). */
function gateTheme(): 'light' | 'dark' {
  return /dark/i.test(storedThemeId()) ? 'dark' : 'light';
}

/**
 * 前置 numas 接入门控 (2026-09-22 修正 v4):
 *   前后端分离: CLI/内嵌模式后端=页面自身 (同源, 秒过); 独立部署模式后端=本机 numas.
 *   流程 (自动唤起, 零弹窗, 用户不做选择):
 *   1. 进入 → 探测端口 (24096)。在线 → 直接接入。
 *   2. 不在线 → **自动 fire numas:// 一次** (已安装则拉起 app → 轮询接入;
 *      未安装/无注册则系统静默失败, 不弹窗 — 2026-09-22 实测: 无 scheme 注册时 fire 静默).
 *   3. 唤起后轮询仍无响应 → 显示下载引导 (主按钮=下载安装包).
 *      引导页持续自动轮询 → 用户装好/启动后自动接入, 无需任何点击重试.
 *   4. 配色按应用主题 (light/dark) 适配 — 见 gate.css 两套 token。
 */
export function Gate({ children }: GateProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [dot, setDot] = useState<'wait' | 'up' | 'down'>('wait');
  const [status, setStatus] = useState('检测本地 numas 服务…');
  const [download, setDownload] = useState<DownloadInfo | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void check();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 引导期间自动轮询: 用户装好/启动 numas 后自动接入 (只探测, 不触发 scheme)
  useEffect(() => {
    if (phase !== 'install') return;
    const timer = window.setInterval(async () => {
      if (!(await pingNumas(1200))) return;
      if (!mounted.current) return;
      setDot('up');
      setStatus(`已连接本地 numas — ${backendBaseUrl()}/global/health`);
      setPhase('ready');
    }, 3000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // 首次用户交互补 fire: Chrome 要求外部协议跳转需**用户手势**, 页面加载自动 fire 会被
  // 静默拦截 ("Not allowed to launch ... a user gesture is required"). 用户一旦有点击/按键
  // (几乎必然发生), 补一次 fire 即可唤起已安装的 numas; 未安装则静默失败 (无弹窗).
  // 对用户无感 (不是按钮), 覆盖 Chrome 的手势限制.
  // ⚠️ 整页生命周期最多补 fire 一次 (interactedFire ref 跨 phase 持久):
  //   反复 fire 会在浏览器已"始终允许"该 scheme 时反复触发系统启动 → 反复弹框.
  const interactedFire = useRef(false);
  useEffect(() => {
    if (phase === 'ready') return;
    const onInteract = () => {
      if (interactedFire.current) return;
      interactedFire.current = true;
      fireScheme();
    };
    window.addEventListener('pointerdown', onInteract, { once: true });
    window.addEventListener('keydown', onInteract, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, [phase]);

  /**
   * 进入检测: 在线 → 直接接入; 不在线 → 自动 fire numas:// 唤起一次并轮询等待;
   * 唤起超时仍无响应 → 显示下载引导 (引导页持续自动轮询, 装好自动接入).
   * 无 scheme 注册时 fire 静默失败, 不弹系统框 (2026-09-22 实测).
   */
  async function check() {
    setPhase('checking');
    setDot('wait');
    setStatus('检测本地 numas 服务…');
    const up = await pingNumas();
    if (!mounted.current) return;
    if (up) {
      setDot('up');
      setStatus(`已连接本地 numas — ${backendBaseUrl()}/global/health`);
      setPhase('ready');
      return;
    }

    // 未在线 → 自动唤起一次 (已安装则应用被拉起), 轮询等待接入
    setPhase('waking');
    setDot('wait');
    setStatus('正在唤起本地 numas 应用…');
    fireScheme();
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (!mounted.current) return;
      if (await pingNumas(1200)) {
        setDot('up');
        setStatus(`已连接本地 numas — ${backendBaseUrl()}/global/health`);
        setPhase('ready');
        return;
      }
    }
    if (!mounted.current) return;

    // 唤起后仍无响应 → 未安装 → 下载引导 (自动轮询, 装好自动接入)
    setDot('down');
    setStatus('未检测到 numas 应用, 请下载安装');
    setPhase('install');
    void resolveDownload().then((d) => { if (mounted.current) setDownload(d); });
  }

  if (phase === 'ready') {
    return <>{children}</>;
  }

  const theme = gateTheme();

  return (
    <div className={`gate gate--${theme}`}>
      <div className="gate__card">
        <div className="gate__logo" aria-hidden>
          🐮
        </div>
        <h1 className="gate__title">Numas 本地工作台</h1>
        <p className="gate__desc">
          工作台需要接入你本地的 numas 应用作为服务端 (端口 {ACTIVE_PORT}), 才能读取代码与执行 AI 任务。
        </p>

        <div className="gate__status">
          <span className={`gate__dot ${dot}`} />
          <span>{status}</span>
        </div>

        {phase === 'install' && (
          <div className="gate__install">
            <p className="gate__install-tip">
              未检测到 numas 应用。请下载安装包, 安装完成后本页将自动接入, 无需其他操作。
            </p>
            <div className="gate__actions">
              {download?.available ? (
                <a className="gate__btn gate__btn--primary" href={download.url} target="_blank" rel="noreferrer">
                  下载安装包 ({download.label})
                </a>
              ) : (
                <a className="gate__btn gate__btn--primary" href={NUMAS_RELEASES_URL} target="_blank" rel="noreferrer">
                  前往下载页
                </a>
              )}
            </div>
            {download && !download.available && (
              <p className="gate__install-tip" style={{ marginTop: 10, fontSize: 12 }}>
                当前平台暂未提供安装包, 可前往 release 页手动选择。
              </p>
            )}
            <p className="gate__install-tip" style={{ marginTop: 10, fontSize: 12 }}>
              正在自动检测… 安装并启动后, 本页将自动连接本地 numas。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
