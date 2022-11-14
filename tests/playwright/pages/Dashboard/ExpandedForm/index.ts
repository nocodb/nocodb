import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';

export class ExpandedFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly copyUrlButton: Locator;
  readonly toggleCommentsButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewTableButton = this.dashboard.get().locator('.nc-add-new-table');
    this.copyUrlButton = this.dashboard.get().locator('.nc-copy-row-url:visible');
    this.toggleCommentsButton = this.dashboard.get().locator('.nc-toggle-comments:visible');
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-expanded-form`);
  }

  async getShareRowUrl() {
    await this.copyUrlButton.click();
    await this.verifyToast({ message: 'Copied to clipboard' });
    return await this.getClipboardText();
  }

  async gotoUsingUrlAndRowId({ rowId }: { rowId: string }) {
    const url = await this.dashboard.rootPage.url();
    const expandedFormUrl = '/' + url.split('/').slice(3).join('/').split('?')[0] + `?rowId=${rowId}`;
    await this.rootPage.goto(expandedFormUrl);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async fillField({ columnTitle, value, type = 'text' }: { columnTitle: string; value: string; type?: string }) {
    const field = this.get().locator(`[data-testid="nc-expand-col-${columnTitle}"]`);
    await field.hover();
    switch (type) {
      case 'text':
        await field.locator('input').fill(value);
        break;
      case 'belongsTo':
        await field.locator('.nc-action-icon').click();
        await this.dashboard.linkRecord.select(value);
        break;
      case 'hasMany':
      case 'manyToMany':
        await field.locator(`[data-testid="nc-child-list-button-link-to"]`).click();
        await this.dashboard.linkRecord.select(value);
        break;
    }
  }

  async save({
    waitForRowsData = true,
  }: {
    waitForRowsData?: boolean;
  } = {}) {
    const saveRowAction = this.get().locator('button:has-text("Save Row")').click();
    if (waitForRowsData) {
      await this.waitForResponse({
        uiAction: saveRowAction,
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['pageInfo'],
      });
    } else {
      await this.waitForResponse({
        uiAction: saveRowAction,
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['POST'],
      });
    }

    await this.get().press('Escape');
    await this.get().waitFor({ state: 'hidden' });
    await this.verifyToast({ message: `updated successfully.` });
    await this.rootPage.locator('[data-testid="grid-load-spinner"]').waitFor({ state: 'hidden' });
  }

  async verify({ header, url }: { header: string; url: string }) {
    await expect(this.get().locator(`.nc-expanded-form-header`).last()).toContainText(header);
    await expect.poll(() => this.rootPage.url()).toContain(url);
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
    await this.get().waitFor({ state: 'hidden' });
  }

  async cancel() {
    await this.get().locator('button:has-text("Cancel")').last().click();
  }

  async openChildCard(param: { column: string; title: string }) {
    const childList = await this.get().locator(`[data-testid="nc-expand-col-${param.column}"]`);
    await childList.locator(`.ant-card:has-text("${param.title}")`).click();
  }

  async verifyCount({ count }: { count: number }) {
    return await expect(this.rootPage.locator(`.nc-drawer-expanded-form .ant-drawer-content`)).toHaveCount(count);
  }

  async validateRoleAccess(param: { role: string }) {
    if (param.role === 'commenter' || param.role === 'viewer') {
      await expect(await this.get().locator('button:has-text("Save Row")')).toBeDisabled();
    } else {
      await expect(await this.get().locator('button:has-text("Save Row")')).toBeEnabled();
    }
    if (param.role === 'viewer') {
      await expect(await this.toggleCommentsButton).toHaveCount(0);
    } else {
      await expect(await this.toggleCommentsButton).toHaveCount(1);
    }
    // press escape to close the expanded form
    await this.rootPage.keyboard.press('Escape');
  }
}
