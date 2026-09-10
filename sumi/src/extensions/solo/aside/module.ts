/**
 * aside — 右列容器区 (solo.aside.container) 使用 codeblitz 官方 explorer (FileTree)
 * slot: 'solo.aside.container' (与 config/slots.ts SOLO_SLOTS.AsideContainer 同值)
 */
import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { ExplorerView } from './components/ExplorerView';

export const ASIDE_PANEL_ID = 'aside';
const DRAWER_SLOT = 'solo.aside.container';

@Injectable()
@Domain(ComponentContribution)
export class AsideContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      ASIDE_PANEL_ID,
      { id: ASIDE_PANEL_ID, component: ExplorerView },
      { containerId: ASIDE_PANEL_ID, iconClass: 'codicon codicon-explorer', title: 'Explorer' },
      DRAWER_SLOT,
    );
  }
}

@Injectable()
export class AsideModule extends BrowserModule {
  providers = [AsideContribution];
  contributionProvider = ComponentContribution;
}
