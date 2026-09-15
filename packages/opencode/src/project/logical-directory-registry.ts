// numas: real-path → logical-path 映射表, 给 fs watcher 用.
//
// 问题: InstanceStore.load 用 FSUtil.resolve 把用户输入 (logical, 可能是 symlink
// 路径 /home/community/222) realpath 成物理路径 (/app/222), 后续 Location.Ref /
// Location.Service.directory 全部走 real path. Watcher 订阅 real path, parcel 内部
// 归一化使 update.path 也是 real path. 但客户端 /api/fs/list 返回的是 logical 路径
// (filesystem.ts:resolve 用 path.resolve 不 realpath, AGENTS.md #21 修复约定).
// 客户端拿到 real path 事件去匹配 logical 文件树 → hasFile false → 静默丢弃 →
// UI 不更新, 用户感受是 "opencode 没发事件 到 /global/event".
//
// 解决: 在 watcher callback 把 update.path 从 real prefix 替换回 logical prefix.
// 这个映射在 InstanceStore.load 时建立 (real = FSUtil.resolve(input), logical =
// path.resolve(input), 不再丢), boundNode 时通过 resolver 拿到. 本 registry 只
// 承担 side-channel 数据存储, 不参与 layer 依赖图.

const map = new Map<string, string>()

export const LogicalDirectoryRegistry = {
  set(real: string, logical: string) {
    if (real !== logical) {
      map.set(real, logical)
      // 同时按 logical 作 key 也存一份: /api/fs/watch 用 ref.directory (logical)
      // 查时找不到 map[real], 但 map[logical] 命中, 不需要再 realpath 输入.
      map.set(logical, logical)
    }
  },
  get(key: string): string | undefined {
    return map.get(key)
  },
  delete(real: string) {
    map.delete(real)
  },
  clear() {
    map.clear()
  },
}
