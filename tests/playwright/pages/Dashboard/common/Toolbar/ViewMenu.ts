import { expect, Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import pdfParse from 'pdf-parse';
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

  async verifyDownloadAsPDF({
    downloadLocator,
    expectedDataFile,
  }: {
    downloadLocator: Locator;
    expectedDataFile: string;
  }) {
    await downloadLocator.click();

    const modal = this.rootPage.locator('[data-testid="pdf-export-modal"]');
    await expect(modal).toBeVisible();

    const landscapeRadio = modal.locator('[value="landscape"]');
    await landscapeRadio.click();
    expect(await landscapeRadio.isChecked());

    const a5Radio = modal.locator('input[value="a5"]');
    await a5Radio.click();
    expect(await a5Radio.isChecked());

    const exportButton = modal.locator('[data-testId="pdf-export-button"]');
    await expect(exportButton).toBeVisible();

    const [download] = await Promise.all([this.rootPage.waitForEvent('download'), exportButton.click()]);

    const filePath: string = './output/test.pdf';
    await download.saveAs(filePath);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const pdfData = data.text.replace(/\r/g, '').split('\n');

    const filteredData = pdfData.filter(line => line.trim() !== '');

    const formattedData = filteredData.map(line => {
      const columns = line.trim().split(/\s+/); // Split line by whitespace
      return columns.join(','); // Join with commas
    });

    const tempOutputFile: string = './output/test.txt';
    fs.writeFileSync(tempOutputFile, formattedData.join('\n'), 'utf8');

    const expectedData = fs.readFileSync(expectedDataFile, 'utf8');

    const file = fs.readFileSync(tempOutputFile, 'utf8');

    const fileWithoutBOM = file.replace(/^\ufeff/, '');
    const expectedDataWithoutBOM = expectedData.replace(/^\ufeff/, '');

    expect(fileWithoutBOM).toEqual(expectedDataWithoutBOM);
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
      if (subMenu === 'Download CSV') {
        await this.verifyDownloadAsCSV({
          downloadLocator: this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else if (subMenu === 'Download Excel') {
        await this.verifyDownloadAsXLSX({
          downloadLocator: this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadData.txt',
        });
      } else if (subMenu === 'Export PDF') {
        await this.verifyDownloadAsPDF({
          downloadLocator: this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last(),
          expectedDataFile: verificationInfo?.verificationFile ?? './fixtures/expectedBaseDownloadDataPdf.txt',
        });
      } else {
        await this.rootPage.locator(`.ant-dropdown-menu-title-content:has-text("${subMenu}")`).last().click();
      }

      switch (subMenu) {
        case 'Download CSV':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Download Excel':
          await this.verifyToast({
            message: 'Successfully exported all table data',
          });
          break;
        case 'Export PDF':
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
