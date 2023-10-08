import { expect, Locator, Page } from '@playwright/test';
import BasePage from '../Base';
import { HeaderPage } from './HeaderPage';
import { LeftSideBarPage } from './LeftSideBarPage';
import { ContainerPage } from './ContainerPage';
import { CollaborationPage } from './CollaborationPage';

/*
  Workspace page
  --------------
  nc-app
    nc-header-content
    nc-root
      nc-left-sidebar
      nc-workspace-settings

*/

export class WorkspacePage extends BasePage {
  readonly header: HeaderPage;
  readonly leftSideBar: LeftSideBarPage;
  readonly container: ContainerPage;
  readonly collaboration: CollaborationPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.header = new HeaderPage(this);
    this.leftSideBar = new LeftSideBarPage(this);
    this.container = new ContainerPage(this);
    this.collaboration = new CollaborationPage(this);
  }

  get() {
    return this.rootPage.locator('[id="nc-app"]');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
    await this.header.waitFor({ state });
    await this.leftSideBar.waitFor({ state });
    await this.container.waitFor({ state });
  }

  async verifyStaticElements() {
    await this.waitFor({ state: 'visible' });
    await this.header.verifyStaticElements();
    await this.leftSideBar.verifyStaticElements();
    await this.container.verifyStaticElements();
  }

  async workspaceCreate({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.leftSideBar.workspaceCreate({ title });
  }

  async workspaceRename({ title, newTitle }: { newTitle: string; title: string }) {
    await this.leftSideBar.workspaceRename({ title, newTitle });
  }

  async workspaceDelete({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.leftSideBar.workspaceDelete({ title });
  }

  async workspaceOpen({ title }) {
    await this.waitFor({ state: 'visible' });
    await (await this.leftSideBar.workspaceGetLocator(title)).click();
  }

  async workspaceCount() {
    return await this.leftSideBar.getWorkspaceCount();
  }

  async baseCreate({ title, type }) {
    await this.waitFor({ state: 'visible' });
    await this.container.baseCreate({ title, type });
  }

  async baseDelete({ title }) {
    await this.container.baseDelete({ title });
  }

  async baseOpen({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.container.baseOpen({ title });
  }

  async baseRename({ title, newTitle }) {
    await this.container.baseRename({ title, newTitle });
  }

  async baseMove({ title, newWorkspace }) {
    await this.container.baseMove({ title, newWorkspace });
  }

  async baseAddToFavourites({ title }: { title: string }) {
    await this.container.baseAddToFavourites({ title });
  }

  async openQuickAccess(menu: 'Recent' | 'Shared with me' | 'Favourites') {
    await this.leftSideBar.openQuickAccess(menu);
    await this.rootPage.waitForTimeout(100);
  }

  async checkWorkspaceCreateButton(param: { exists: boolean }) {
    // fix me! wait for page load to complete
    // one of the two checks should suffice
    await this.rootPage.waitForTimeout(1000);
    expect(await this.leftSideBar.createWorkspace.count()).toBe(param.exists ? 1 : 0);
    await this.leftSideBar
      .get()
      .locator('[data-testid="nc-create-workspace"]')
      .waitFor({ state: param.exists ? 'visible' : 'hidden' });
  }

  async logout() {
    await this.header.accountMenuOpen({ title: 'sign-out' });
  }

  // Add on verification routines
  // can be done using expect at source

  async openPasswordChangeModal() {
    await this.header.accountMenuOpen({ title: 'user-settings' });
    await this.rootPage.locator('[data-menu-id="password-reset"]').click();
  }

  async waitForRender() {
    await this.header.verifyStaticElements();
  }

  // async verifyAccess(role: string) {
  //   const addWs = this.LeftSideBar.createWorkspace;
  //   const addProject = this.Container.newProjectButton;
  //   const collaborators = this.Container.collaborators;
  //   const billing = this.Container.billing;
  //   const moreActions = this.Container.moreActions;
  //
  //   if (role === 'owner') expect(await billing.isVisible()).toBeTruthy();
  //   else expect(await billing.isVisible()).toBeFalsy();
  //
  //   expect(await addWs.isVisible()).toBeTruthy();
  //
  //   if (role === 'creator' || role === 'owner') {
  //     expect(await collaborators.isVisible()).toBeTruthy();
  //     expect(await addProject.isVisible()).toBeTruthy();
  //     expect(await moreActions.isVisible()).toBeTruthy();
  //
  //     const menuItems = await this.Container.getMoreActionsSubMenuDetails();
  //     if (role === 'creator') {
  //       expect(menuItems).toEqual(['Rename Base', 'Duplicate Base']);
  //     } else {
  //       expect(menuItems).toEqual(['Rename Base', 'Duplicate Base', 'Move Base', 'Delete Base']);
  //     }
  //   } else {
  //     expect(await collaborators.isVisible()).toBeFalsy();
  //     expect(await billing.isVisible()).toBeFalsy();
  //     expect(await addProject.isVisible()).toBeFalsy();
  //   }
  // }

  async verifyAccess(role: string) {
    const collaborators = this.container.collaborators;
    const billing = this.container.billing;
    const settings = this.container.settings;

    if (role === 'owner') {
      expect(await billing.isVisible()).toBeTruthy();
      expect(await settings.isVisible()).toBeTruthy();
    } else {
      expect(await billing.isVisible()).toBeFalsy();
      expect(await settings.isVisible()).toBeFalsy();
    }

    await this.rootPage.waitForTimeout(1000);

    if (role === 'creator' || role === 'owner') {
      console.log(await this.container.get().count());
      console.log(await this.container.collaborators.count());
      expect(await collaborators.isVisible()).toBeTruthy();
    } else {
      expect(await collaborators.isVisible()).toBeFalsy();
    }
  }
}
