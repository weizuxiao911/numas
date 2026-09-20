import React, { useEffect, useRef, useState } from 'react';
import { ACTIVE_HEALTH, ACTIVE_PORT, ACTIVE_SCHEME, pollNumas, resolveDownload, type DownloadInfo } from './numas';
import './gate.css';

interface GateProps {
  /** 就绪后渲染 (通常为 App). */
  children: React.ReactNode;
}

type Phase = 'checking' | 'connecting' | 'install' | 'ready';

/**
 * 前置 numas 接入门控:
 *   1. 探测本地 numas → 在线直接放行渲染 IDE
 *   2. 离线 → fire numas:// scheme 唤起, 轮询等待上线
 *   3. 超时未上线 → 展示下载/安装引导, 用户点「重试」回到步骤 1
 */
export function Gate({ children }: GateProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [dot, setDot] = useState<'wait' | 'up' | 'down'>('wait');
  const [status, setStatus] = useState('检测本地 numas 服务…');
  const [download, setDownload] = useState<DownloadInfo | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void start();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setPhase('checking');
    setDot('wait');
    setStatus('检测本地 numas 服务…');
    const res = await pollNumas(14, 600);
    if (!mounted.current) return;
    if (res.ok) {
      setDot('up');
      setStatus(`已连接本地 numas — ${ACTIVE_HEALTH}`);
      setPhase('ready');
    } else {
      setDot('down');
      setStatus('未检测到本地 numas 应用');
      setPhase('install');
      // 进入引导时异步解析当前平台可下载的最新安装包
      void resolveDownload().then((d) => { if (mounted.current) setDownload(d); });
    }
  }

  if (phase === 'ready') {
    return <>{children}</>;
  }

  return (
    <div className="gate">
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
              未检测到 numas 应用。请先下载安装, 安装后点击下方按钮唤起并接入。
            </p>
            <div className="gate__actions">
              {download?.available ? (
                <a className="gate__btn gate__btn--primary" href={download.url} target="_blank" rel="noreferrer">
                  下载安装包 ({download.label})
                </a>
              ) : (
                <a className="gate__btn gate__btn--primary" href="https://github.com/weizuxiao911/numas/releases/latest" target="_blank" rel="noreferrer">
                  前往下载页
                </a>
              )}
              <button className="gate__btn gate__btn--ghost" type="button" onClick={start}>
                重新检测
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

        {phase === 'connecting' && (
          <div className="gate__actions">
            <button className="gate__btn gate__btn--ghost" type="button" onClick={start}>
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
