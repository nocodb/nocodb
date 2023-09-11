import BasePage from '../../../Base';
import { SidebarPage } from '..';
import { expect } from '@playwright/test';

export class SidebarProjectNodeObject extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(parent: SidebarPage) {
    super(parent.rootPage);

    this.sidebar = parent;
  }

  get({ projectTitle }: { projectTitle: string }) {
    return this.sidebar.get().getByTestId(`nc-sidebar-project-${projectTitle}`);
  }

  async click({ projectTitle }: { projectTitle: string }) {
    await this.get({
      projectTitle,
    }).click();
  }

  async clickOptions({ projectTitle }: { projectTitle: string }) {
    await this.get({
      projectTitle,
    })
      .getByTestId(`nc-sidebar-context-menu`)
      .click();
  }

  async verifyTableAddBtn({ projectTitle, visible }: { projectTitle: string; visible: boolean }) {
    const addBtn = await this.get({
      projectTitle,
    }).getByTestId('nc-sidebar-add-project-entity');

    if (visible) {
      await addBtn.hover({
        force: true,
      });
      await expect(addBtn).toBeVisible();
    } else await expect(addBtn).toHaveCount(0);
  }

  async verifyProjectOptions({
    projectTitle,
    renameVisible,
    starredVisible,
    duplicateVisible,
    relationsVisible,
    restApisVisible,
    importVisible,
    settingsVisible,
    deleteVisible,
    copyProjectInfoVisible,
  }: {
    projectTitle: string;
    renameVisible?: boolean;
    starredVisible?: boolean;
    duplicateVisible?: boolean;
    relationsVisible?: boolean;
    restApisVisible?: boolean;
    importVisible?: boolean;
    settingsVisible?: boolean;
    deleteVisible?: boolean;
    copyProjectInfoVisible?: boolean;
  }) {
    const renameLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-rename');

    if (renameVisible) await renameLocator.isVisible();
    else await expect(renameLocator).toHaveCount(0);

    const starredLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-starred');

    if (starredVisible) await expect(starredLocator).toBeVisible();
    else await expect(starredLocator).toHaveCount(0);

    const duplicateLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-duplicate');

    if (duplicateVisible) await expect(duplicateLocator).toBeVisible();
    else await expect(duplicateLocator).toHaveCount(0);

    const relationsLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-relations');

    if (relationsVisible) await expect(relationsLocator).toBeVisible();
    else await expect(relationsLocator).toHaveCount(0);

    const restApisLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-rest-apis');

    if (restApisVisible) await expect(restApisLocator).toBeVisible();
    else await expect(restApisLocator).toHaveCount(0);

    const importLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-import');

    if (importVisible) await expect(importLocator).toBeVisible();
    else await expect(importLocator).toHaveCount(0);

    const settingsLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-settings');

    if (settingsVisible) await expect(settingsLocator).toBeVisible();
    else await expect(settingsLocator).toHaveCount(0);

    const deleteLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-delete');

    if (deleteVisible) await expect(deleteLocator).toBeVisible();
    else await expect(deleteLocator).toHaveCount(0);

    const copyProjectInfoLocator = await this.rootPage
      .getByTestId(`nc-sidebar-project-${projectTitle}-options`)
      .getByTestId('nc-sidebar-project-copy-project-info');

    if (copyProjectInfoVisible) await expect(copyProjectInfoLocator).toBeVisible();
    else await expect(copyProjectInfoLocator).toHaveCount(0);
  }
}
