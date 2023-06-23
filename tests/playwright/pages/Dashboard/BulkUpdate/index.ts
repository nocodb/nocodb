import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { DateTimeCellPageObject } from '../common/Cell/DateTimeCell';
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
    this.formHeader = this.dashboard.get().locator('.nc-bulk-update-form-header');
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
    const inactiveColumns = await this.columnsDrawer.locator('.ant-card');
    return inactiveColumns.nth(index);
  }

  async getActiveColumn(index: number) {
    const activeColumns = await this.form.locator('[data-testid="nc-form-fields"]');
    return activeColumns.nth(index);
  }

  async getInactiveColumns() {
    const inactiveColumns = await this.columnsDrawer.locator('.ant-card');
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
    const activeColumns = await this.form.locator('[data-testid="nc-form-fields"]');
    const activeColumnsCount = await activeColumns.count();
    const activeColumnsTitles = [];
    // get title for each active column
    for (let i = 0; i < activeColumnsCount; i++) {
      const title = await getTextExcludeIconText(activeColumns.nth(i).locator('[data-testid="nc-form-input-label"]'));
      activeColumnsTitles.push(title);
    }

    return activeColumnsTitles;
  }

  async removeField(index: number) {
    const removeFieldButton = await this.form.locator('[data-testid="nc-form-fields"]');
    const removeFieldButtonCount = await removeFieldButton.count();
    await removeFieldButton.nth(index).locator('[data-testid="nc-form-fields-close-icon"]').click();
    const newRemoveFieldButtonCount = await removeFieldButton.count();
    expect(newRemoveFieldButtonCount).toBe(removeFieldButtonCount - 1);
  }

  async addField(index: number) {
    const addFieldButton = await this.columnsDrawer.locator('.ant-card');
    const addFieldButtonCount = await addFieldButton.count();
    await addFieldButton.nth(index).click();
    const newAddFieldButtonCount = await addFieldButton.count();
    expect(newAddFieldButtonCount).toBe(addFieldButtonCount - 1);
  }

  //////////////////////////////////////////////////////////////////////////////

  async fillField({ columnTitle, value, type = 'text' }: { columnTitle: string; value: string; type?: string }) {
    const field = this.form.locator(`[data-testid="nc-form-input-${columnTitle}"]`);
    await field.hover();
    await field.click();
    switch (type) {
      case 'text':
        await field.locator('input').waitFor();
        await field.locator('input').fill(value);
        break;
      case 'longText':
        await field.locator('textarea').waitFor();
        await field.locator('textarea').fill(value);
        break;
    }
  }

  async save({
    awaitResponse = true,
  }: {
    awaitResponse?: boolean;
  } = {}) {
    await this.bulkUpdateButton.click();
    const confirmModal = await this.rootPage.locator('.ant-modal-confirm');

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
