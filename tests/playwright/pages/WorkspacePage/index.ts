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
      nc-workspace-container

*/

export class WorkspacePage extends BasePage {
  readonly Header: HeaderPage;
  readonly LeftSideBar: LeftSideBarPage;
  readonly Container: ContainerPage;
  readonly collaboration: CollaborationPage;

  constructor(rootPage: Page) {
    super(rootPage);
    this.Header = new HeaderPage(this);
    this.LeftSideBar = new LeftSideBarPage(this);
    this.Container = new ContainerPage(this);
    this.collaboration = new CollaborationPage(this);
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

  async workspaceCreate({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.LeftSideBar.workspaceCreate({ title });
  }

  async workspaceRename({ title, newTitle }: { newTitle: string; title: string }) {
    await this.LeftSideBar.workspaceRename({ title, newTitle });
  }

  async workspaceDelete({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.LeftSideBar.workspaceDelete({ title });
  }

  async workspaceOpen({ title }) {
    await this.waitFor({ state: 'visible' });
    await (await this.LeftSideBar.workspaceGetLocator(title)).click();
  }

  async workspaceCount() {
    return await this.LeftSideBar.getWorkspaceCount();
  }

  async projectCreate({ title, type }) {
    await this.waitFor({ state: 'visible' });
    await this.Container.projectCreate({ title, type });
  }

  async projectDelete({ title }) {
    await this.Container.projectDelete({ title });
  }

  async projectOpen({ title }) {
    await this.waitFor({ state: 'visible' });
    await this.Container.projectOpen({ title });
  }

  async projectRename({ title, newTitle }) {
    await this.Container.projectRename({ title, newTitle });
  }

  async projectMove({ title, newWorkspace }) {
    await this.Container.projectMove({ title, newWorkspace });
  }

  async projectAddToFavourites({ title }: { title: string }) {
    await this.Container.projectAddToFavourites({ title });
  }

  async openQuickAccess(menu: 'Recent' | 'Shared with me' | 'Favourites') {
    await this.LeftSideBar.openQuickAccess(menu);
    await this.rootPage.waitForTimeout(100);
  }

  async checkWorkspaceCreateButton(param: { exists: boolean }) {
    // fix me! wait for page load to complete
    // one of the two checks should suffice
    await this.rootPage.waitForTimeout(1000);
    expect(await this.LeftSideBar.createWorkspace.count()).toBe(param.exists ? 1 : 0);
    await this.LeftSideBar.get()
      .locator('[data-testid="nc-create-workspace"]')
      .waitFor({ state: param.exists ? 'visible' : 'hidden' });
  }

  async logout() {
    await this.Header.accountMenuOpen({ title: 'sign-out' });
  }

  // Add on verification routines
  // can be done using expect at source

  async openPasswordChangeModal() {
    await this.Header.accountMenuOpen({ title: 'user-settings' });
    await this.rootPage.locator('[data-menu-id="password-reset"]').click();
  }

  async waitForRender() {
    await this.Header.verifyStaticElements();
  }

  async verifyAccess(role: string) {
    const addWs = await this.LeftSideBar.createWorkspace;
    const addProject = await this.Container.newProjectButton;
    const collaborators = await this.Container.collaborators;
    const billing = await this.Container.billing;
    const moreActions = await this.Container.moreActions;

    if (role === 'owner') expect(await billing.isVisible()).toBeTruthy();
    else expect(await billing.isVisible()).toBeFalsy();

    expect(await addWs.isVisible()).toBeTruthy();

    if (role === 'creator' || role === 'owner') {
      expect(await collaborators.isVisible()).toBeTruthy();
      expect(await addProject.isVisible()).toBeTruthy();
      expect(await moreActions.isVisible()).toBeTruthy();

      const menuItems = await this.Container.getMoreActionsSubMenuDetails();
      if (role === 'creator') {
        expect(menuItems).toEqual(['Rename Project', 'Duplicate Project']);
      } else {
        expect(menuItems).toEqual(['Rename Project', 'Duplicate Project', 'Move Project', 'Delete Project']);
      }
    } else {
      expect(await collaborators.isVisible()).toBeFalsy();
      expect(await billing.isVisible()).toBeFalsy();
      expect(await addProject.isVisible()).toBeFalsy();
    }
  }
}
