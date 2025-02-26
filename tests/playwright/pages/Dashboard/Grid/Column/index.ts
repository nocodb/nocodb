import { expect, Locator } from '@playwright/test';
import { GridPage } from '..';
import BasePage from '../../../Base';
import { SelectOptionColumnPageObject } from './SelectOptionColumn';
import { AttachmentColumnPageObject } from './Attachment';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { UserOptionColumnPageObject } from './UserOptionColumn';
import { LTAROptionColumnPageObject } from './LTAROptionColumn';

export class ColumnPageObject extends BasePage {
  readonly grid: GridPage;
  readonly selectOption: SelectOptionColumnPageObject;
  readonly attachmentColumnPageObject: AttachmentColumnPageObject;
  readonly userOption: UserOptionColumnPageObject;
  readonly ltarOption: LTAROptionColumnPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.selectOption = new SelectOptionColumnPageObject(this);
    this.attachmentColumnPageObject = new AttachmentColumnPageObject(this);
    this.userOption = new UserOptionColumnPageObject(this);
    this.ltarOption = new LTAROptionColumnPageObject(this);
  }

  get() {
    return this.rootPage.locator('form[data-testid="add-or-edit-column"]');
  }

  async getColumnHeaderByIndex({ index }: { index: number }) {
    return this.grid.get().locator(`.nc-grid-header > th`).nth(index);
  }

  async clickColumnHeader({ title }: { title: string }) {
    await this.getColumnHeader(title).click();
  }

  defaultValueBtn() {
    const showDefautlValueBtn = this.get().getByTestId('nc-show-default-value-btn');

    return {
      locator: showDefautlValueBtn,
      isVisible: async () => {
        return await showDefautlValueBtn.isVisible();
      },
      click: async () => {
        if (await showDefautlValueBtn.isVisible()) {
          await showDefautlValueBtn.click();

          await showDefautlValueBtn.waitFor({ state: 'hidden' });
          await this.get().locator('.nc-default-value-wrapper').waitFor({ state: 'visible' });
        }
      },
    };
  }

  async create({
    title,
    type = 'SingleLineText',
    formula = '',
    qrCodeValueColumnTitle = '',
    barcodeValueColumnTitle = '',
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
    ltarFilters,
    ltarView,
    custom = false,
    refColumn,
    buttonType,
    webhookIndex = 0,
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
    ltarFilters?: any[];
    ltarView?: string;
    custom?: boolean;
    refColumn?: string;
    buttonType?: string;
    webhookIndex?: number;
  }) {
    if (insertBeforeColumnTitle) {
      await this.grid.renderColumn(insertBeforeColumnTitle);
      await this.grid.get().locator(`th[data-title="${insertBeforeColumnTitle}"]`).scrollIntoViewIfNeeded();
      await this.grid.get().locator(`th[data-title="${insertBeforeColumnTitle}"] .nc-ui-dt-dropdown`).click();
      if (isDisplayValue) {
        await expect(this.rootPage.locator('li[role="menuitem"]:has-text("Insert left")')).toHaveCount(0);
        return;
      }
      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert left"):visible').click();
    } else if (insertAfterColumnTitle) {
      await this.grid.renderColumn(insertAfterColumnTitle);
      await this.grid.get().locator(`th[data-title="${insertAfterColumnTitle}"]`).scrollIntoViewIfNeeded();
      await this.grid.get().locator(`th[data-title="${insertAfterColumnTitle}"] .nc-ui-dt-dropdown`).click();
      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert right"):visible').click();
    } else {
      await this.grid.get().locator('.nc-column-add').click();
    }

    await this.rootPage.waitForTimeout(500);
    await this.fillTitle({ title });
    await this.rootPage.waitForTimeout(500);
    await this.selectType({ type, isCreateColumn: true });
    await this.rootPage.waitForTimeout(500);

    switch (type) {
      case 'SingleSelect':
      case 'MultiSelect':
        break;
      case 'Duration':
        if (format) {
          await this.get().locator('.ant-select-single').nth(1).click();
          await this.rootPage.locator(`.ant-select-item .ant-select-item-option-content`).getByTestId(format).click();
        }
        break;
      case 'Date':
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.nc-date-select').pressSequentially(dateFormat);
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
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
        await this.get().locator('.inputarea').fill(formula);
        break;
      case 'Button':
        await this.get().locator('.nc-button-type-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${buttonType}"`).click();

        await this.get().locator('.nc-button-webhook-select').click();

        await this.rootPage.waitForSelector('.nc-list-with-search', {
          state: 'visible',
        });

        await this.rootPage.locator(`.nc-unified-list-option-${webhookIndex}`).click();

        break;
      case 'QrCode':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`)
          .locator(`[data-testid="nc-qr-${qrCodeValueColumnTitle}"]`)
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
        // kludge, fix me
        await this.rootPage.waitForTimeout(2000);

        await this.get().locator('.nc-ltar-relation-type').getByTestId(relationType).click();
        // await this.get()
        //   .locator('.nc-ltar-relation-type >> .ant-radio')
        //   .nth(relationType === 'Has Many' ? 1 : 0)
        //   .click();
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage.locator(`.nc-ltar-child-table >> input[type="search"]`).fill(childTable);
        await this.rootPage
          .locator(`.nc-dropdown-ltar-child-table >> .ant-select-item`, {
            hasText: childTable,
          })
          .nth(0)
          .click();

        if (ltarView) {
          await this.ltarOption.selectView({ ltarView: ltarView });
        }

        if (ltarFilters) {
          await this.ltarOption.addFilters(ltarFilters);
        }

        if (custom) {
          // enable advance options
          await this.get().locator('.nc-ltar-relation-type >> .ant-radio').nth(1).dblclick();
          await this.get().locator('.nc-ltar-relation-type >> .ant-radio').nth(2).dblclick();

          await this.get().locator(':has(:has-text("Advanced Link")) > button.ant-switch').click();

          //  data-testid="custom-link-source-base-id"
          // data-testid="custom-link-source-table-id"
          // data-testid="custom-link-source-column-id"
          // data-testid="custom-link-junction-base-id"
          // data-testid="custom-link-junction-table-id"
          // data-testid="custom-link-junction-source-column-id"
          // data-testid="custom-link-junction-target-column-id"
          // data-testid="custom-link-target-base-id"
          // data-testid="custom-link-target-table-id"
          // data-testid="custom-link-target-column-id"

          // select target table and column
          // await this.get().get('').nth(2).click();

          // select referenced base, column and column
        }

        break;
      case 'User':
        break;
      default:
        break;
    }

    await this.save();

    const headersText = [];
    const locator = this.grid.get().locator('th.nc-grid-column-header');
    await locator.first().waitFor({ state: 'visible' });

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

  async selectType({ type, first, isCreateColumn }: { type: string; first?: boolean; isCreateColumn?: boolean }) {
    if (isCreateColumn || (await this.get().getByTestId('nc-column-uitypes-options-list-wrapper').isVisible())) {
      const searchInput = this.get().locator('.nc-column-type-search-input >> input');
      await searchInput.waitFor({ state: 'visible' });
      await searchInput.click();
      await searchInput.fill(type);

      await this.get().locator('.nc-column-list-wrapper').getByTestId(type).waitFor();
      await this.get().locator('.nc-column-list-wrapper').getByTestId(type).click();

      await this.get().locator('.nc-column-type-input').waitFor();
    } else {
      if (first) {
        await this.get().locator('.ant-select-selector > .ant-select-selection-item').first().click();
      } else {
        await this.get().locator('.ant-select-selector > .ant-select-selection-item').click();
      }

      await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
      await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

      // Select column type
      await this.rootPage.locator('.rc-virtual-list-holder-inner > div').getByTestId(type).click();
    }
  }

  async changeReferencedColumnForQrCode({ titleOfReferencedColumn }: { titleOfReferencedColumn: string }) {
    await this.get().locator('.nc-qr-code-value-column-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: titleOfReferencedColumn,
      })
      .click();

    await this.save({ isUpdated: true });
  }

  async changeReferencedColumnForBarcode({ titleOfReferencedColumn }: { titleOfReferencedColumn: string }) {
    await this.get().locator('.nc-barcode-value-column-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: titleOfReferencedColumn,
      })
      .click();

    await this.save({ isUpdated: true });
  }

  async changeBarcodeFormat({ barcodeFormatName }: { barcodeFormatName: string }) {
    await this.get().locator('.nc-barcode-format-select .ant-select-single').click();
    await this.rootPage
      .locator(`.ant-select-item`, {
        hasText: barcodeFormatName,
      })
      .click();

    await this.save({ isUpdated: true });
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

  // or in the dropdown edit click
  async openEdit({
    title,
    type = 'SingleLineText',
    formula = '',
    format,
    dateFormat = '',
    timeFormat = '',
    selectType = false,
  }: {
    title: string;
    type?: string;
    formula?: string;
    format?: string;
    dateFormat?: string;
    timeFormat?: string;
    selectType?: boolean;
  }) {
    await this.grid.renderColumn(title);
    // when clicked on the dropdown cell header
    await this.getColumnHeader(title).locator('.nc-ui-dt-dropdown').scrollIntoViewIfNeeded();
    await this.getColumnHeader(title).locator('.nc-ui-dt-dropdown').click();
    await expect(await this.rootPage.locator('li[role="menuitem"]:has-text("Edit"):visible').last()).toBeVisible();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Edit"):visible').last().click();

    await this.get().waitFor({ state: 'visible' });

    await this.rootPage.waitForTimeout(200);

    if (selectType) {
      await this.selectType({ type, first: true });
    }

    // Click set default value to show default value input, on close field modal it will automacally hide input if value is not set
    await this.defaultValueBtn().click();

    switch (type) {
      case 'Formula': {
        const element = this.get().locator('.inputarea');
        await element.focus();

        await this.rootPage.keyboard.press('Control+A');
        await this.rootPage.waitForTimeout(200);

        await this.rootPage.keyboard.press('Backspace');
        await this.rootPage.waitForTimeout(200);
        await element.fill(formula);
        break;
      }
      case 'Duration':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage.locator(`.ant-select-item`).getByTestId(format).click();
        break;
      case 'DateTime':
        // Date Format
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();

        // allow UI to update
        await this.rootPage.waitForTimeout(500);

        // Time Format
        await this.get().locator('.nc-time-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${timeFormat}"`).click();

        // allow UI to update
        await this.rootPage.waitForTimeout(500);

        break;
      case 'Date':
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.nc-date-select').pressSequentially(dateFormat, { delay: 100 });
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();

        // allow UI to update
        await this.rootPage.waitForTimeout(500);

        break;
      default:
        break;
    }
  }

  // opening edit modal in table header  double click

  async editMenuShowMore() {
    await this.rootPage.locator('.nc-more-options').click();
  }

  async duplicateColumn({ title, expectedTitle = `${title} copy` }: { title: string; expectedTitle?: string }) {
    await this.grid.get().locator(`th[data-title="${title}"] .nc-ui-dt-dropdown`).click();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Duplicate"):visible').click();

    await this.rootPage.locator('.nc-modal-column-duplicate .nc-button:has-text("Confirm"):visible').click();

    // await this.verifyToast({ message: 'Column duplicated successfully' });
    await this.grid.get().locator(`th[data-title="${expectedTitle}"]`).waitFor({ state: 'visible', timeout: 10000 });
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

  async save({ isUpdated, typeChange }: { isUpdated?: boolean; typeChange?: boolean } = {}) {
    // if type is changed, then we need to click the update button during the warning popup
    if (!typeChange) {
      const buttonText = isUpdated ? 'Update' : 'Save';
      await this.waitForResponse({
        uiAction: async () => await this.get().locator(`button:has-text("${buttonText}")`).click(),
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['pageInfo'],
      });
    } else {
      await this.get().locator('button:has-text("Update Field")').click();
      // click on update button on warning popup
      await this.waitForResponse({
        uiAction: async () => await this.rootPage.locator('button:has-text("Update")').click(),
        requestUrlPathToMatch: 'api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['pageInfo'],
      });
    }

    await this.verifyToast({
      message: isUpdated ? 'Column updated' : 'Column created',
    });
    await this.get().waitFor({ state: 'hidden' });
    await this.rootPage.waitForTimeout(200);
  }

  async checkMessageAndClose({ errorMessage }: { errorMessage?: RegExp } = {}) {
    await this.verifyErrorMessage({
      message: errorMessage,
    });
    await this.get().locator('button:has-text("Cancel")').click();
    await this.get().waitFor({ state: 'hidden' });
    await this.rootPage.waitForTimeout(200);
  }

  async verify({ title, isVisible = true, scroll = false }: { title: string; isVisible?: boolean; scroll?: boolean }) {
    if (!isVisible) {
      return await expect(this.getColumnHeader(title)).not.toBeVisible();
    }
    if (scroll) {
      await this.grid.renderColumn(title);
      await this.getColumnHeader(title).scrollIntoViewIfNeeded();
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

    if (role === 'creator' || role === 'owner' || role === 'editor') {
      await this.grid.selectRow(0);
      await this.grid.selectRow(1);
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
    await this.rootPage.waitForTimeout(100);
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

  private getColumnHeader(title: string) {
    return this.grid.get().locator(`th[data-title="${title}"]`).first();
  }
}
