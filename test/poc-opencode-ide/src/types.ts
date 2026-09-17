export type TaskPlatform = "github" | "gitlab" | "gitee"

export interface ContributionTask {
  taskId: string
  title: string
  repoUrl: string
  platform: TaskPlatform
  issueRef: string
  issueTitle: string
  issueBody: string
  difficulty: "easy" | "medium" | "hard"
  publisher: string
  publishedAt: string
  claimedBy?: string
  status: "open" | "claimed" | "in_progress" | "delivered" | "completed"
}

export interface TaskContext {
  task_id: string
  repo_url: string
  issue_ref: string
  credential_ref: string
  callback_url: string
  signature: string
  metadata?: Record<string, unknown>
}

export interface WorkspaceState {
  id: string
  task: ContributionTask
  context: TaskContext
  createdAt: string
  phase: WorkspacePhase
  events: WorkspaceEvent[]
  aiMessages: AIMessage[]
  files: Record<string, string>
  prUrl?: string
}

export type WorkspacePhase =
  | "admitting"
  | "probing"
  | "waking"
  | "cloning"
  | "briefing"
  | "fixing"
  | "verifying"
  | "delivering"
  | "delivered"
  | "failed"

export interface WorkspaceEvent {
  at: string
  type: string
  detail: string
}

export interface AIMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export interface ServiceHealth {
  status: "up" | "down" | "starting"
  version?: string
  pid?: number
  url?: string
}
