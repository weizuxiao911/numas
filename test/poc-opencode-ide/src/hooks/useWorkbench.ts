import { useCallback, useEffect, useRef, useState } from "react"
import { detectOS, launchAndWait, mockUp, probe } from "@/lib/opencode"
import { findTask, buildTaskContext } from "@/lib/tasks"
import type { ContributionTask, ServiceHealth, WorkspaceEvent } from "@/types"

export type WorkbenchPhase =
  | "service_probe"
  | "service_install"
  | "service_wake"
  | "loading_task"
  | "extension_mount"
  | "briefing"

export interface WorkbenchState {
  task?: ContributionTask
  taskContext?: string
  health: ServiceHealth
  phase: WorkbenchPhase
  events: WorkspaceEvent[]
  ready: boolean
  launchAttempted: boolean
}

export function useWorkbench(taskId?: string) {
  const task = taskId ? findTask(taskId) : undefined
  const [state, setState] = useState<WorkbenchState>({
    health: { status: "down" },
    phase: "service_probe",
    events: [],
    ready: false,
    launchAttempted: false,
  })
  const cancelled = useRef(false)

  const pushEvent = useCallback((type: string, detail: string) => {
    setState((s) => ({
      ...s,
      events: [...s.events, { at: new Date().toISOString(), type, detail }],
    }))
  }, [])

  useEffect(() => {
    cancelled.current = false
    void run()
    return () => {
      cancelled.current = true
    }
  }, [taskId])

  async function run() {
    if (!task) return
    setState((s) => ({ ...s, task, taskContext: buildTaskContext(task), phase: "service_probe" }))
    pushEvent("probe", `探测本地服务 http://localhost:4096/health`)

    const first = await probe()
    if (cancelled.current) return
    setState((s) => ({ ...s, health: first }))

    if (first.status === "up") {
      pushEvent("probe-ok", "本地服务已运行")
      await continueAfterService()
      return
    }
    setState((s) => ({ ...s, phase: "service_install" }))
    pushEvent("install-required", "未检测到本地服务,等待用户确认唤起/安装")
  }

  const tryLaunch = useCallback(async () => {
    if (!task) return
    setState((s) => ({ ...s, phase: "service_wake", launchAttempted: true }))
    const det = detectOS()
    pushEvent("wake", `通过 numas://serve?port=4096 scheme 唤起本地应用 (${det.os}/${det.arch})`)
    const { ok, elapsedMs } = await launchAndWait()
    if (cancelled.current) return
    if (ok) {
      pushEvent("wake-ok", `本地服务已起来,耗时 ${elapsedMs}ms`)
      setState((s) => ({ ...s, health: { status: "up", url: "http://localhost:4096" } }))
      await continueAfterService()
    } else {
      pushEvent("wake-timeout", `唤起超时 ${elapsedMs}ms,可能未安装 numas`)
      setState((s) => ({ ...s, phase: "service_install" }))
    }
  }, [task])

  /** POC 逃生:本地未装时跳过真实唤起 */
  const mockLaunch = useCallback(async () => {
    if (!task) return
    setState((s) => ({ ...s, phase: "service_wake", launchAttempted: true }))
    pushEvent("mock-wake", "POC 逃生口:标记本地服务为已就绪")
    await wait(400)
    setState((s) => ({ ...s, health: mockUp() }))
    pushEvent("mock-wake-ok", "本地服务 mock 成功")
    await continueAfterService()
  }, [task])

  async function continueAfterService() {
    if (!task) return
    setState((s) => ({ ...s, phase: "loading_task" }))
    pushEvent("load-task", `fork & clone ${task.repoUrl}`)
    await wait(700)
    pushEvent("load-deps", "识别语言/包管理器,安装依赖")
    await wait(500)

    setState((s) => ({ ...s, phase: "extension_mount" }))
    pushEvent("mount-ext", "挂载内置拓展 (内置 issue/git/ai 面板,后续迁移 vsix)")
    await wait(500)

    setState((s) => ({ ...s, phase: "briefing", ready: true }))
    pushEvent("ready", "工作区就绪")
  }

  return {
    ...state,
    tryLaunch,
    mockLaunch,
  }
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
