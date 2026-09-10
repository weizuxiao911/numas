/**
 * drawer-explorer — 抽屉内使用 codeblitz 官方 explorer (FileTree)
 * slot: 'drawer' (与 config/slots.ts SOLO_SLOTS.Drawer 同值)
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { ExplorerView } from './components/ExplorerView';

export const DRAWER_EXPLORER_PANEL_ID = 'drawer-explorer';
const DRAWER_SLOT = 'drawer';

@Injectable()
@Domain(ComponentContribution)
export class DrawerExplorerContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      DRAWER_EXPLORER_PANEL_ID,
      { id: DRAWER_EXPLORER_PANEL_ID, component: ExplorerView },
      { containerId: DRAWER_EXPLORER_PANEL_ID, iconClass: 'codicon codicon-explorer', title: 'Explorer' },
      DRAWER_SLOT,
    );
  }
}

@Injectable()
export class DrawerExplorerModule extends BrowserModule {
  providers = [DrawerExplorerContribution];
  contributionProvider = ComponentContribution;
}
