/**
 * service/session/session.interface.ts — 登录态服务契约
 *
 * extensions 只依赖本接口 + SessionToken (DI 注入), 不碰 infra/cookie、infra/session.
 */
import type { SessionUser } from '../../infra/session';

export type { SessionUser };

export interface ISessionService {
  /** 已加载的用户信息 (同步; 未加载完成为 null) */
  getUser(): SessionUser | null;
  /** 是否已登录 (有 token) */
  isLoggedIn(): boolean;
  /** 加载: cookie 四字段齐全则覆盖写 session.yaml, 然后以文件内容为准. 幂等 */
  load(): Promise<SessionUser | null>;
  /** 订阅用户信息变化 (返回 unsubscribe) */
  subscribe(cb: (user: SessionUser | null) => void): () => void;
}

/** DI Token. useInjectable(SessionToken) 拿单例. */
export const SessionToken: symbol = Symbol('ISessionService');
