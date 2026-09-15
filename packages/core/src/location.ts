import { Context, Effect, Layer } from "effect"
import { Info, Ref, response } from "@opencode-ai/schema/location"
import { Project } from "./project"
import { LayerNode } from "./effect/layer-node"
import { makeLocationNode, tags } from "./effect/app-node"

export * as Location from "./location"

export { Info, Ref, response }

export interface BoundOptions {
  // numas: workspace 路径是 symlink 时, 用户输入 (logical, 如 /home/community/222)
  // 经 FSUtil.resolve 后变成物理路径 (/app/222). logicalDirectory 保留用户视角路径,
  // watcher callback 用它把 parcel 的 real path 事件还原成 logical 路径, 让客户端
  // 文件树 (filesystem.ts:resolve 走逻辑路径, AGENTS.md #21) 能匹配. 只用于内部
  // 路径转换, 不参与 schema / 协议 wire (Info 未暴露).
  readonly logicalDirectory?: string
}

export interface Interface extends Info {
  readonly vcs?: Project.Vcs
  readonly logicalDirectory?: string
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Location") {}

export const node = LayerNode.unbound(Service, tags.values.location)

const layer = (ref: Ref, options: BoundOptions = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const project = yield* Project.Service
      const resolved = yield* project.resolve(ref.directory)
      return Service.of({
        directory: ref.directory,
        workspaceID: ref.workspaceID,
        project: { id: resolved.id, directory: resolved.directory },
        vcs: resolved.vcs,
        ...(options.logicalDirectory ? { logicalDirectory: options.logicalDirectory } : {}),
      })
    }),
  )

export const boundNode = (ref: Ref, options: BoundOptions = {}) =>
  makeLocationNode({
    service: Service,
    layer: layer(ref, options),
    deps: [Project.node],
  })
