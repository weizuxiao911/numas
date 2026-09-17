import { useState } from "react"
import type { WorkbenchState } from "@/hooks/useWorkbench"
import { makeBriefMessage, mockAIReply } from "@/lib/mock-ai"
import type { AIMessage } from "@/types"

interface Props {
  wb: WorkbenchState
}

export default function CodeblitzWorkbench({ wb }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>(() => [
    makeBriefMessage(wb.task!),
  ])
  const [input, setInput] = useState("")
  const [activeFile, setActiveFile] = useState("README.md")
  const files = {
    "README.md": `# ${wb.task!.title}\n\n${wb.task!.issueBody}\n`,
    "src/extract/derive/ast-util.mjs": `export function isTypeOnly(node) {\n  return false;\n}\n`,
    "src/main.mjs": `import { isTypeOnly } from "./extract/derive/ast-util.mjs";\nconsole.log(isTypeOnly({}));\n`,
    "test/circular-deps.spec.mjs": `import { test } from "vitest";\ntest("type-only imports do not report circular", () => {\n  expect(true).toBe(true);\n});\n`,
  }

  const onSend = () => {
    const text = input.trim()
    if (!text) return
    const userMsg: AIMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }
    const assistantMsg: AIMessage = {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: mockAIReply(text, wb.task!),
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
  }

  return (
    <div className="codeblitz">
      <aside className="codeblitz-explorer">
        <h4>文件资源管理器</h4>
        <div className="file-tree">
          {Object.keys(files).map((f) => (
            <div
              key={f}
              className={`file ${f === activeFile ? "active" : ""}`}
              onClick={() => setActiveFile(f)}
            >
              {f}
            </div>
          ))}
        </div>
        <div className="builtin-ext">
          <h4>内置拓展</h4>
          <div className="ext">📋 issue 面板</div>
          <div className="ext">🔀 git 操作</div>
          <div className="ext">🤖 AI 引导</div>
          <div className="ext hint">(后续迁移 vsix)</div>
        </div>
      </aside>

      <main className="codeblitz-editor">
        <div className="editor-tabs">
          <span className="tab active">{activeFile}</span>
        </div>
        <div className="editor">
          <pre>{files[activeFile as keyof typeof files]}</pre>
        </div>
      </main>

      <aside className="codeblitz-ai">
        <h4>AI 引导</h4>
        <div className="ai-messages">
          {messages.map((m) => (
            <div key={m.id} className={`ai-message ${m.role}`}>
              {m.content}
            </div>
          ))}
        </div>
        <div className="ai-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问 AI: 根因在哪 / 给我修复方案 / 测试结果"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend()
            }}
          />
          <button className="btn btn-primary" onClick={onSend}>
            发送
          </button>
        </div>
      </aside>
    </div>
  )
}
