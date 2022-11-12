import { expect, Page } from '@playwright/test';
import { GridPage } from '..';
import BasePage from '../../../Base';
import { SelectOptionColumnPageObject } from './SelectOptionColumn';

export class ColumnPageObject extends BasePage {
  readonly grid: GridPage;
  readonly selectOption: SelectOptionColumnPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.selectOption = new SelectOptionColumnPageObject(this);
  }

  get() {
    return this.rootPage.locator('form[data-testid="add-or-edit-column"]');
  }

  async create({
    title,
    type = 'SingleLineText',
    formula = '',
    childTable = '',
    childColumn = '',
    relationType = '',
    rollupType = '',
    format = '',
  }: {
    title: string;
    type?: string;
    formula?: string;
    childTable?: string;
    childColumn?: string;
    relationType?: string;
    rollupType?: string;
    format?: string;
  }) {
    await this.grid.get().locator('.nc-column-add').click();
    await this.rootPage.waitForTimeout(500);
    await this.fillTitle({ title });
    await this.rootPage.waitForTimeout(500);
    await this.selectType({ type });
    await this.rootPage.waitForTimeout(500);

    switch (type) {
      case 'SingleTextLine':
        break;
      case 'SingleSelect':
      case 'MultiSelect':
        await this.selectOption.addOption({
          index: 0,
          option: 'Option 1',
          skipColumnModal: true,
        });
        await this.selectOption.addOption({
          index: 1,
          option: 'Option 2',
          skipColumnModal: true,
        });
        break;
      case 'Duration':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: format,
          })
          .click();
        break;
      case 'Formula':
        await this.get().locator('.nc-formula-input').fill(formula);
        break;
      case 'Lookup':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childColumn,
          })
          .click();
        break;
      case 'Rollup':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.nc-dropdown-relation-column >> .ant-select-item`, {
            hasText: childColumn,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(3).click();
        await this.rootPage
          .locator(`.nc-dropdown-rollup-function >> .ant-select-item`, {
            hasText: rollupType,
          })
          .nth(0)
          .click();
        break;
      case 'LinkToAnotherRecord':
        await this.get()
          .locator('.nc-ltar-relation-type >> .ant-radio')
          .nth(relationType === 'Has Many' ? 0 : 1)
          .click();
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage.locator(`.nc-ltar-child-table >> input[type="search"]`).fill(childTable);
        await this.rootPage
          .locator(`.nc-dropdown-ltar-child-table >> .ant-select-item`, {
            hasText: childTable,
          })
          .nth(0)
          .click();
        break;
      default:
        break;
    }

    await this.save();
  }

  async fillTitle({ title }: { title: string }) {
    await this.get().locator('.nc-column-name-input').fill(title);
  }

  async selectType({ type }: { type: string }) {
    await this.get().locator('.ant-select-selector > .ant-select-selection-item').click();

    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

    // Select column type
    await this.rootPage.locator(`text=${type}`).nth(1).click();
  }

  async delete({ title }: { title: string }) {
    await this.grid.get().locator(`th[data-title="${title}"] >> svg.ant-dropdown-trigger`).click();
    // await this.rootPage.locator('li[role="menuitem"]:has-text("Delete")').waitFor();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Delete")').click();

    await this.rootPage.locator('button:has-text("Delete")').click();

    // wait till modal is closed
    await this.rootPage.locator('.nc-modal-column-delete').waitFor({ state: 'hidden' });
  }

  async openEdit({
    title,
    type = 'SingleLineText',
    formula = '',
    format,
  }: {
    title: string;
    type?: string;
    formula?: string;
    format?: string;
  }) {
    await this.grid.get().locator(`th[data-title="${title}"] .nc-ui-dt-dropdown`).click();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Edit")').click();

    await this.get().waitFor({ state: 'visible' });

    switch (type) {
      case 'Formula':
        await this.get().locator('.nc-formula-input').fill(formula);
        break;
      case 'Duration':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: format,
          })
          .click();
        break;
      default:
        break;
    }
  }

  async save({ isUpdated }: { isUpdated?: boolean } = {}) {
    await this.waitForResponse({
      uiAction: this.get().locator('button:has-text("Save")').click(),
      requestUrlPathToMatch: 'api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
      responseJsonMatcher: json => json['pageInfo'],
    });

    await this.verifyToast({
      message: isUpdated ? 'Column updated' : 'Column created',
    });
    await this.get().waitFor({ state: 'hidden' });
    await this.rootPage.waitForTimeout(200);
  }

  async verify({ title, isVisible = true }: { title: string; isVisible?: boolean }) {
    if (!isVisible) {
      return await expect(await this.rootPage.locator(`th[data-title="${title}"]`)).not.toBeVisible();
    }
    await await expect(this.rootPage.locator(`th[data-title="${title}"]`)).toContainText(title);
  }

  async verifyRoleAccess(param: { role: string }) {
    await expect(this.grid.get().locator('.nc-column-add:visible')).toHaveCount(param.role === 'creator' ? 1 : 0);
    await expect(this.grid.get().locator('.nc-ui-dt-dropdown:visible')).toHaveCount(param.role === 'creator' ? 3 : 0);

    if (param.role === 'creator') {
      await this.grid.get().locator('.nc-ui-dt-dropdown:visible').first().click();
      await expect(this.rootPage.locator('.nc-dropdown-column-operations')).toHaveCount(1);
      await this.grid.get().locator('.nc-ui-dt-dropdown:visible').first().click();
    }
  }
}
