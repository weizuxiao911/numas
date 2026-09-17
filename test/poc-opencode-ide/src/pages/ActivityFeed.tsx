import { useNavigate } from "react-router-dom"
import { seedTasks } from "@/lib/tasks"

export default function ActivityFeed() {
  const navigate = useNavigate()

  return (
    <section>
      <header className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>活动</h2>
            <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: 13 }}>
              开源项目方发布的可领取任务,hover 卡片查看领取入口。
            </p>
          </div>
          <span className="badge badge-open">{seedTasks.length} 个待领取</span>
        </div>
      </header>

      <div className="task-grid" style={{ marginTop: 16 }}>
        {seedTasks.map((task) => (
          <article
            key={task.taskId}
            className={`task-card task-card--hoverable`}
            onClick={() => navigate(`/workspace/${task.taskId}`)}
          >
            <div className="task-meta">
              <span className={`badge badge-${task.difficulty}`}>
                {labelDifficulty(task.difficulty)}
              </span>
              <span>· {shortRepo(task.repoUrl)}</span>
            </div>
            <h3>{task.title}</h3>
            <div className="task-meta">
              <span>🔗 {task.issueRef}</span>
              <span>🏢 {task.publisher}</span>
            </div>
            <p className="task-issue">{task.issueTitle}</p>
            <div className="task-hover-cta">
              <button
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/workspace/${task.taskId}`)
                }}
              >
                领取任务 →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function labelDifficulty(d: string) {
  return { easy: "简单", medium: "中等", hard: "困难" }[d] ?? d
}

function shortRepo(url: string) {
  return url.replace("https://github.com/", "")
}
