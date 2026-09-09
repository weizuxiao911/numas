/**
 * service/session — 登录态 (用户信息) DI 单例
 *
 * 分层: infra (cookie / session) → service (本模块) → extensions (只注入本 service).
 *
 * 取值链 (用户约定):
 *   1. 启动时先读 cookie 的 userId / token / partner / sign
 *   2. 四个字段齐全 → 覆盖写 <HOME>/.numas/cache/session.yaml
 *      任一缺失 → 不写 (保留已有文件)
 *   3. 之后一律以 session.yaml 内容为用户信息来源
 */
import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { getCookies } from '../../infra/cookie';
import {
  readSessionUser,
  writeSessionUser,
  SESSION_USER_KEYS,
  type SessionUser,
} from '../../infra/session';

import { SessionToken, type ISessionService } from './session.interface';

@Injectable()
export class SessionServiceImpl implements ISessionService {
  private _user: SessionUser | null = null;
  private _loading: Promise<SessionUser | null> | null = null;

  /** 已加载的用户信息 (同步读; 未加载完成返回 null). */
  getUser(): SessionUser | null {
    return this._user;
  }

  isLoggedIn(): boolean {
    return !!this._user?.token;
  }

  /** 加载用户信息: cookie 齐全则覆盖写文件, 然后读文件. 幂等 (并发共享同一次). */
  load(): Promise<SessionUser | null> {
    if (this._user) return Promise.resolve(this._user);
    if (this._loading) return this._loading;
    this._loading = (async () => {
      try {
        const cookie = getCookies(SESSION_USER_KEYS);
        const complete = SESSION_USER_KEYS.every((k) => cookie[k]);
        // cookie 齐全 → 覆盖写; 缺任一字段不写盘 (保留旧文件)
        if (complete) await writeSessionUser(cookie as SessionUser);
        const user = await readSessionUser();
        this._user = user;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('session:changed', { detail: { user } }));
        }
        return user;
      } finally {
        this._loading = null;
      }
    })();
    return this._loading;
  }

  subscribe(cb: (user: SessionUser | null) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: Event) => cb((e as CustomEvent<{ user: SessionUser | null }>).detail?.user ?? null);
    window.addEventListener('session:changed', handler);
    return () => window.removeEventListener('session:changed', handler);
  }
}

@Injectable()
export class SessionModule extends BrowserModule {
  providers = [
    { token: SessionToken, useClass: SessionServiceImpl },
    SessionServiceImpl,
  ];
}
