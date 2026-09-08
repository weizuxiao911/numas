/**
 * Action 拓展 — extensions/action/
 *
 * 业务承载: SOLO 模式顶部工具栏 (ModeSwitch / sidebar expand / ProjectPicker).
 *
 * slot 装填 (vscode 模型):
 *   - slot 是全局的, 给拓展插入的 (定义在 config/slots.ts)
 *   - 拓展不引 config/, 直接以字符串声明要装哪个 slot
 *   - 字符串字面量跟 SOLO_SLOTS 同值, 是协议约定, 不是模块引用
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
} from '@opensumi/ide-core-browser/lib/layout';

import { ActionBar } from './ActionBar';

export const ACTION_PANEL_ID = 'action';
/** 我要装到 'action' slot (跟 config/slots.ts SOLO_SLOTS.Action 同值) */
const TARGET_SLOT = 'action';

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
      TARGET_SLOT,
    );
  }
}

@Injectable()
export class ActionModule extends BrowserModule {
  providers = [ActionContribution];
  contributionProvider = ComponentContribution;
}
