/**
 * UserBar — SOLO sidebar 底部左侧「用户信息」(extensions/user)
 *
 * 装 'solo.sidebar.footer' slot (Sidebar.tsx 底部一行的左半, 见 config/slots.ts SOLO_SLOTS.SidebarFooter).
 *
 * 内容: [头像 (品牌 logo)] [昵称] — 整块可点击 (登录入口).
 * 数据:
 *   - 头像: service/brand (config/brand.ts)
 *   - 用户: service/session — cookie(userId/token/partner/sign) 四字段齐全则覆盖写
 *           <HOME>/.numas/cache/session.yaml, 之后以文件内容为准
 * 分层: 只注入 service (DI), 不碰 infra.
 */
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { BrandToken, type IBrandService } from '../../../service/brand';
import { SessionToken, type ISessionService, type SessionUser } from '../../../service/session';
import { styles } from './styles';

export const UserBar: React.FC = () => {
  const brand = useInjectable<IBrandService>(BrandToken).getBrand();
  const session = useInjectable<ISessionService>(SessionToken);
  const [user, setUser] = useState<SessionUser | null>(() => session.getUser());

  useEffect(() => {
    void session.load().then(setUser);
    return session.subscribe(setUser);
  }, [session]);

  return (
    <>
      <style>{styles}</style>
      <button
        type="button"
        className="app-user"
        title={user ? `${user.userId} · ${user.partner}` : '登录'}
        onClick={() => { /* 登录入口: 待接入账号体系 */ }}
      >
        <span className="app-user__avatar" aria-hidden>{brand.logo}</span>
        <span className="app-user__name">{user?.userId || '请先登录'}</span>
      </button>
    </>
  );
};
