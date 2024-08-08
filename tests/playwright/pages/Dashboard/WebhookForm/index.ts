import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { ToolbarPage } from '../common/Toolbar';
import { getTextExcludeIconText } from '../../../tests/utils/general';
import { TopbarPage } from '../common/Topbar';

export class WebhookFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly topbar: TopbarPage;
  readonly toolbar: ToolbarPage;
  readonly addNewButton: Locator;
  readonly saveButton: Locator;
  readonly testButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = dashboard.grid.toolbar;
    this.topbar = dashboard.grid.topbar;
    this.addNewButton = this.dashboard.get().locator('.nc-btn-create-webhook');
    this.saveButton = this.get().getByTestId('nc-save-webhook');
    this.testButton = this.get().locator('button:has-text("Test Webhook")');
  }

  get() {
    return this.rootPage.locator(`.nc-modal-webhook-create-edit`);
  }

  async create({ title, event, url = 'http://localhost:9090/hook' }: { title: string; event: string; url?: string }) {
    await this.dashboard.grid.topbar.openDetailedTab();
    await this.dashboard.details.clickWebhooksTab();
    // wait for tab transition
    await this.rootPage.waitForTimeout(200);
    await this.dashboard.details.clickAddWebhook();
    await this.get().waitFor({ state: 'visible' });

    await this.configureHeader({
      key: 'Content-Type',
      value: 'application/json',
    });
    await this.configureWebhook({ title, event, url });
    await this.save();
    await this.close();
  }

  async configureWebhook({ title, event, url }: { title?: string; event?: string; url?: string }) {
    if (title) {
      await this.get().locator(`.nc-text-field-hook-title`).fill(title);
    }
    if (event) {
      await this.get().locator(`.nc-text-field-hook-event`).click();
      const modal = this.rootPage.locator(`.nc-dropdown-webhook-event`);
      await modal.locator(`.ant-select-item:has-text("${event}")`).click();
    }
    if (url) {
      await this.get().locator(`.nc-text-field-hook-url-path`).fill(url);
    }
  }

  async addCondition({
    column,
    operator,
    value,
    save,
  }: {
    column: string;
    operator: string;
    value: string;
    save: boolean;
  }) {
    await this.get().locator(`.nc-check-box-hook-condition`).click();
    const modal = this.get().locator(`.menu-filter-dropdown`).last();

    await modal.locator(`button:has-text("Add Filter")`).first().click();

    await modal.locator('.nc-filter-field-select').waitFor({ state: 'visible', timeout: 4000 });
    await modal.locator('.nc-filter-field-select').click();
    const modalField = this.dashboard.rootPage.locator('.nc-dropdown-toolbar-field-list:visible');
    await modalField.locator(`.ant-select-item:has-text("${column}")`).click();

    await modal.locator('.nc-filter-operation-select').click();
    const modalOp = this.dashboard.rootPage.locator('.nc-dropdown-filter-comp-op:visible');
    await modalOp.locator(`.ant-select-item:has-text("${operator}")`).click();

    if (operator != 'is null' && operator != 'is not null') {
      await modal.locator('.nc-filter-value-select > input').fill(value);
    }

    if (save) {
      await this.save();
      await this.close();
    }
  }

  async deleteCondition(p: { save: boolean }) {
    await this.get().locator(`.nc-filter-item-remove-btn`).click();
    if (p.save) {
      await this.save();
      await this.close();
    }
  }

  async save() {
    const saveAction = async () => await this.saveButton.click();

    await this.waitForResponse({
      uiAction: saveAction,
      requestUrlPathToMatch: '/hooks',
      httpMethodsToMatch: ['POST', 'PATCH'],
    });

    // await this.verifyToast({ message: 'Webhook details updated successfully' });
  }

  async test() {
    await this.testButton.click();
    await this.verifyToast({ message: 'Webhook tested successfully' });
  }

  async delete({ index, wfr = true }: { index: number; wfr?: boolean }) {
    await this.dashboard.grid.topbar.openDetailedTab({ waitForResponse: wfr });
    await this.dashboard.details.clickWebhooksTab();
    await this.dashboard.details.webhook.deleteHook({ index });
    await this.rootPage.locator('div.ant-modal.active').locator('button:has-text("Delete")').click();
  }

  async close() {
    // type esc key
    // await this.get().press('Escape');
    // await this.get().waitFor({ state: 'hidden' });
    await this.dashboard.grid.topbar.openDataTab();
  }

  async open({ index }: { index: number }) {
    await this.dashboard.grid.topbar.openDetailedTab();
    await this.dashboard.details.clickWebhooksTab();

    const rowItem = await this.dashboard.details.webhook.getItem({ index });
    await rowItem.waitFor({ state: 'visible' });
    await rowItem.scrollIntoViewIfNeeded();

    await rowItem.click({
      force: true,
    });

    await this.get().waitFor({ state: 'visible' });
  }

  async openForm({ index }: { index: number }) {
    await this.dashboard.get().locator(`.nc-hook`).nth(index).click();
  }

  async click({ index }: { index: number }) {
    await this.dashboard.get().locator(`.nc-hook`).nth(index).click();
  }

  async configureHeader({ key, value }: { key: string; value: string }) {
    // hardcode "Content-type: application/json"
    await this.get().locator(`.ant-tabs-tab-btn:has-text("Headers")`).click();
    await this.rootPage.waitForTimeout(500);

    await this.get().locator('.nc-input-hook-header-key input').click();
    await this.rootPage.waitForTimeout(500);

    // kludge, as the dropdown is not visible even after scroll into view
    await this.rootPage.locator('.nc-input-hook-header-key input').pressSequentially(key);
    await this.rootPage
      .locator('.ant-select-dropdown:visible')
      .locator(`.ant-select-item:has-text("${key}")`)
      .scrollIntoViewIfNeeded();
    await this.rootPage
      .locator('.ant-select-dropdown:visible')
      .locator(`.ant-select-item:has-text("${key}")`)
      .click({ force: true });

    await this.get().locator('.nc-webhook-header-value-input').clear();
    await this.get().locator('.nc-webhook-header-value-input').type(value);
    await this.get().press('Enter');

    // find out if the checkbox is already checked
    const isChecked = await this.get()
      .locator('.nc-hook-header-checkbox')
      .locator('input.ant-checkbox-input')
      .isChecked();
    if (!isChecked) await this.get().locator('.nc-hook-header-checkbox').locator('input.ant-checkbox-input').click();
  }

  async verifyForm({
    title,
    hookEvent,
    url,
    notificationType,
    urlMethod,
    condition,
  }: {
    title: string;
    hookEvent: string;
    url: string;
    notificationType: string;
    urlMethod: string;
    condition: boolean;
  }) {
    await expect.poll(async () => await this.get().locator('input.nc-text-field-hook-title').inputValue()).toBe(title);
    await expect(this.get().locator('.nc-text-field-hook-event >> .ant-select-selection-item')).toHaveText(hookEvent);

    const locator = this.get().locator('.nc-select-hook-notification-type >> .ant-select-selection-item');
    const text = await getTextExcludeIconText(locator);
    expect(text).toBe(notificationType);

    await expect(this.get().locator('.nc-select-hook-url-method >> .ant-select-selection-item')).toHaveText(urlMethod);
    await expect.poll(async () => await this.get().locator('input.nc-text-field-hook-url-path').inputValue()).toBe(url);

    const conditionCheckbox = this.get().locator('label.nc-check-box-hook-condition >> input[type="checkbox"]');
    if (condition) {
      await expect(conditionCheckbox).toBeChecked();
    } else {
      await expect(conditionCheckbox).not.toBeChecked();
    }
  }

  async goBackFromForm() {
    await this.get().locator('svg.nc-icon-hook-navigate-left').click();
  }
}
