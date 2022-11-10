import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { ToolbarPage } from '../common/Toolbar';

export class WebhookFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly addNewButton: Locator;
  readonly saveButton: Locator;
  readonly testButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = dashboard.grid.toolbar;
    this.addNewButton = this.dashboard.get().locator('.nc-btn-create-webhook');
    this.saveButton = this.get().locator('button:has-text("Save")');
    this.testButton = this.get().locator('button:has-text("Test Webhook")');
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-webhook-body`);
  }

  // todo: Removing opening webhook drawer logic as it belongs to `Toolbar` page
  async create({ title, event, url = 'http://localhost:9090/hook' }: { title: string; event: string; url?: string }) {
    await this.toolbar.clickActions();
    await this.toolbar.actions.click('Webhooks');

    await this.addNewButton.click();
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
    const modal = await this.get().locator(`.menu-filter-dropdown`).last();

    // todo: All delays are for api calls that filter does, which rerenders
    await this.rootPage.waitForTimeout(1000);

    await modal.locator(`button:has-text("Add Filter")`).click();

    await this.rootPage.waitForTimeout(1500);

    await modal.locator('.nc-filter-field-select').click();
    const modalField = await this.dashboard.rootPage.locator('.nc-dropdown-toolbar-field-list:visible');
    await modalField.locator(`.ant-select-item:has-text("${column}")`).click();

    await this.rootPage.waitForTimeout(1500);

    await modal.locator('.nc-filter-operation-select').click();
    const modalOp = await this.dashboard.rootPage.locator('.nc-dropdown-filter-comp-op:visible');
    await modalOp.locator(`.ant-select-item:has-text("${operator}")`).click();

    await this.rootPage.waitForTimeout(1500);

    if (operator != 'is null' && operator != 'is not null') {
      await modal.locator('input.nc-filter-value-select').fill(value);
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
    const saveAction = this.saveButton.click();
    await this.waitForResponse({
      uiAction: saveAction,
      requestUrlPathToMatch: '/hooks',
      httpMethodsToMatch: ['POST', 'PATCH'],
    });
    await this.verifyToast({ message: 'Webhook details updated successfully' });
  }

  async test() {
    await this.testButton.click();
    await this.verifyToast({ message: 'Webhook tested successfully' });
  }

  async delete({ index }: { index: number }) {
    await this.toolbar.clickActions();
    await this.toolbar.actions.click('Webhooks');

    await this.get().locator(`.nc-hook-delete-icon`).nth(index).click();
    await this.verifyToast({ message: 'Hook deleted successfully' });

    // click escape to close the drawer
    await this.get().press('Escape');
  }

  async close() {
    // type esc key
    await this.get().press('Escape');
  }

  async open({ index }: { index: number }) {
    await this.toolbar.clickActions();
    await this.toolbar.actions.click('Webhooks');
    await this.dashboard.get().locator(`.nc-hook`).nth(index).click();
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

    await this.get().locator('.nc-input-hook-header-key >> input').fill(key);
    await this.rootPage.locator(`.ant-select-item:has-text("${key}")`).click();

    await this.get().locator('.nc-input-hook-header-value').type(value);
    await this.get().press('Enter');

    await this.get().locator('.nc-hook-header-tab-checkbox').locator('input.ant-checkbox-input').click();
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
    await expect(this.get().locator('.nc-select-hook-notification-type >> .ant-select-selection-item')).toHaveText(
      notificationType
    );
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
