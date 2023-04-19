import { Page } from '@playwright/test';
import BasePage from '../Base';
import { HeaderPage } from './HeaderPage';
import { LeftSideBarPage } from './LeftSideBarPage';
import { ContainerPage } from './ContainerPage';

/*
  Workspace page
  --------------
  nc-app
    nc-header-content
    nc-root
      nc-left-sidebar
      nc-workspace-container

*/

export class WorkspacePage extends BasePage {
  readonly Header: HeaderPage;
  readonly LeftSideBar: LeftSideBarPage;
  readonly Container: ContainerPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.Header = new HeaderPage(this);
    this.LeftSideBar = new LeftSideBarPage(this);
    this.Container = new ContainerPage(this);
  }

  get() {
    return this.rootPage.locator('[id="nc-app"]');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
    await this.Header.waitFor({ state });
    await this.LeftSideBar.waitFor({ state });
    await this.Container.waitFor({ state });
  }

  async verifyStaticElements() {
    await this.Header.verifyStaticElements();
    await this.LeftSideBar.verifyStaticElements();
    await this.Container.verifyStaticElements();
  }
}
