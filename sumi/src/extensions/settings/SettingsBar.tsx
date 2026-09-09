/**
 * SettingsBar — SOLO 模式 sidebar 底部设置区块 (extensions/settings)
 *
 * 装 'settings' slot (内嵌在 sidebar 底部, 见 Sidebar.tsx).
 *
 * 布局: 单行 [头像 + 昵称] ...... [设置按钮]
 *
 * 设置按钮: 点击打开全局 modal (居中遮罩). modal 内容先占位,
 * 后续再决定加载什么拓展/内容.
 * 数据对接待后续 (先纯 UI):
 *   - 头像: 品牌 logo (config/brand.ts → service/brand)
 *   - 昵称: 未登录占位 "请先登录"
 */
import React, { useEffect, useRef, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { BrandToken, type IBrandService } from '../../service/brand';
import { styles } from './styles';

export const SettingsBar: React.FC = () => {
  const brand = useInjectable<IBrandService>(BrandToken).getBrand();
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Esc 关闭
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  return (
    <>
      <style>{styles}</style>
      <div className="app-settings">
        <div className="app-settings__row">
          <div className="app-settings__user">
            <span className="app-settings__avatar" aria-hidden title={brand.name}>{brand.logo}</span>
            <span className="app-settings__name">请先登录</span>
          </div>
          <button
            type="button"
            className="app-settings__btn"
            title="设置"
            onClick={() => setModalOpen(true)}
          >
            设置
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          ref={modalRef}
          className="app-settings__modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="app-settings__modal" role="dialog" aria-modal="true">
            <div className="app-settings__modal-head">
              <span className="app-settings__modal-title">设置</span>
              <button
                type="button"
                className="app-settings__modal-close"
                title="关闭"
                onClick={() => setModalOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="app-settings__modal-body">
              <div className="app-settings__modal-empty">设置面板建设中…</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
