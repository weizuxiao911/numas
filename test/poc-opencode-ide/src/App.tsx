import { NavLink, Outlet } from "react-router-dom"

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>开源贡献 AI 工作台 · POC</h1>
        <nav>
          <NavLink to="/" end>
            活动
          </NavLink>
        </nav>
        <span className="badge badge-open">v0.1.20</span>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
