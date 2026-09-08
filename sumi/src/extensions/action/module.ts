/**
 * Action 拓展 — extensions/action/
 *
 * 装 SOLO 模式 Action 槽 (自定义 slot 'action', 见 config/slots.ts).
 * 顶部工具栏: 模式切换 / sidebar 展开 / 项目选择.
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { ActionBar } from './ActionBar';
import { SOLO_SLOTS } from '../../config/slots';

export const ACTION_PANEL_ID = 'action';

@Injectable()
@Domain(ComponentContribution)
export class ActionContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      ACTION_PANEL_ID,
      {
        id: ACTION_PANEL_ID,
        component: ActionBar,
      },
      {
        containerId: ACTION_PANEL_ID,
        iconClass: 'codicon codicon-settings',
        title: '操作栏',
      },
      SOLO_SLOTS.Action,
    );
  }
}

@Injectable()
export class ActionModule extends BrowserModule {
  providers = [ActionContribution];
  contributionProvider = ComponentContribution;
}
