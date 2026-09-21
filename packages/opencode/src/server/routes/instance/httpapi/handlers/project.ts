import * as InstanceState from "@/effect/instance-state"
import { Project } from "@/project/project"
import { ProjectV2 } from "@opencode-ai/core/project"
import { Git } from "@/git"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ProjectNotFoundError } from "../errors"
import { markInstanceForReload } from "../lifecycle"

export const projectHandlers = HttpApiBuilder.group(InstanceHttpApi, "project", (handlers) =>
  Effect.gen(function* () {
    const svc = yield* Project.Service
    const project = yield* ProjectV2.Service
    const git = yield* Git.Service

    const list = Effect.fn("ProjectHttpApi.list")(function* () {
      return yield* svc.list()
    })

    const current = Effect.fn("ProjectHttpApi.current")(function* () {
      return (yield* InstanceState.context).project
    })

    const currentRemotes = Effect.fn("ProjectHttpApi.currentRemotes")(function* () {
      const ctx = yield* InstanceState.context
      // 用 opencode Git service 跑 `git remote -v` (已 provide, 无需 core GitV2).
      const result = yield* git.run(["remote", "-v"], { cwd: ctx.directory })
      if (result.exitCode !== 0) return []
      const seen = new Set<string>()
      const refs: Array<{ name: string; url: string }> = []
      for (const line of result.text().split("\n")) {
        // git remote -v 输出:  origin  https://github.com/a/b.git (fetch)
        const m = line.match(/^([^\s]+)\s+(.+?)\s+\((fetch|push)\)$/)
        if (!m) continue
        if (seen.has(m[1])) continue
        seen.add(m[1])
        refs.push({ name: m[1], url: m[2].trim() })
      }
      return refs
    })

    const initGit = Effect.fn("ProjectHttpApi.initGit")(function* () {
      const ctx = yield* InstanceState.context
      const next = yield* svc.initGit({ directory: ctx.directory, project: ctx.project })
      if (next.id === ctx.project.id && next.vcs === ctx.project.vcs && next.worktree === ctx.project.worktree)
        return next
      yield* markInstanceForReload(ctx, {
        directory: ctx.directory,
        worktree: ctx.directory,
        project: next,
      })
      return next
    })

    const update = Effect.fn("ProjectHttpApi.update")(function* (ctx: {
      params: { projectID: ProjectV2.ID }
      payload: Project.UpdatePayload
    }) {
      return yield* svc.update({ ...ctx.payload, projectID: ctx.params.projectID }).pipe(
        Effect.catchTag("Project.NotFoundError", (error) =>
          Effect.fail(
            new ProjectNotFoundError({
              projectID: error.projectID,
              message: `Project not found: ${error.projectID}`,
            }),
          ),
        ),
      )
    })

    const directories = Effect.fn("ProjectHttpApi.directories")((ctx: { params: { projectID: ProjectV2.ID } }) =>
      project.directories({ projectID: ctx.params.projectID }),
    )

    return handlers
      .handle("list", list)
      .handle("current", current)
      .handle("currentRemotes", currentRemotes)
      .handle("initGit", initGit)
      .handle("update", update)
      .handle("directories", directories)
  }),
)
