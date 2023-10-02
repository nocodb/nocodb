import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { getTextExcludeIconText } from '../../../tests/utils/general';

export class BulkUpdatePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly bulkUpdateButton: Locator;
  readonly formHeader: Locator;
  readonly columnsDrawer: Locator;
  readonly form: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.bulkUpdateButton = this.dashboard.get().locator('.nc-bulk-update-save-btn');
    this.formHeader = this.dashboard.get().locator('.nc-bulk-update-bulk-update-header');
    this.columnsDrawer = this.dashboard.get().locator('.nc-columns-drawer');
    this.form = this.dashboard.get().locator('div.form');
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-bulk-update`);
  }

  async close() {
    return this.dashboard.rootPage.keyboard.press('Escape');
  }

  async getInactiveColumn(index: number) {
    const inactiveColumns = this.columnsDrawer.locator('.ant-card');
    return inactiveColumns.nth(index);
  }

  async getActiveColumn(index: number) {
    const activeColumns = this.form.locator('[data-testid="nc-bulk-update-fields"]');
    return activeColumns.nth(index);
  }

  async getInactiveColumns() {
    const inactiveColumns = this.columnsDrawer.locator('.ant-card');
    const inactiveColumnsCount = await inactiveColumns.count();
    const inactiveColumnsTitles = [];
    // get title for each inactive column
    for (let i = 0; i < inactiveColumnsCount; i++) {
      const title = await getTextExcludeIconText(inactiveColumns.nth(i).locator('.ant-card-body'));
      inactiveColumnsTitles.push(title);
    }

    return inactiveColumnsTitles;
  }

  async getActiveColumns() {
    const activeColumns = this.form.locator('[data-testid="nc-bulk-update-fields"]');
    const activeColumnsCount = await activeColumns.count();
    const activeColumnsTitles = [];
    // get title for each active column
    for (let i = 0; i < activeColumnsCount; i++) {
      const title = await getTextExcludeIconText(
        activeColumns.nth(i).locator('[data-testid="nc-bulk-update-input-label"]')
      );
      activeColumnsTitles.push(title);
    }

    return activeColumnsTitles;
  }

  async removeField(index: number) {
    const removeFieldButton = this.form.locator('[data-testid="nc-bulk-update-fields"]');
    const removeFieldButtonCount = await removeFieldButton.count();
    await removeFieldButton.nth(index).locator('[data-testid="nc-bulk-update-fields-remove-icon"]').click();
    const newRemoveFieldButtonCount = await removeFieldButton.count();
    expect(newRemoveFieldButtonCount).toBe(removeFieldButtonCount - 1);
  }

  async addField(index: number) {
    const addFieldButton = this.columnsDrawer.locator('.ant-card');
    const addFieldButtonCount = await addFieldButton.count();
    await addFieldButton.nth(index).click();
    const newAddFieldButtonCount = await addFieldButton.count();
    expect(newAddFieldButtonCount).toBe(addFieldButtonCount - 1);
  }

  //////////////////////////////////////////////////////////////////////////////

  async fillField({ columnTitle, value, type = 'text' }: { columnTitle: string; value: string; type?: string }) {
    let picker = null;
    const field = this.form.locator(`[data-testid="nc-bulk-update-input-${columnTitle}"]`);
    await field.scrollIntoViewIfNeeded();
    await field.hover();
    if (type !== 'checkbox' && type !== 'attachment') {
      await field.click();
    }
    switch (type) {
      case 'text':
        await field.locator('input').waitFor();
        await field.locator('input').fill(value);
        break;
      case 'longText':
        await field.locator('textarea').waitFor();
        await field.locator('textarea').fill(value);
        break;
      case 'rating':
        await field
          .locator('.ant-rate-star')
          .nth(Number(value) - 1)
          .click();
        break;
      case 'year':
        picker = this.rootPage.locator('.ant-picker-dropdown.active');
        await picker.waitFor();
        await picker.locator(`td[title="${value}"]`).click();
        break;
      case 'time':
        picker = this.rootPage.locator('.ant-picker-dropdown.active');
        await picker.waitFor();
        // eslint-disable-next-line no-case-declarations
        const time = value.split(':');
        // eslint-disable-next-line no-case-declarations
        const timePanel = picker.locator('.ant-picker-time-panel-column');
        await timePanel.nth(0).locator('li').nth(+time[0]).click();
        await timePanel.nth(1).locator('li').nth(+time[1]).click();
        await picker.locator('.ant-picker-ok').click();
        break;
      case 'singleSelect':
        picker = this.rootPage.locator('.ant-select-dropdown.active');
        await picker.waitFor();
        await picker.locator(`.nc-select-option-SingleSelect-${value}`).click();
        break;
      case 'multiSelect':
        picker = this.rootPage.locator('.ant-select-dropdown.active');
        await picker.waitFor();
        for (const val of value.split(',')) {
          await picker.locator(`.nc-select-option-MultiSelect-${val}`).click();
        }
        break;
      case 'checkbox':
        if (value === 'true') {
          await field.locator('.nc-checkbox').click();
        }
        break;
      case 'attachment':
        // eslint-disable-next-line no-case-declarations
        const attachFileAction = field.locator('[data-testid="attachment-cell-file-picker-button"]').click();
        await this.attachFile({ filePickUIAction: attachFileAction, filePath: [value] });
        break;
      case 'date':
        {
          const values = value.split('-');
          const { year, month, day } = { year: values[0], month: values[1], day: values[2] };
          picker = this.rootPage.locator('.ant-picker-dropdown.active');
          const monthBtn = picker.locator('.ant-picker-month-btn');
          const yearBtn = picker.locator('.ant-picker-year-btn');

          await yearBtn.click();
          await picker.waitFor();
          await picker.locator(`td[title="${year}"]`).click();

          await monthBtn.click();
          await picker.waitFor();
          await picker.locator(`td[title="${year}-${month}"]`).click();

          await picker.waitFor();
          await picker.locator(`td[title="${year}-${month}-${day}"]`).click();
        }
        break;
    }
  }

  async save({
    awaitResponse = true,
  }: {
    awaitResponse?: boolean;
  } = {}) {
    await this.bulkUpdateButton.click();
    const confirmModal = this.rootPage.locator('.ant-modal');

    const saveRowAction = () => confirmModal.locator('.ant-btn-primary').click();
    if (!awaitResponse) {
      await saveRowAction();
    } else {
      await this.waitForResponse({
        uiAction: saveRowAction,
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['pageInfo'],
      });
    }

    await this.get().waitFor({ state: 'hidden' });
    await this.rootPage.locator('[data-testid="grid-load-spinner"]').waitFor({ state: 'hidden' });
  }
}
