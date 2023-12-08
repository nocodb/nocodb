import { Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { GridPage } from '../../Grid';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';
import { MapPage } from '../../Map';
import { TopbarSharePage } from './Share';

export class TopbarPage extends BasePage {
  readonly parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage;
  readonly share: TopbarSharePage;

  readonly btn_share: Locator;
  readonly btn_data: Locator;
  readonly btn_details: Locator;

  constructor(parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.share = new TopbarSharePage(this);

    this.btn_share = this.get().locator(`[data-testid="share-base-button"]`);
    this.btn_data = this.get().locator(`.nc-tab:has-text("Data")`);
    this.btn_details = this.get().locator(`.nc-tab:has-text("Details")`);
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

  async openDetailedTab() {
    await this.btn_details.click();
    await this.rootPage.waitForTimeout(500);
  }

  async openDataTab() {
    await this.btn_data.click();
    await this.rootPage.waitForTimeout(500);
  }

  async clickRefresh() {
    await this.get().locator(`.nc-icon-reload`).waitFor({ state: 'visible' });
    await this.get().locator(`.nc-icon-reload`).click();
  }
}
