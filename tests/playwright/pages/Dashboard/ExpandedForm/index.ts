import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { DateTimeCellPageObject } from '../common/Cell/DateTimeCell';
import { getTextExcludeIconText } from '../../../tests/utils/general';

export class ExpandedFormPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly duplicateRowButton: Locator;
  readonly deleteRowButton: Locator;

  readonly btn_save: Locator;
  readonly btn_moreActions: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.addNewTableButton = this.dashboard.get().locator('.nc-add-new-table');
    this.duplicateRowButton = this.dashboard.get().locator('.nc-duplicate-row:visible');
    this.deleteRowButton = this.dashboard.get().locator('.nc-delete-row:visible');

    this.btn_save = this.dashboard.get().locator('button.nc-expand-form-save-btn');
    this.btn_moreActions = this.get().locator('.nc-expand-form-more-actions');
  }

  get() {
    return this.dashboard.get().locator(`.nc-drawer-expanded-form`);
  }

  async click3DotsMenu(menuItem: string) {
    await this.get().locator('.nc-expand-form-more-actions').last().click();

    // add delay; wait for the menu to appear
    await this.rootPage.waitForTimeout(500);

    const popUpMenu = this.rootPage.locator('.ant-dropdown');
    await popUpMenu.locator(`.ant-dropdown-menu-item:has-text("${menuItem}")`).click();
  }

  async clickDuplicateRow() {
    await this.click3DotsMenu('Duplicate Record');
    // wait for loader to disappear
    // await this.dashboard.waitForLoaderToDisappear();
    await this.rootPage.waitForTimeout(2000);
  }

  async clickDeleteRow() {
    await this.click3DotsMenu('Delete Record');
    await this.rootPage.locator('.ant-btn-danger:has-text("Delete Record")').click();
  }

  async isDisabledDuplicateRow() {
    const isDisabled = this.duplicateRowButton;
    return await isDisabled.count();
  }

  async isDisabledDeleteRow() {
    const isDisabled = this.deleteRowButton;
    return await isDisabled.count();
  }

  async gotoUsingUrlAndRowId({ rowId }: { rowId: string }) {
    const url = this.dashboard.rootPage.url();
    const expandedFormUrl = '/' + url.split('/').slice(3).join('/').split('?')[0] + `?rowId=${rowId}`;
    await this.rootPage.goto(expandedFormUrl);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async fillField({ columnTitle, value, type = 'text' }: { columnTitle: string; value: string; type?: string }) {
    const field = this.get().locator(`[data-testid="nc-expand-col-${columnTitle}"]`);
    switch (type) {
      case 'text':
        await field.locator('input').fill(value);
        break;
      case 'geodata': {
        const [lat, long] = value.split(',');
        await this.rootPage.locator(`[data-testid="nc-geo-data-set-location-button"]`).click();
        await this.rootPage.locator(`[data-testid="nc-geo-data-latitude"]`).fill(lat);
        await this.rootPage.locator(`[data-testid="nc-geo-data-longitude"]`).fill(long);
        await this.rootPage.locator(`[data-testid="nc-geo-data-save"]`).click();
        break;
      }
      case 'belongsTo':
        await field.locator('.nc-virtual-cell').hover();
        await field.locator('.nc-action-icon').click();
        await this.dashboard.linkRecord.select(value);
        break;
      case 'hasMany':
      case 'manyToMany':
        await field.locator('.nc-virtual-cell').hover();
        await field.locator('.nc-action-icon').click();
        await this.dashboard.linkRecord.select(value);
        break;
      case 'dateTime':
        await field.locator('.nc-cell').click();
        // eslint-disable-next-line no-case-declarations
        const dateTimeObj = new DateTimeCellPageObject(this.dashboard.grid.cell);
        await dateTimeObj.selectDate({ date: value.slice(0, 10) });
        await dateTimeObj.selectTime({ hour: +value.slice(11, 13), minute: +value.slice(14, 16) });
        await dateTimeObj.save();
        break;
    }
  }

  async save({
    waitForRowsData = true,
  }: {
    waitForRowsData?: boolean;
  } = {}) {
    const saveRowAction = () => this.get().locator('button.nc-expand-form-save-btn').click();

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

    await this.verifyToast({ message: `updated successfully.` });
    await this.rootPage.locator('[data-testid="grid-load-spinner"]').waitFor({ state: 'hidden' });
    // removing focus from toast
    await this.rootPage.locator('.nc-modal').click();
    await this.get().press('Escape');
    await this.get().waitFor({ state: 'hidden' });
  }

  // check for the expanded form header table name

  // async verify({ header, url }: { header: string; url?: string }) {
  //   await expect(this.get().locator(`.nc-expanded-form-header`).last()).toContainText(header);
  //   if (url) {
  //     await expect.poll(() => this.rootPage.url()).toContain(url);
  //   }
  // }

  async escape() {
    await this.rootPage.keyboard.press('Escape');
    await this.get().locator('.nc-drawer-expanded-form').waitFor({ state: 'hidden' });

    await this.rootPage.waitForLoadState('networkidle');
    await this.rootPage.waitForLoadState('domcontentloaded');
    await this.rootPage.waitForTimeout(500);
  }

  async close() {
    await this.get().locator('.nc-expand-form-close-btn').last().click();
  }

  async openChildCard(param: { column: string; title: string }) {
    const childField = this.get().locator(`[data-testid="nc-expand-col-${param.column}"]`);
    await childField.locator('.nc-datatype-link').click();

    const card = await this.rootPage.locator(`.ant-card:has-text("${param.title}")`);
    await card.hover();
    await card.locator(`.nc-expand-item`).click();
  }

  async verifyCount({ count }: { count: number }) {
    return await expect(this.rootPage.locator(`.nc-drawer-expanded-form`)).toHaveCount(count);
  }

  async verifyRoleAccess(param: { role: string }) {
    const role = param.role.toLowerCase();

    // expect(await this.btn_moreActions.count()).toBe(1);
    await this.btn_moreActions.click();

    if (role === 'owner' || role === 'editor' || role === 'creator') {
      await expect(this.rootPage.getByTestId('nc-expanded-form-reload')).toBeVisible();
      await expect(this.rootPage.getByTestId('nc-expanded-form-duplicate')).toBeVisible();
      await expect(this.rootPage.getByTestId('nc-expanded-form-delete')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-expanded-form-reload')).toBeVisible();
      await expect(this.rootPage.getByTestId('nc-expanded-form-duplicate')).toHaveCount(0);
      await expect(this.rootPage.getByTestId('nc-expanded-form-delete')).toHaveCount(0);
    }

    if (role === 'owner' || role === 'editor' || role === 'creator') {
      await expect(this.rootPage.getByTestId('nc-expanded-form-save')).toHaveCount(1);
    } else {
      await expect(this.rootPage.getByTestId('nc-expanded-form-save')).toHaveCount(0);
    }

    if (role === 'viewer') {
      await expect(this.get().locator('.nc-comments-drawer')).toHaveCount(0);
    } else {
      await expect(this.get().locator('.nc-comments-drawer')).toHaveCount(1);
    }

    // press escape to close the expanded form
    await this.rootPage.keyboard.press('Escape');
  }
}
