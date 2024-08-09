import { expect, Locator } from '@playwright/test';
import { UITypes } from 'nocodb-sdk';
import { GridPage } from '../../Grid';
import BasePage from '../../../Base';
import { AttachmentCellPageObject } from './AttachmentCell';
import { SelectOptionCellPageObject } from './SelectOptionCell';
import { SharedFormPage } from '../../../SharedForm';
import { CheckboxCellPageObject } from './CheckboxCell';
import { RatingCellPageObject } from './RatingCell';
import { DateCellPageObject } from './DateCell';
import { DateTimeCellPageObject } from './DateTimeCell';
import { GeoDataCellPageObject } from './GeoDataCell';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { YearCellPageObject } from './YearCell';
import { TimeCellPageObject } from './TimeCell';
import { GroupPageObject } from '../../Grid/Group';
import { UserOptionCellPageObject } from './UserOptionCell';
import { SurveyFormPage } from '../../SurveyForm';
import { ButtonCellPageObject } from './ButtonCell';

export interface CellProps {
  indexMap?: Array<number>;
  index?: number;
  columnHeader: string;
}

export class CellPageObject extends BasePage {
  readonly parent: GridPage | SharedFormPage | SurveyFormPage | GroupPageObject;
  readonly selectOption: SelectOptionCellPageObject;
  readonly attachment: AttachmentCellPageObject;
  readonly checkbox: CheckboxCellPageObject;
  readonly rating: RatingCellPageObject;
  readonly year: YearCellPageObject;
  readonly time: TimeCellPageObject;
  readonly geoData: GeoDataCellPageObject;
  readonly date: DateCellPageObject;
  readonly dateTime: DateTimeCellPageObject;
  readonly userOption: UserOptionCellPageObject;
  readonly button: ButtonCellPageObject;

  constructor(parent: GridPage | SharedFormPage | SurveyFormPage | GroupPageObject) {
    super(parent.rootPage);
    this.parent = parent;
    this.selectOption = new SelectOptionCellPageObject(this);
    this.attachment = new AttachmentCellPageObject(this);
    this.checkbox = new CheckboxCellPageObject(this);
    this.rating = new RatingCellPageObject(this);
    this.year = new YearCellPageObject(this);
    this.time = new TimeCellPageObject(this);
    this.geoData = new GeoDataCellPageObject(this);
    this.date = new DateCellPageObject(this);
    this.dateTime = new DateTimeCellPageObject(this);
    this.userOption = new UserOptionCellPageObject(this);
    this.button = new ButtonCellPageObject(this);
  }

  get({ indexMap, index, columnHeader }: CellProps): Locator {
    if (this.parent instanceof SharedFormPage) {
      return this.parent.get().locator(`[data-testid="nc-form-input-cell-${columnHeader}"]`).first();
    } else if (this.parent instanceof SurveyFormPage) {
      return this.parent
        .get()
        .locator(`[data-testid="nc-survey-form__input-${columnHeader.replace(' ', '')}"]`)
        .first();
    } else if (this.parent instanceof GridPage) {
      return this.parent.get().locator(`td[data-testid="cell-${columnHeader}-${index}"]`).first();
    } else {
      return this.parent.get({ indexMap }).locator(`td[data-testid="cell-${columnHeader}-${index}"]`).first();
    }
  }

  async click({ index, columnHeader }: CellProps, ...options: Parameters<Locator['click']>) {
    await this.get({ index, columnHeader }).click(...options);
    await (await this.get({ index, columnHeader }).elementHandle()).waitForElementState('stable');
  }

  async dblclick({ index, columnHeader }: CellProps) {
    return await this.get({ index, columnHeader }).dblclick();
  }

