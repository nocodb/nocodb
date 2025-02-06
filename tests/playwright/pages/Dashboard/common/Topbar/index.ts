import { expect, Locator } from '@playwright/test';
import * as fs from 'fs';

import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';
import { MapPage } from '../../Map';
import { TopbarSharePage } from './Share';
import { CalendarPage } from '../../Calendar';

export class TopbarPage extends BasePage {
  readonly parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage | CalendarPage;
  readonly share: TopbarSharePage;

  readonly btn_share: Locator;
  readonly btn_data: Locator;
  readonly btn_details: Locator;
  readonly btn_cmdK: Locator;
  readonly btn_extension: Locator;

  constructor(parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage | CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.share = new TopbarSharePage(this);

    this.btn_share = this.get().locator(`[data-testid="share-base-button"]`);
    this.btn_data = this.get().locator(`.nc-tab:has-text("Data")`);
    this.btn_details = this.get().locator(`.nc-tab:has-text("Details")`);
    this.btn_cmdK = this.rootPage.locator('[data-testid="nc-topbar-cmd-k-btn"]');
    this.btn_extension = this.get().locator('[data-testid="nc-topbar-extension-btn"]');
  }

  get() {
    return this.rootPage.locator(`.nc-table-topbar`);
  }

  async clickShare() {
    await this.btn_share.click();
  }

  async getSharedViewUrl(surveyMode = false, password = '', download = false) {
    await this.clickShare();
    // await this.share.clickShareView();
    await this.share.clickShareViewPublicAccess();
    await this.share.clickCopyLink();
    if (surveyMode) {
      await this.share.clickShareViewSurveyMode();
    }

    if (password !== '') {
      await this.share.clickShareViewWithPassword({ password });
    }

    if (download) {
      await this.share.clickShareViewWithCSVDownload();
    }

    await this.share.closeModal();
    return await this.getClipboardText();
  }

  async getSharedBaseUrl({ role, enableSharedBase }: { role: string; enableSharedBase: boolean }) {
    await this.clickShare();
    if (enableSharedBase) await this.share.clickShareBasePublicAccess();

    if (role === 'editor' && enableSharedBase) {
      await this.share.clickShareBaseEditorAccess();
    } else if (role === 'viewer' && !enableSharedBase) {
      await this.share.clickShareBaseEditorAccess();
    }
    await this.share.clickCopyLink();
    await this.share.closeModal();
    return await this.getClipboardText();
  }

  async openDetailedTab({ waitForResponse = true } = {}) {
    if (waitForResponse) {
      await this.waitForResponse({
        uiAction: async () => await this.btn_details.click(),
        requestUrlPathToMatch: 'api/v1/db/meta/tables/',
        httpMethodsToMatch: ['GET'],
        responseJsonMatcher: json => json['hash'],
      });
    } else {
      await this.btn_details.click();
    }
    await this.rootPage.waitForTimeout(500);
  }

  async openDataTab() {
    await this.waitForResponse({
      uiAction: async () => await this.btn_data.click(),
      requestUrlPathToMatch: 'api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
      responseJsonMatcher: json => json['list'],
    });
    await this.rootPage.waitForTimeout(500);
  }

  async clickRefresh() {
    await this.get().locator(`.nc-icon-reload`).waitFor({ state: 'visible' });
    await this.get().locator(`.nc-icon-reload`).click();
    await this.rootPage.waitForLoadState('networkidle');
    await new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, 200);
    });
  }

  async clickDownload(type: string, verificationFile = 'expectedData.txt') {
    await this.get().locator(`.nc-toolbar-btn.nc-actions-menu-btn`).click();

    const [download] = await Promise.all([
      // Start waiting for the download
      this.rootPage.waitForEvent('download'),
      // Perform the action that initiates download
      this.rootPage
        .locator(`.nc-dropdown-actions-menu`)
        .locator(`li.ant-dropdown-menu-item:has-text("${type}")`)
        .click(),
    ]);

    // Save downloaded file somewhere
    await download.saveAs('./output/at.txt');

    // verify downloaded content against expected content
    const expectedData = fs.readFileSync(`./fixtures/${verificationFile}`, 'utf8').replace(/\r/g, '').split('\n');
    const file = fs.readFileSync('./output/at.txt', 'utf8').replace(/\r/g, '').split('\n');
    expect(file).toEqual(expectedData);
  }

  async verifyQuickActions({ isVisible }: { isVisible: boolean }) {
    if (isVisible) await expect(this.btn_cmdK).toBeVisible();
    else await expect(this.btn_cmdK).toHaveCount(0);
  }
}
