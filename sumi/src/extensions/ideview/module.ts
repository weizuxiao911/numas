/**
 * ideview — SPIKE (验证用, 非正式)
 * 抽屉 slot ('drawer', 与 config/slots.ts SOLO_SLOTS.Drawer 同值)
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IdeDrawer } from './components/IdeDrawer';

export const IDEV_PANEL_ID = 'ideview-drawer';
const DRAWER_SLOT = 'drawer';

@Injectable()
@Domain(ComponentContribution)
export class IdeDrawerContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      IDEV_PANEL_ID,
      { id: IDEV_PANEL_ID, component: IdeDrawer },
      { containerId: IDEV_PANEL_ID, iconClass: 'codicon codicon-symbol-namespace', title: 'IDE' },
      DRAWER_SLOT,
    );
  }
}

@Injectable()
export class IdeViewModule extends BrowserModule {
  providers = [IdeDrawerContribution];
  contributionProvider = ComponentContribution;
}
