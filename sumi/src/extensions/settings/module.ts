/**
 * Settings 拓展 — extensions/settings/
 *
 * 业务承载: SOLO sidebar 底部设置区块 (头像/昵称 + 设置按钮 + 工作空间选择).
 *
 * slot 装填: 'settings' (内嵌在 sidebar 底部, Sidebar.tsx 用 SlotRenderer 渲染).
 * 字符串字面量跟 SOLO_SLOTS.Settings 同值, 是协议约定, 不是模块引用.
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { SettingsBar } from './SettingsBar';

export const SETTINGS_PANEL_ID = 'settings';
/** 我要装到 'settings' slot (跟 config/slots.ts SOLO_SLOTS.Settings 同值) */
const TARGET_SLOT = 'settings';

@Injectable()
@Domain(ComponentContribution)
export class SettingsContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      SETTINGS_PANEL_ID,
      {
        id: SETTINGS_PANEL_ID,
        component: SettingsBar,
      },
      {
        containerId: SETTINGS_PANEL_ID,
        iconClass: 'codicon codicon-settings-gear',
        title: '设置',
      },
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class SettingsModule extends BrowserModule {
  providers = [SettingsContribution];
  contributionProvider = ComponentContribution;
}