  async fillText({ index, columnHeader, text, type }: CellProps & { text: string; type?: UITypes }) {
    await this.dblclick({
      index,
      columnHeader,
    });
    const isInputBox = async () => (await this.get({ index, columnHeader }).locator('input').count()) > 0;

    for (let i = 0; i < 10; i++) {
      if (await isInputBox()) {
        break;
      }
      await this.rootPage.waitForTimeout(200);
    }

    if (await isInputBox()) {
      await this.get({ index, columnHeader }).locator('input').fill(text);

      if (type && [UITypes.Date, UITypes.Time, UITypes.Year, UITypes.DateTime].includes(type)) {
        await this.rootPage.keyboard.press('Enter');
      }
    } else {
      await this.get({ index, columnHeader }).locator('textarea').fill(text);
    }
  }

  async inCellExpand({ index, columnHeader }: CellProps) {
    // await this.get({ index, columnHeader }).hover();
    await this.waitForResponse({
      uiAction: () => this.get({ index, columnHeader }).locator('.nc-datatype-link').click(),
      requestUrlPathToMatch: '/api/v1/db/data/noco',
      httpMethodsToMatch: ['GET'],
    });
  }

  async inCellAdd({ index, columnHeader }: CellProps) {
    await this.get({ index, columnHeader }).hover();
    await this.get({ index, columnHeader }).locator('.nc-action-icon.nc-plus').click();
  }

  async verifyCellActiveSelected({ index, columnHeader }: CellProps) {
    await expect(this.get({ index, columnHeader })).toHaveClass(/active/);
  }

  async verifyCellEditable({ index, columnHeader }: CellProps) {
    await this.get({ index, columnHeader }).isEditable();
  }

  async verify({ index, columnHeader, value }: CellProps & { value: string | string[] }) {
    const _verify = async text => {
      // await expect
      //   .poll(async () => {
      //     const innerTexts = await this.get({
      //       index,
      //       columnHeader,
      //     }).allInnerTexts();
      //     return typeof innerTexts === 'string' ? [innerTexts] : innerTexts;
      //   })
      //   .toContain(text);

      // retrieve text from cell
      // loop for 5 seconds
      // if text is found, return
      // if text is not found, throw error
      let count = 0;

      if (!(this.parent instanceof SharedFormPage)) {
        await this.rootPage.locator(`td[data-testid="cell-${columnHeader}-${index}"]`).waitFor({ state: 'visible' });
      }

      await this.get({
        index,
        columnHeader,
      }).waitFor({ state: 'visible' });

      await this.get({
        index,
        columnHeader,
      }).scrollIntoViewIfNeeded();
      while (count < 5) {
        const innerTexts = await getTextExcludeIconText(this.get({ index, columnHeader }));
        const cellText = typeof innerTexts === 'string' ? [innerTexts] : innerTexts;

        if (cellText) {
          if (cellText?.includes(text) || cellText[0]?.includes(text)) {
            return;
          }
        }
        await this.rootPage.waitForTimeout(1000);
        count++;
        if (count === 5) {
          console.log('cellText', cellText);
          console.log('text', text);

          throw new Error(`Cell text "${text}" not found`);
        }
      }
    };

    if (Array.isArray(value)) {
      for (const text of value) {
        await _verify(text);
      }
    } else {
      await _verify(value);
    }
  }

  async verifyGeoDataCell({
    index,
    columnHeader,
    lat,
    long,
  }: {
    index: number;
    columnHeader: string;
    lat: string;
    long: string;
  }) {
    const _verify = async expectedValue => {
      await expect
        .poll(async () => {
          const cell = await this.get({
            index,
            columnHeader,
          }).locator(`[data-testid="nc-geo-data-lat-long-set"]`);
          return await cell.textContent(); //.getAttribute('title');
        })
        .toEqual(expectedValue);
    };

    const value = `${lat}; ${long}`;
    await _verify(value);
  }

