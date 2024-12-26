import { expect, Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
// @ts-ignore
import fs from 'fs';
import XLSX from 'xlsx';

export class ToolbarViewMenuPage extends BasePage {
  readonly toolbar: ToolbarPage;
  readonly viewsMenuBtn: Locator;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
    this.viewsMenuBtn = this.rootPage.locator('.nc-view-context-btn');
  }

  get() {
    return this.rootPage.locator(`.ant-dropdown.nc-dropdown-actions-menu`);
  }

  getLockTypeSubMenu() {
    return this.rootPage.locator(`[id="sub_menu_1_$$_lock-type-popup"]`);
  }

  async verifyDownloadAsCSV({
    downloadLocator,
    expectedDataFile,
  }: {
    downloadLocator: Locator;
    expectedDataFile: string;
  }) {
    const [download] = await Promise.all([
      // Start waiting for the download
      this.rootPage.waitForEvent('download'),
      // Perform the action that initiates download
      downloadLocator.click(),
    ]);

    // Save downloaded file somewhere
    await download.saveAs('./output/test.txt');

    // verify downloaded content against expected content
    const expectedData = fs.readFileSync(expectedDataFile, 'utf8').replace(/\r/g, '').split('\n');
    const file = fs.readFileSync('./output/test.txt', 'utf8').replace(/\r/g, '').split('\n');
    expect(file).toEqual(expectedData);
  }

  async verifyDownloadAsXLSX({
    downloadLocator,
    expectedDataFile,
  }: {
    downloadLocator: Locator;
    expectedDataFile: string;
  }) {
    const [download] = await Promise.all([
      // Start waiting for the download
      this.rootPage.waitForEvent('download'),
      // Perform the action that initiates download
      downloadLocator.click(),
    ]);

    // Save downloaded file somewhere
    await download.saveAs('./output/test.xlsx');

    // convert xlsx to csv
    const wb = XLSX.readFile('./output/test.xlsx');
    XLSX.writeFile(wb, './output/test.txt', { bookType: 'csv' });

    // verify downloaded content against expected content
    const expectedData = fs.readFileSync(expectedDataFile, 'utf8');
    const file = fs.readFileSync('./output/test.txt', 'utf8');
    // XLSX writes file with UTF-8 BOM, adds '\ufeff' to cater it
    expect(file).toEqual('\ufeff' + expectedData);
  }

  // menu items
  //    Collaborative View
  //    Download
  //    Upload
  //    Shared View List
  //    Webhooks
  //    Get API Snippet
  //    ERD View

  // todo: Move verification out of the click method
  async click({ menu, subMenu, verificationInfo }: { menu: string; subMenu?: string; verificationInfo?: any }) {
    await this.viewsMenuBtn.click();

    await this.rootPage.waitForTimeout(1000);

    await this.get().locator(`.ant-dropdown-menu-title-content:has-text("${menu}")`).first().click();
    if (subMenu) {
      // for CSV download, pass locator instead of clicking it here
      if (subMenu === 'CSV') {
        await this.verifyDownloadAsCSV({
          downloadLocator: this.rootPage
            .locator(`.ant-dropdown-menu-item.ant-dropdown-menu-item-only-child:has-text("${subMenu}")`)
            .last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else if (subMenu === 'Excel') {
        await this.verifyDownloadAsXLSX({
          downloadLocator: this.rootPage
            .locator(`.ant-dropdown-menu-item.ant-dropdown-menu-item-only-child:has-text("${subMenu}")`)
            .last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else {
        const locator = this.rootPage.getByTestId(`nc-view-action-lock-subaction-${subMenu}`).last();

        await locator.click();

        if (['Collaborative', 'Locked'].includes(subMenu)) {
          await this.rootPage.locator(`.nc-lock-view-modal-wrapper`).waitFor({ state: 'visible' });
          await this.rootPage.locator(`.nc-lock-view-modal-wrapper`).getByTestId('nc-lock-or-unlock-btn').click();
        }
      }

      switch (subMenu) {
        case 'CSV':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Excel':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Locked View':
          await this.verifyToast({
            message: 'Successfully Switched to locked view',
          });
          break;
        case 'Collaborative View':
          await this.verifyToast({
            message: 'Successfully Switched to collaborative view',
          });
          break;
        default:
          break;
      }
    }
    await this.toolbar.parent.waitLoading();
  }
}
