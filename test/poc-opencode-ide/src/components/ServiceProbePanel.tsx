import type { WorkbenchState } from "@/hooks/useWorkbench"
import { detectOS, buildDownloadUrl } from "@/lib/opencode"

interface Props {
  wb: WorkbenchState & {
    tryLaunch: () => Promise<void>
    mockLaunch: () => Promise<void>
  }
}

export default function ServiceProbePanel({ wb }: Props) {
  const dotClass = `dot dot-${wb.health.status}`
  const det = detectOS()
  const downloadUrl = buildDownloadUrl(det)

  return (
    <div className="probe-panel">
      <div className="card">
        <div className="probe-banner">
          <span className={dotClass} />
          本地服务状态:
          <strong>
            {wb.health.status === "up"
              ? "已就绪"
              : wb.health.status === "starting"
                ? "启动中"
                : "未启动"}
          </strong>
          {wb.health.url && <code>· {wb.health.url}</code>}
        </div>

        {wb.phase === "service_probe" && (
          <p style={{ color: "var(--muted)" }}>
            正在通过 <code>GET {`http://localhost:4096/health`}</code> 探测 (no-cors 模式)…
          </p>
        )}

        {wb.phase === "service_install" && (
          <div className="install-block">
            <h3 style={{ marginTop: 0 }}>未检测到本地 numas</h3>
            <p style={{ color: "var(--muted)" }}>
              浏览器无 JS API 直接启动进程。POC 路径:
            </p>
            <ul style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
              <li>
                <strong>真实路径</strong>: 点击「唤起本地 numas」按钮,浏览器通过 iframe 触发
                <code> numas://serve?port=4096 </code>scheme,由已注册的本地 numas 应用接管
              </li>
              <li>
                <strong>若未安装</strong>: 显示当前平台 ({det.os}/{det.arch}) 的下载链接与安装指引
              </li>
              <li>
                <strong>POC 逃生口</strong>: 点击「模拟就绪」跳过真实唤起,继续后续流程
              </li>
            </ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={wb.tryLaunch} disabled={wb.launchAttempted}>
                唤起本地 numas
              </button>
              <a className="btn" href={downloadUrl} target="_blank" rel="noreferrer">
                下载 numas ({det.os}/{det.arch})
              </a>
              <button className="btn" onClick={wb.mockLaunch}>
                模拟就绪 (POC)
              </button>
            </div>
          </div>
        )}

        {wb.phase === "service_wake" && (
          <p style={{ color: "var(--muted)" }}>
            唤起本地 numas 中,等待 <code>/health</code> 可达…
          </p>
        )}

        <h3 style={{ marginTop: 24 }}>执行日志</h3>
        <div className="event-log">
          {wb.events.length === 0 && <div className="row">等待启动…</div>}
          {wb.events.map((e, i) => (
            <div className="row" key={i}>
              <time>{e.at.slice(11, 19)}</time>
              <strong>[{e.type}]</strong> {e.detail}
            </div>
          ))}
        </div>

        {wb.taskContext && (
          <>
            <h3 style={{ marginTop: 24 }}>任务上下文 (Task Context)</h3>
            <pre className="code" style={{ wordBreak: "break-all" }}>
              {wb.taskContext}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
