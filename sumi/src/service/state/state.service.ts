/**
 * service/state/state.service.ts
 *
 * StateServiceImpl — DI 单例.
 * 维护 codeblitz 状态: 当前工作目录 (workdir) + 最近选择.
 *
 * 单目录模型: 只有 workdir (原 workspace 空间概念已移除).
 * extensions 只经本 service 取目录, 禁止直连 infra.
 *
 * 持久化: workdir 走 infra/url 的 localStorage (NUMAS_WORKDIR),
 * recent 走 ./persistence.ts. 后续换 IndexedDB 只换 persistence.ts.
 */

import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  getWorkdir,
  setWorkdir as setWorkdirInfra,
  isWorkdirSelected,
  subscribeWorkdir,
} from '../../infra/url';
import type { IStateService, RecentWorkspace, WorkspaceState } from './state.interface';
import { StateToken } from './state.interface';
import { loadRecent, saveRecent } from './persistence';

@Injectable()
export class StateServiceImpl implements IStateService {
  private _recent: RecentWorkspace[];

  constructor() {
    this._recent = loadRecent();
  }

  getState(): WorkspaceState {
    return { workdir: getWorkdir(), recent: [...this._recent] };
  }

  getWorkdir(): string {
    return getWorkdir();
  }

  isWorkdirSelected(): boolean {
    return isWorkdirSelected();
  }

  setWorkdir(dir: string): void {
    if (!dir) {
      setWorkdirInfra('');
      return;
    }
    setWorkdirInfra(dir);
    this.pushRecent(dir);
  }

  getRecent(): RecentWorkspace[] {
    return [...this._recent];
  }

  pushRecent(dir: string): void {
    if (!dir) return;
    const list = this._recent.filter((r) => r.path !== dir);
    list.unshift({ path: dir, lastOpenedAt: Date.now() });
    if (list.length > 10) list.length = 10;
    this._recent = list;
    saveRecent(list);
  }

  subscribeWorkdir(cb: (next: string) => void): () => void {
    return subscribeWorkdir(cb);
  }
}

@Injectable()
export class StateModule extends BrowserModule {
  providers = [
    { token: StateToken, useClass: StateServiceImpl },
    StateServiceImpl,
  ];
}
