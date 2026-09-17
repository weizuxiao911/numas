import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useWorkbench } from "@/hooks/useWorkbench"
import ServiceProbePanel from "@/components/ServiceProbePanel"
import CodeblitzWorkbench from "@/components/CodeblitzWorkbench"

export default function Workbench() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const wb = useWorkbench(taskId)

  useEffect(() => {
    if (!wb.task) {
      const t = setTimeout(() => navigate("/"), 1500)
      return () => clearTimeout(t)
    }
  }, [wb.task, navigate])

  if (!wb.task) {
    return (
      <section>
        <div className="card">
          <p>任务 {taskId} 不存在,即将返回活动页…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="workbench">
      <header className="workbench-header">
        <div>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>
            ← 返回活动
          </button>
          <strong style={{ marginLeft: 12 }}>{wb.task.title}</strong>
        </div>
        <div className="workbench-header__meta">
          <span className={`phase-pill phase-${wb.phase}`}>{labelPhase(wb.phase)}</span>
          <span>{wb.task.issueRef}</span>
          <span>· {wb.task.repoUrl.replace("https://github.com/", "")}</span>
        </div>
      </header>

      {wb.phase === "service_probe" || wb.phase === "service_install" || wb.phase === "service_wake" ? (
        <ServiceProbePanel wb={wb} />
      ) : (
        <CodeblitzWorkbench wb={wb} />
      )}
    </section>
  )
}

function labelPhase(p: string) {
  return {
    service_probe: "本地服务检测",
    service_install: "引导安装",
    service_wake: "唤起本地服务",
    loading_task: "载入任务",
    extension_mount: "加载拓展",
    briefing: "引导就绪",
  }[p] ?? p
}
