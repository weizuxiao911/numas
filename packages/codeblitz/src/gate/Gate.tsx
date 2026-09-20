import React, { useEffect, useRef, useState } from 'react';
import { ACTIVE_PORT, ACTIVE_SCHEME, NUMAS_RELEASES_URL, backendBaseUrl, fireScheme, pingNumas, resolveDownload, type DownloadInfo } from './numas';
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
 * 前置 numas 接入门控 (2026-09-20 修正):
 *   前后端分离: CLI/内嵌模式后端=页面自身 (同源, 秒过); 独立部署模式后端=本机 numas.
 *   1. 进入 → 只做端口探测, 绝不自动 fire scheme (未安装时触发 scheme 会弹
 *      系统「未设定用来打开URL…」, 且 Chrome 对外部协议跳转要求用户手势)
 *   2. 探测不通 → 下载/安装引导: 「下载安装包」(GitHub latest asset) +
 *      「启动 Numas」(仅用户显式点击才 fire numas://serve)
 *   3. 引导期间每 3s 自动轮询端口 → 应用启动后自动接入, 无需手动重试
 *   4. 配色按应用主题 (light/dark) 适配 — 见 gate.css 两套 token
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

  /** 进入检测: 只探测端口 → 在线放行; 离线进入下载引导 */
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
    } else {
      setDot('down');
      setStatus('未检测到本地 numas 应用');
      setPhase('install');
      // 进入引导时异步解析当前平台可下载的最新安装包
      void resolveDownload().then((d) => { if (mounted.current) setDownload(d); });
    }
  }

  /** 显式唤起 (仅用户点击): fire numas://serve 后轮询等待上线; 失败回到引导 */
  async function wake() {
    setPhase('waking');
    setDot('wait');
    setStatus('正在唤起本地 numas…');
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
    setDot('down');
    setStatus('未能唤起本地 numas (可能尚未安装)');
    setPhase('install');
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
              未检测到 numas 服务。未安装请先下载安装; 已安装请点「启动 Numas」, 启动后本页会自动接入。
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
              <button className="gate__btn gate__btn--ghost" type="button" onClick={wake}>
                启动 Numas
              </button>
            </div>
            {download && !download.available && (
              <p className="gate__install-tip" style={{ marginTop: 10, fontSize: 12 }}>
                当前平台暂未提供安装包, 可前往 release 页手动选择。
              </p>
            )}
            <details className="gate__hint">
              <summary>手动启动 (已安装 CLI)</summary>
              <pre>
                {`numas serve --port ${ACTIVE_PORT}`}
                {'\n'}
                {`唤起 scheme: ${ACTIVE_SCHEME}`}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
