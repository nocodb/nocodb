import BasePage from '../../../Base';
import { SidebarPage } from '..';
import { expect } from '@playwright/test';

export class SidebarProjectNodeObject extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(parent: SidebarPage) {
    super(parent.rootPage);

    this.sidebar = parent;
  }

  get({ baseTitle }: { baseTitle: string }) {
    return this.sidebar.get().getByTestId(`nc-sidebar-base-title-${baseTitle}`);
  }

  async click({ baseTitle }: { baseTitle: string }) {
    await this.get({
      baseTitle,
    }).click();
  }

  async clickOptions({ baseTitle }: { baseTitle: string }) {
    await this.get({
      baseTitle,
    }).hover();

    await this.get({
      baseTitle,
    })
      .getByTestId(`nc-sidebar-context-menu`)
      .click();
  }

  async verifyTableAddBtn({ baseTitle, visible }: { baseTitle: string; visible: boolean }) {
    await this.get({
      baseTitle,
    }).waitFor({ state: 'visible' });
    await this.get({
      baseTitle,
    }).scrollIntoViewIfNeeded();
    await this.get({
      baseTitle,
    }).hover();

    const addBtn = this.get({
      baseTitle,
    }).getByTestId('nc-sidebar-add-base-entity');

    if (visible) {
      await expect(addBtn).toBeVisible();
    } else await expect(addBtn).toHaveCount(0);
  }

  async verifyProjectOptions({
    baseTitle,
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
    baseTitle: string;
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
    await this.get({
      baseTitle,
    }).waitFor({ state: 'visible' });
    await this.get({
      baseTitle,
    }).scrollIntoViewIfNeeded();
    await this.get({
      baseTitle,
    }).hover();

    const renameLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-rename');

    if (renameVisible) await renameLocator.isVisible();
    else await expect(renameLocator).toHaveCount(0);

    const starredLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-starred');

    if (starredVisible) await expect(starredLocator).toBeVisible();
    else await expect(starredLocator).toHaveCount(0);

    const duplicateLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-duplicate');

    if (duplicateVisible) await expect(duplicateLocator).toBeVisible();
    else await expect(duplicateLocator).toHaveCount(0);

    const relationsLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-relations');

    if (relationsVisible) await expect(relationsLocator).toBeVisible();
    else await expect(relationsLocator).toHaveCount(0);

    const restApisLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-rest-apis');

    if (restApisVisible) await expect(restApisLocator).toBeVisible();
    else await expect(restApisLocator).toHaveCount(0);

    const importLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-import');

    if (importVisible) await expect(importLocator).toBeVisible();
    else await expect(importLocator).toHaveCount(0);

    const settingsLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-settings');

    if (settingsVisible) await expect(settingsLocator).toBeVisible();
    else await expect(settingsLocator).toHaveCount(0);

    const deleteLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-delete');

    if (deleteVisible) await expect(deleteLocator).toBeVisible();
    else await expect(deleteLocator).toHaveCount(0);

    const copyProjectInfoLocator = await this.rootPage
      .getByTestId(`nc-sidebar-base-${baseTitle}-options`)
      .getByTestId('nc-sidebar-base-copy-base-info');

    if (copyProjectInfoVisible) await expect(copyProjectInfoLocator).toBeVisible();
    else await expect(copyProjectInfoLocator).toHaveCount(0);

    await this.get({
      baseTitle,
    }).click();
  }
}
