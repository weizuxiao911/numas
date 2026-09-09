/**
 * service/state/state.interface.ts
 *
 * codeblitz 状态契约: 当前工作目录 (workdir) / 最近选择.
 *
 * 单目录模型: 只有 workdir 一个概念 (原 workspace 空间概念已移除).
 * 持久化: localStorage (见 infra/url NUMAS_WORKDIR + ./persistence.ts recent).
 */

export interface RecentWorkspace {
  /** 路径 (绝对路径) */
  path: string;
  /** 最后打开时间 (ms epoch) */
  lastOpenedAt: number;
}

export interface WorkspaceState {
  /** 当前 workdir (项目); 未选择为 '' */
  workdir: string;
  /** 最近选择过的目录 (新 → 旧, 最多 10 条) */
  recent: RecentWorkspace[];
}

export interface IStateService {
  /** 当前状态 (workdir + recent, 实时读不缓存) */
  getState(): WorkspaceState;
  /** 当前 workdir (项目) */
  getWorkdir(): string;
  /** 是否已显式选择项目 (/path 兜底不算) */
  isWorkdirSelected(): boolean;
  /** 选择项目: 持久化 + 派 workdir:changed (不 reload, explorer 动态跟随).
   *  传空 = 清除选择 (回「选择项目」空态). */
  setWorkdir(dir: string): void;
  /** 最近目录列表 */
  getRecent(): RecentWorkspace[];
  /** 加一条最近目录 */
  pushRecent(dir: string): void;
  /** 订阅 workdir 变更 (返回 unsubscribe) */
  subscribeWorkdir(cb: (next: string) => void): () => void;
}

export const StateToken: symbol = Symbol('IStateService');
