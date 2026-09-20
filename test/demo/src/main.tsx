import React from 'react';
import { createRoot } from 'react-dom/client';
import { TASKS, type TaskCard } from './data/tasks';
import './styles.css';

const WORKBENCH_URL = 'http://localhost:7788';

function claim(task: TaskCard): void {
  // 任务源只标记两个参数: repo = 开源项目 (git) URL, issue = issue URL
  const params = new URLSearchParams({
    repo: `https://github.com/${task.repo}`,
    issue: task.issueUrl,
  });
  window.open(`${WORKBENCH_URL}/?${params.toString()}`, '_blank');
}

function DifficultyBadge({ level }: { level: TaskCard['difficulty'] }) {
  const cls = `diff diff--${level === '中高' ? 'mid-high' : level}`;
  return <span className={cls}>{level}</span>;
}

function TaskCardView({ task }: { task: TaskCard }) {
  return (
    <article className="card">
      <div className="card__head">
        <span className="card__repo">{task.repo}</span>
        <DifficultyBadge level={task.difficulty} />
      </div>
      <h3 className="card__title">{task.title}</h3>
      <p className="card__summary">{task.summary}</p>
      <div className="card__tags">
        {task.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <div className="card__foot">
        <span className="card__meta">
          #{task.issueNumber} · 积分 {task.points}
        </span>
        <button className="btn" onClick={() => claim(task)}>
          领取任务
        </button>
      </div>
    </article>
  );
}

function App() {
  return (
    <div className="page">
      <header className="hero">
        <div className="hero__logo" aria-hidden>
          🐮
        </div>
        <h1>开源贡献 · AI 工作台</h1>
        <p className="hero__sub">挑选一个开源任务, 用本地 Numas AI 接入你的开发工作台</p>
      </header>
      <main className="grid">
        {TASKS.map((t) => (
          <TaskCardView key={t.id} task={t} />
        ))}
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
