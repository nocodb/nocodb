import { GridPage } from '../Grid';
import BasePage from '../../Base';
import { expect, Locator } from '@playwright/test';

export class ColumnHeaderPageObject extends BasePage {
  readonly grid: GridPage;

  readonly btn_addColumn: Locator;
  readonly btn_selectAll: Locator;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;

    this.btn_addColumn = this.get().locator(`.nc-grid-add-edit-column`);
    this.btn_selectAll = this.get().locator(`[data-testid="nc-check-all"]`);
  }

  get() {
    return this.rootPage.locator('.nc-grid-header');
  }

  async getColumnHeader({ title }: { title: string }) {
    return this.get().locator(`th[data-title="${title}"]`);
  }

  async getColumnHeaderContextMenu({ title }: { title: string }) {
    return (await this.getColumnHeader({ title })).locator(`.nc-ui-dt-dropdown`);
  }

  async verifyLockMode() {
    // add column button
    await expect(this.btn_addColumn).toBeVisible({ visible: false });

    // column header context menu
    expect(await this.get().locator('.nc-ui-dt-dropdown').count()).toBe(0);
  }

  async verifyPersonalMode() {
    // add column button
    await expect(this.btn_addColumn).toBeVisible({ visible: false });

    // column header context menu
    expect(await this.get().locator('.nc-ui-dt-dropdown').count()).toBe(0);
  }

  async verifyCollaborativeMode() {
    // add column button
    await expect(this.btn_addColumn).toBeVisible({ visible: true });

    // column header context menu
    expect(await this.get().locator('.nc-ui-dt-dropdown').count()).toBeGreaterThan(1);
  }
}
