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
    this.viewsMenuBtn = this.toolbar.get().locator(`.nc-actions-menu-btn`);
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
    await this.get().locator(`.ant-dropdown-menu-title-content:has-text("${menu}")`).first().click();
    if (subMenu) {
      // for CSV download, pass locator instead of clicking it here
      if (subMenu === 'Download as CSV') {
        await this.verifyDownloadAsCSV({
          downloadLocator: this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else if (subMenu === 'Download as XLSX') {
        await this.verifyDownloadAsXLSX({
          downloadLocator: this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else {
        await this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last().click();
      }

      switch (subMenu) {
        case 'Download as CSV':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Download as XLSX':
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
