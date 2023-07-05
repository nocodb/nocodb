import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarSharePage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-modal-share-collaborate`).locator('.ant-modal-content');
  }

  async clickShareView() {
    await this.get().locator(`[data-testid="docs-share-dlg-share-view"]`).click();
  }

  async clickShareProject() {
    await this.get().locator(`[data-testid="docs-share-dlg-share-project"]`).click();
  }

  async clickShareViewToggle() {
    await this.get().locator(`[data-testid="share-view-toggle"]`).click();
  }

  async clickCopyLink() {
    await this.get().locator(`[data-testid="docs-share-page-copy-link"]`).click();
  }

  async closeModal() {
    await this.rootPage.keyboard.press('Escape');
  }

  async clickShareViewWithPassword() {
    await this.get().locator(`[data-testid="share-password-toggle"]`).click();
  }

  async clickShareViewWithCSVDownload() {
    await this.get().locator(`[data-testid="share-download-toggle"]`).click();
  }

  async clickShareBase() {
    await this.get().locator(`[data-testid="db-share-base"]`).click();
  }

  async clickShareBaseToggle() {
    await this.get().locator(`[data-testid="nc-share-base-sub-modal"]`).locator('.ant-switch-checked').nth(0).click();
  }

  async clickShareBaseEditorToggle() {
    await this.get().locator(`[data-testid="nc-share-base-sub-modal"]`).locator('.ant-switch-checked').nth(1).click();
  }
}
