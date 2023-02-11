import { expect, Locator } from '@playwright/test';
import { GridPage } from '../../Grid';
import BasePage from '../../../Base';
import { AttachmentCellPageObject } from './AttachmentCell';
import { SelectOptionCellPageObject } from './SelectOptionCell';
import { SharedFormPage } from '../../../SharedForm';
import { CheckboxCellPageObject } from './CheckboxCell';
import { RatingCellPageObject } from './RatingCell';
import { DateCellPageObject } from './DateCell';
import { DateTimeCellPageObject } from './DateTimeCell';

export interface CellProps {
  index?: number;
  columnHeader: string;
}

export class CellPageObject extends BasePage {
  readonly parent: GridPage | SharedFormPage;
  readonly selectOption: SelectOptionCellPageObject;
  readonly attachment: AttachmentCellPageObject;
  readonly checkbox: CheckboxCellPageObject;
  readonly rating: RatingCellPageObject;
  readonly date: DateCellPageObject;
  readonly dateTime: DateTimeCellPageObject;

  constructor(parent: GridPage | SharedFormPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.selectOption = new SelectOptionCellPageObject(this);
    this.attachment = new AttachmentCellPageObject(this);
    this.checkbox = new CheckboxCellPageObject(this);
    this.rating = new RatingCellPageObject(this);
    this.date = new DateCellPageObject(this);
    this.dateTime = new DateTimeCellPageObject(this);
  }

  get({ index, columnHeader }: CellProps): Locator {
    if (this.parent instanceof SharedFormPage) {
      return this.parent.get().locator(`[data-testid="nc-form-input-cell-${columnHeader}"]`);
    } else {
      return this.parent.get().locator(`td[data-testid="cell-${columnHeader}-${index}"]`);
    }
  }

  async click({ index, columnHeader }: CellProps, ...options: Parameters<Locator['click']>) {
    await this.get({ index, columnHeader }).click(...options);
    await (await this.get({ index, columnHeader }).elementHandle()).waitForElementState('stable');
  }

  async dblclick({ index, columnHeader }: CellProps) {
    return await this.get({ index, columnHeader }).dblclick();
  }

  async fillText({ index, columnHeader, text }: CellProps & { text: string }) {
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
    } else {
      await this.get({ index, columnHeader }).locator('textarea').fill(text);
    }
  }

  async inCellExpand({ index, columnHeader }: CellProps) {
    await this.get({ index, columnHeader }).hover();
    await this.waitForResponse({
      uiAction: this.get({ index, columnHeader }).locator('.nc-action-icon >> nth=0').click(),
      requestUrlPathToMatch: '/api/v1/db/data/noco/',
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
      while (count < 5) {
        const innerTexts = await this.get({
          index,
          columnHeader,
        }).allInnerTexts();
        const cellText = typeof innerTexts === 'string' ? [innerTexts] : innerTexts;

        if (cellText) {
          if (cellText.includes(text) || cellText[0].includes(text)) {
            return;
          }
        }
        await this.rootPage.waitForTimeout(1000);
        count++;
        if (count === 5) throw new Error(`Cell text ${text} not found`);
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

  async verifyDateCell({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const _verify = async expectedValue => {
      await expect
        .poll(async () => {
          const cell = await this.get({
            index,
            columnHeader,
          }).locator('input');
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
    const _verify = async expectedBarcodeSvg => {
      await expect
        .poll(async () => {
          const barcodeCell = await this.get({
            index,
            columnHeader,
          });
          const barcodeSvg = await barcodeCell.getByTestId('barcode');
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
    count,
    value,
  }: CellProps & {
    count?: number;
    value: string[];
  }) {
    // const count = value.length;
    const cell = this.get({ index, columnHeader });
    const chips = cell.locator('.chips > .chip');

    // verify chip count & contents
    if (count) await expect(chips).toHaveCount(count);

    // verify only the elements that are passed in
    for (let i = 0; i < value.length; ++i) {
      await expect(await chips.nth(i)).toHaveText(value[i]);
    }
  }

  async unlinkVirtualCell({ index, columnHeader }: CellProps) {
    const cell = this.get({ index, columnHeader });
    await cell.click();
    await cell.locator('.nc-icon.unlink-icon').click();
  }

  async verifyRoleAccess(param: { role: string }) {
    // normal text cell
    const cell = await this.get({ index: 0, columnHeader: 'Country' });
    // editable cell
    await cell.dblclick();
    await expect(await cell.locator(`input`)).toHaveCount(param.role === 'creator' || param.role === 'editor' ? 1 : 0);
    // right click context menu
    await cell.click({ button: 'right' });
    await expect(await this.rootPage.locator(`.nc-dropdown-grid-context-menu:visible`)).toHaveCount(
      param.role === 'creator' || param.role === 'editor' ? 1 : 0
    );

    // virtual cell
    const vCell = await this.get({ index: 0, columnHeader: 'City List' });
    await vCell.hover();
    // in-cell add
    await expect(await vCell.locator('.nc-action-icon.nc-plus:visible')).toHaveCount(
      param.role === 'creator' || param.role === 'editor' ? 1 : 0
    );
    // in-cell expand (all have access)
    await expect(await vCell.locator('.nc-action-icon.nc-arrow-expand:visible')).toHaveCount(1);
    await vCell.click();
    // unlink
    await expect(await vCell.locator('.nc-icon.unlink-icon:visible')).toHaveCount(
      param.role === 'creator' || param.role === 'editor' ? 1 : 0
    );
  }

  async copyToClipboard({ index, columnHeader }: CellProps, ...clickOptions: Parameters<Locator['click']>) {
    await this.get({ index, columnHeader }).click(...clickOptions);
    await (await this.get({ index, columnHeader }).elementHandle()).waitForElementState('stable');

    await this.get({ index, columnHeader }).press((await this.isMacOs()) ? 'Meta+C' : 'Control+C');
    await this.verifyToast({ message: 'Copied to clipboard' });
  }
}
