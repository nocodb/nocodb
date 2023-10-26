import { expect, Locator } from '@playwright/test';
import { GridPage } from '..';
import BasePage from '../../../Base';
import { SelectOptionColumnPageObject } from './SelectOptionColumn';
import { AttachmentColumnPageObject } from './Attachment';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

export class ColumnPageObject extends BasePage {
  readonly grid: GridPage;
  readonly selectOption: SelectOptionColumnPageObject;
  readonly attachmentColumnPageObject: AttachmentColumnPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.selectOption = new SelectOptionColumnPageObject(this);
    this.attachmentColumnPageObject = new AttachmentColumnPageObject(this);
  }

  get() {
    return this.rootPage.locator('form[data-testid="add-or-edit-column"]');
  }

  async getColumnHeaderByIndex({ index }: { index: number }) {
    return this.grid.get().locator(`.nc-grid-header > th`).nth(index);
  }

  private getColumnHeader(title: string) {
    return this.grid.get().locator(`th[data-title="${title}"]`).first();
  }

  async clickColumnHeader({ title }: { title: string }) {
    await this.getColumnHeader(title).click();
  }

  async create({
    title,
    type = 'SingleLineText',
    formula = '',
    qrCodeValueColumnTitle = '',
    barcodeValueColumnTitle = '',
    barcodeFormat = '',
    childTable = '',
    childColumn = '',
    relationType = '',
    rollupType = '',
    format = '',
    dateFormat = '',
    timeFormat = '',
    insertAfterColumnTitle,
    insertBeforeColumnTitle,
    isDisplayValue = false,
  }: {
    title: string;
    type?: string;
    formula?: string;
    qrCodeValueColumnTitle?: string;
    barcodeValueColumnTitle?: string;
    barcodeFormat?: string;
    childTable?: string;
    childColumn?: string;
    relationType?: string;
    rollupType?: string;
    format?: string;
    dateFormat?: string;
    timeFormat?: string;
    insertBeforeColumnTitle?: string;
    insertAfterColumnTitle?: string;
    isDisplayValue?: boolean;
  }) {
    if (insertBeforeColumnTitle) {
      await this.grid.get().locator(`th[data-title="${insertBeforeColumnTitle}"] .nc-ui-dt-dropdown`).click();

      if (isDisplayValue) {
        await expect(this.rootPage.locator('li[role="menuitem"]:has-text("Insert Before")')).toHaveCount(0);
        return;
      }

      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert Before"):visible').click();
    } else if (insertAfterColumnTitle) {
      await this.grid.get().locator(`th[data-title="${insertAfterColumnTitle}"] .nc-ui-dt-dropdown`).click();
      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert After"):visible').click();
    } else {
      await this.grid.get().locator('.nc-column-add').click();
    }

    await this.rootPage.waitForTimeout(500);
    await this.fillTitle({ title });
    await this.rootPage.waitForTimeout(500);
    await this.selectType({ type });
    await this.rootPage.waitForTimeout(500);

    switch (type) {
      case 'SingleSelect':
      case 'MultiSelect':
        break;
      case 'Duration':
        if (format) {
          await this.get().locator('.ant-select-single').nth(1).click();
          await this.rootPage
            .locator(`.ant-select-item`, {
              hasText: format,
            })
            .click();
        }
        break;
      case 'DateTime':
        // Date Format
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        // Time Format
        await this.get().locator('.nc-time-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${timeFormat}"`).click();
        break;
      case 'Formula':
        await this.get().locator('.nc-formula-input').fill(formula);
        break;
      case 'QrCode':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: new RegExp(`^${qrCodeValueColumnTitle}$`),
          })
          .click();
        break;
      case 'Barcode':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: new RegExp(`^${barcodeValueColumnTitle}$`),
          })
          .click();
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
          .last()
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
      case 'Links':
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

    const headersText = [];
    const locator = this.grid.get().locator(`th`);
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const header = locator.nth(i);
      const text = await getTextExcludeIconText(header);
      headersText.push(text);
    }

    // verify column inserted after the target column
    if (insertAfterColumnTitle) {
      expect(headersText[headersText.findIndex(title => title.startsWith(insertAfterColumnTitle)) + 1]).toBe(title);
    }

    // verify column inserted before the target column
    if (insertBeforeColumnTitle) {
      expect(headersText[headersText.findIndex(title => title.startsWith(insertBeforeColumnTitle)) - 1]).toBe(title);
    }
  }

  async fillTitle({ title }: { title: string }) {
    await this.get().locator('.nc-column-name-input').fill(title);
  }

  async selectType({ type }: { type: string }) {
    await this.get().locator('.ant-select-selector > .ant-select-selection-item').click();

    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

    // Select column type
    await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${type}"`).click();
  }

  async changeReferencedColumnForQrCode({ titleOfReferencedColumn }: { titleOfReferencedColumn: string }) {
    await this.get().locator('.nc-qr-code-value-column-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: titleOfReferencedColumn,
      })
      .click();

    await this.save();
  }

  async changeReferencedColumnForBarcode({ titleOfReferencedColumn }: { titleOfReferencedColumn: string }) {
    await this.get().locator('.nc-barcode-value-column-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: titleOfReferencedColumn,
      })
      .click();

    await this.save();
  }

  async changeBarcodeFormat({ barcodeFormatName }: { barcodeFormatName: string }) {
    await this.get().locator('.nc-barcode-format-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: barcodeFormatName,
      })
      .click();

    await this.save();
  }

  async delete({ title }: { title: string }) {
    await this.getColumnHeader(title).locator('div.ant-dropdown-trigger').locator('.nc-ui-dt-dropdown').click();
    // await this.rootPage.locator('li[role="menuitem"]:has-text("Delete")').waitFor();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Delete"):visible').click();

    // pressing on delete column button
    await this.rootPage.locator('.ant-modal.active button:has-text("Delete Field")').click();

    // wait till modal is closed
    await this.rootPage.locator('.ant-modal.active').waitFor({ state: 'hidden' });
  }

  // opening edit modal in table header  double click
  // or in the dropdown edit click
  async openEdit({
    title,
    type = 'SingleLineText',
    formula = '',
    format,
    dateFormat = '',
    timeFormat = '',
  }: {
    title: string;
    type?: string;
    formula?: string;
    format?: string;
    dateFormat?: string;
    timeFormat?: string;
  }) {
    // when clicked on the dropdown cell header
    await this.getColumnHeader(title).locator('.nc-ui-dt-dropdown').scrollIntoViewIfNeeded();
    await this.getColumnHeader(title).locator('.nc-ui-dt-dropdown').click();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Edit")').last().click();

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
      case 'DateTime':
        // Date Format
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        // Time Format
        await this.get().locator('.nc-time-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${timeFormat}"`).click();
        break;
      default:
        break;
    }
  }

  async editMenuShowMore() {
    await this.rootPage.locator('.nc-more-options').click();
  }

  async duplicateColumn({ title, expectedTitle = `${title}_copy` }: { title: string; expectedTitle?: string }) {
    await this.grid.get().locator(`th[data-title="${title}"] .nc-ui-dt-dropdown`).click();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Duplicate"):visible').click();

    // await this.verifyToast({ message: 'Column duplicated successfully' });
    await this.grid.get().locator(`th[data-title="${expectedTitle}"]`).waitFor({ state: 'visible' });
  }

  async hideColumn({ title, isDisplayValue = false }: { title: string; isDisplayValue?: boolean }) {
    await this.grid.get().locator(`th[data-title="${title}"] .nc-ui-dt-dropdown`).click();

    if (isDisplayValue) {
      await expect(this.rootPage.locator('li[role="menuitem"]:has-text("Hide Field")')).toHaveCount(0);
      return;
    }

    await this.waitForResponse({
      uiAction: async () => await this.rootPage.locator('li[role="menuitem"]:has-text("Hide Field"):visible').click(),
      requestUrlPathToMatch: '/api/v1/db/meta/views',
      httpMethodsToMatch: ['PATCH'],
    });

    await expect(this.grid.get().locator(`th[data-title="${title}"]`)).toHaveCount(0);
  }

  async save({ isUpdated }: { isUpdated?: boolean } = {}) {
    await this.waitForResponse({
      uiAction: async () => await this.get().locator('button:has-text("Save")').click(),
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
      return await expect(this.getColumnHeader(title)).not.toBeVisible();
    }
    await expect(this.getColumnHeader(title)).toContainText(title);
  }

  async verifyRoleAccess(param: { role: string }) {
    const role = param.role.toLowerCase();
    const count = role.toLowerCase() === 'creator' || role.toLowerCase() === 'owner' ? 1 : 0;
    await expect(this.grid.get().locator('.nc-column-add:visible')).toHaveCount(count);

    // verify for first column, if edit dropdown exists
    const columnHdr = await this.getColumnHeaderByIndex({ index: 1 });
    await expect(await columnHdr.locator('.nc-ui-dt-dropdown:visible')).toHaveCount(count);

    if (role === 'creator' || role === 'owner') {
      // open edit dropdown menu
      await columnHdr.locator('.nc-ui-dt-dropdown:visible').click();
      await expect(this.rootPage.locator('.nc-dropdown-column-operations')).toHaveCount(1);

      // close edit dropdown menu
      await columnHdr.locator('.nc-ui-dt-dropdown:visible').click();
    }

    // select all menu access
    await expect(
      await this.grid.get().locator('[data-testid="nc-check-all"]').locator('input[type="checkbox"]')
    ).toHaveCount(role === 'creator' || role === 'owner' || role === 'editor' ? 1 : 0);

    if (role === 'creator' || role === 'owner' || role === 'editor') {
      await this.grid.selectAll();
      await this.grid.openAllRowContextMenu();
      await this.rootPage.locator('.nc-dropdown-grid-context-menu').waitFor({ state: 'visible' });
      await expect(this.rootPage.locator('.nc-dropdown-grid-context-menu')).toHaveCount(1);
      await this.rootPage.keyboard.press('Escape');
      await (await this.getColumnHeaderByIndex({ index: 2 })).click();
    }
  }

  async sortColumn({ title, direction = 'asc' }: { title: string; direction: 'asc' | 'desc' }) {
    await this.grid.get().locator(`th[data-title="${title}"] .nc-ui-dt-dropdown`).click();
    let menuOption: { (): Promise<void>; (): Promise<void> };
    if (direction === 'desc') {
      menuOption = () => this.rootPage.locator('li[role="menuitem"]:has-text("Sort Descending"):visible').click();
    } else {
      menuOption = () => this.rootPage.locator('li[role="menuitem"]:has-text("Sort Ascending"):visible').click();
    }

    await this.waitForResponse({
      uiAction: menuOption,
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/sorts`,
    });

    await this.grid.toolbar.parent.dashboard.waitForLoaderToDisappear();

    await this.grid.toolbar.clickSort();

    await this.rootPage.locator(`.ant-select-selection-item:has-text("${title}")`).first().isVisible();
    await this.rootPage
      .locator(
        `.nc-sort-dir-select:has-text("${direction === 'asc' ? '1 → 9' : '9 → 1'}"),.nc-sort-dir-select:has-text("${
          direction === 'asc' ? 'A → Z' : 'Z → A'
        }")`
      )
      .first()
      .isVisible();

    // close sort menu
    await this.grid.toolbar.clickSort();
  }

  async resize(param: { src: string; dst: string }) {
    const { src, dst } = param;
    const [fromStack, toStack] = await Promise.all([
      this.rootPage.locator(`[data-title="${src}"] >> .resizer`),
      this.rootPage.locator(`[data-title="${dst}"] >> .resizer`),
    ]);

    await fromStack.scrollIntoViewIfNeeded();
    await fromStack.hover();
    await fromStack.dragTo(toStack);

    await this.rootPage.waitForTimeout(500);
    await fromStack.click({
      force: true,
    });
  }

  async getWidth(param: { title: string }) {
    const { title } = param;
    const cell = this.rootPage.locator(`th[data-title="${title}"]`);
    return await cell.evaluate(el => el.getBoundingClientRect().width);
  }
}
