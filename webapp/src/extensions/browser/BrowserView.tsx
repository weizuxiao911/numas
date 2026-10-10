/**
 * BrowserView — 内置浏览器 (aside 视图 + numas-browser:// 编辑器 tab 共用)
 *
 * 直连目标地址 (不做反向代理). 地址栏: 后退/前进/刷新 + 回车跳转 + 系统浏览器打开.
 * 跨域 iframe 读不到内部 location, 地址栏以"发起导航"的地址为准; 同源时轮询同步.
 */
import React from 'react';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { BrowserServiceImpl } from './browser.service';
import { styles } from './styles';

const EMPTY_HINT = '输入地址开始浏览；部分站点禁止内嵌 (X-Frame-Options)，可点右上角用系统浏览器打开';

function normalizeUrl(raw: string): string {
  // 不做协议补全 (输入即所得): 需要完整 URL (http:// / https:// ...), 避免 "http" → "http://http" 这类自挖坑
  return (raw || '').trim();
}

export const BrowserView: React.FC<{ resource?: any }> = ({ resource }) => {
  const service = useInjectable<BrowserServiceImpl>(BrowserServiceImpl);
  const viewId = React.useMemo(() => {
    const authority = resource?.uri?.authority;
    return authority ? String(authority) : 'aside';
  }, [resource]);

  const [input, setInput] = React.useState(() => service.recall(viewId));
  const [src, setSrc] = React.useState(() => service.recall(viewId));
  const [hist, setHist] = React.useState<{ stack: string[]; idx: number }>(() => {
    const u = service.recall(viewId);
    return { stack: u ? [u] : [], idx: u ? 0 : -1 };
  });
  const [reloadKey, setReloadKey] = React.useState(0);
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const navigate = React.useCallback((raw: string) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    setInput(url);
    setSrc(url);
    service.remember(viewId, url);
    setHist((h) => ({ stack: [...h.stack.slice(0, h.idx + 1), url], idx: h.idx + 1 }));
  }, [service, viewId]);

  const go = React.useCallback((delta: number) => {
    const ni = hist.idx + delta;
    if (ni < 0 || ni >= hist.stack.length) return;
    const url = hist.stack[ni];
    setHist({ ...hist, idx: ni });
    setInput(url);
    setSrc(url);
    service.remember(viewId, url);
  }, [hist, service, viewId]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const openExternal = React.useCallback((url?: string) => {
    const target = url || src;
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer');
  }, [src]);

  // 注册到 service (browser.* 命令作用于 active 视图); api 走 ref 避免反复注册
  const apiRef = React.useRef({ navigate, reload, openExternal, activeUrl: () => src });
  apiRef.current = { navigate, reload, openExternal, activeUrl: () => src };
  React.useEffect(() => {
    service.register(viewId, {
      navigate: (u) => apiRef.current.navigate(u),
      reload: () => apiRef.current.reload(),
      openExternal: (u) => apiRef.current.openExternal(u),
      activeUrl: () => apiRef.current.activeUrl(),
    });
    return () => service.unregister(viewId);
  }, [service, viewId]);

  // 同源时同步 iframe 内部跳转 (跨域访问抛错, 静默忽略)
  React.useEffect(() => {
    if (!src) return;
    const t = setInterval(() => {
      try {
        const href = frameRef.current?.contentWindow?.location?.href;
        if (href && href !== 'about:blank') setInput(href);
      } catch { /* 跨域, 忽略 */ }
    }, 800);
    return () => clearInterval(t);
  }, [src]);

  return (
    <div className="app-browser" onMouseDown={() => service.activate(viewId)}>
      <style>{styles}</style>
      <div className="app-browser__bar">
        <button
          type="button"
          className="app-browser__btn"
          title="后退"
          disabled={hist.idx <= 0}
          onClick={() => go(-1)}
        >‹</button>
        <button
          type="button"
          className="app-browser__btn"
          title="前进"
          disabled={hist.idx < 0 || hist.idx >= hist.stack.length - 1}
          onClick={() => go(1)}
        >›</button>
        <button
          type="button"
          className="app-browser__btn"
          title="刷新"
          disabled={!src}
          onClick={reload}
        >⟳</button>
        <input
          className="app-browser__addr"
          value={input}
          placeholder="输入网址"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(input); }}
        />
        <button
          type="button"
          className="app-browser__btn"
          title="用系统浏览器打开"
          disabled={!src}
          onClick={() => openExternal()}
        >↗</button>
      </div>
      {src ? (
        <iframe key={reloadKey} ref={frameRef} className="app-browser__frame" src={src} title="内置浏览器" />
      ) : (
        <div className="app-browser__empty">{EMPTY_HINT}</div>
      )}
    </div>
  );
};