  async verifyDateCell({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const _verify = async expectedValue => {
      await expect
        .poll(async () => {
          const cell = await this.get({
            index,
            columnHeader,
          }).locator('.nc-date-picker');
          return await cell.getAttribute('title');
        })
        .toEqual(expectedValue);
    };

    await _verify(value);
  }

  async verifyQrCodeCell({
    index,
    columnHeader,
    expectedSrcValue,
  }: CellProps & {
    expectedSrcValue: string;
  }) {
    const _verify = async expectedQrCodeImgSrc => {
      await expect
        .poll(async () => {
          const qrCell = await this.get({
            index,
            columnHeader,
          });
          const qrImg = await qrCell.getByRole('img');
          const qrImgSrc = await qrImg.getAttribute('src');
          return qrImgSrc;
        })
        .toEqual(expectedQrCodeImgSrc);
    };

    await _verify(expectedSrcValue);
  }

  async verifyBarcodeCellShowsInvalidInputMessage({ index, columnHeader }: { index: number; columnHeader: string }) {
    const _verify = async expectedInvalidInputMessage => {
      await expect
        .poll(async () => {
          const barcodeCell = await this.get({
            index,
            columnHeader,
          });
          const barcodeInvalidInputMessage = await barcodeCell.getByTestId('barcode-invalid-input-message');
          return await barcodeInvalidInputMessage.textContent();
        })
        .toEqual(expectedInvalidInputMessage);
    };

    await _verify('Barcode error - please check compatibility between input and barcode type');
  }

  async verifyBarcodeCell({
    index,
    columnHeader,
    expectedSvgValue,
  }: {
    index: number;
    columnHeader: string;
    expectedSvgValue: string;
  }) {
    const _verify = async (expectedBarcodeSvg: unknown) => {
      await expect
        .poll(async () => {
          const barcodeCell = this.get({ index, columnHeader });
          const barcodeSvg = barcodeCell.getByTestId('barcode');
          return await barcodeSvg.innerHTML();
        })
        .toEqual(expectedBarcodeSvg);
    };

    await _verify(expectedSvgValue);
  }

  // todo: Improve param names (i.e value => values)
  // verifyVirtualCell
  //  : virtual relational cell- HM, BT, MM
  //  : verify link count & cell value
  //
  async verifyVirtualCell({
    index,
    columnHeader,
    type,
    count,
    value,
    verifyChildList = false,
    options,
  }: CellProps & {
    count?: number;
    type?: string;
    value?: string[];
    verifyChildList?: boolean;
    options?: { singular?: string; plural?: string };
  }) {
    const cell = this.get({ index, columnHeader });
    const linkText = cell.locator('.nc-datatype-link');

    await cell.scrollIntoViewIfNeeded();

    // lazy load - give enough time for cell to load
    await this.rootPage.waitForTimeout(1000);

    if (type === 'bt') {
      const chips = cell.locator('.chips > .chip');
      expect(await chips.count()).toBe(count);

      for (let i = 0; i < value.length; ++i) {
        await chips.nth(i).locator('.name').waitFor({ state: 'visible' });
        await chips.nth(i).locator('.name').scrollIntoViewIfNeeded();
        await expect(chips.nth(i).locator('.name')).toHaveText(value[i]);
      }
      return;
    }

    // verify chip count & contents
    if (count) {
      const expectedText = `${count} ${count === 1 ? options.singular : options.plural}`;
      let retryCount = 0;
      while (retryCount < 5) {
        const receivedText = await linkText.innerText();
        if (receivedText.includes(expectedText)) {
          break;
        }
        retryCount++;
        // add delay of 100ms
        await this.rootPage.waitForTimeout(100 * retryCount);
      }
      expect(await cell.innerText()).toContain(expectedText);
    }

    if (verifyChildList) {
      // open child list
      await this.get({ index, columnHeader }).hover();

      // arrow expand doesn't exist for bt columns
      if (await linkText.count()) {
        await this.waitForResponse({
          uiAction: () => linkText.click(),
          requestUrlPathToMatch: '/api/v1',
          httpMethodsToMatch: ['GET'],
        });

        // wait for child list to open
        await this.rootPage.waitForSelector('.nc-modal-child-list:visible');

        // verify child list count & contents
        await expect.poll(() => this.rootPage.locator('.ant-card:visible').count()).toBe(count);

        // close child list
        // await this.rootPage.locator('.nc-modal-child-list').locator('.nc-close-btn').last().click();
        await this.rootPage.locator('.nc-modal-child-list').getByTestId('nc-link-count-info').click();
        await this.rootPage.keyboard.press('Escape');
      }
    }
  }

  async unlinkVirtualCell({ index, columnHeader }: CellProps) {
    const cell = this.get({ index, columnHeader });
    const isLink = await cell.locator('.nc-datatype-link').count();

    // Count will be 0 for BT columns
    if (!isLink) {
      await cell.click();
      await cell.locator('.nc-icon.unlink-icon').click();
      // await cell.click();
    }

    // For HM/MM columns
    else {
      await cell.locator('.nc-datatype-link').click();
      await this.rootPage
        .locator(`[data-testid="nc-child-list-item"]`)
        .last()
        .waitFor({ state: 'visible', timeout: 3000 });

      await this.waitForResponse({
        uiAction: () =>
          this.rootPage
            .locator(`[data-testid="nc-child-list-item"]`)
            .last()
            .locator('button.nc-list-item-link-unlink-btn')
            .click({ force: true, timeout: 3000 }),
        requestUrlPathToMatch: '/api/v1/db/data/noco',
        httpMethodsToMatch: ['GET'],
      });

      await this.rootPage.keyboard.press('Escape');
      await this.rootPage.keyboard.press('Escape');
    }
  }

  async verifyRoleAccess(param: { role: string }) {
    const role = param.role.toLowerCase();
    const isEditAccess = role === 'creator' || role === 'editor' || role === 'owner';
    // normal text cell
    const cell = this.get({ index: 0, columnHeader: 'Country' });
    // editable cell
    await cell.dblclick();
    await expect(cell.locator(`input`)).toHaveCount(isEditAccess ? 1 : 0);

    // press escape to close the input
    await cell.press('Escape');
    await cell.press('Escape');

    await cell.click({ button: 'right', clickCount: 1 });
    await expect(this.rootPage.locator(`.nc-dropdown-grid-context-menu:visible`)).toHaveCount(1);

    // virtual cell
    const vCell = this.get({ index: 0, columnHeader: 'Cities' });
    await vCell.hover();
    // in-cell add
    await expect(vCell.locator('.nc-action-icon.nc-plus:visible')).toHaveCount(isEditAccess ? 1 : 0);

    // virtual cell link text
    const linkText = await getTextExcludeIconText(vCell);
    expect(linkText).toContain('1 City');
  }

  async copyCellToClipboard({ index, columnHeader }: CellProps, ...clickOptions: Parameters<Locator['click']>) {
    if (this.parent instanceof GridPage) await this.parent.renderColumn(columnHeader);
    await this.get({ index, columnHeader }).scrollIntoViewIfNeeded();
    await this.get({ index, columnHeader }).click(...clickOptions);
    await (await this.get({ index, columnHeader }).elementHandle()).waitForElementState('stable');

    await this.get({ index, columnHeader }).press((await this.isMacOs()) ? 'Meta+C' : 'Control+C');
    await this.verifyToast({ message: 'Copied to clipboard' });
  }

  async pasteFromClipboard({ index, columnHeader }: CellProps, ...clickOptions: Parameters<Locator['click']>) {
    await this.get({ index, columnHeader }).scrollIntoViewIfNeeded();
    await this.get({ index, columnHeader }).click(...clickOptions);
    await (await this.get({ index, columnHeader }).elementHandle()).waitForElementState('stable');

    await this.get({ index, columnHeader }).press((await this.isMacOs()) ? 'Meta+V' : 'Control+V');

    // kludge: wait for paste to complete
    await this.rootPage.waitForTimeout(1000);
  }
}
