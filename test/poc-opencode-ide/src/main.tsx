import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter, Route, Routes } from "react-router-dom"
import App from "./App"
import ActivityFeed from "@/pages/ActivityFeed"
import Workbench from "@/pages/Workbench"
import "./styles.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<ActivityFeed />} />
          <Route path="workspace/:taskId" element={<Workbench />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
