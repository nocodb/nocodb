import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class ShareProjectButtonPage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().getByTestId('share-project-button');
  }

  async verifyShareStatus({ visibility }: { visibility: 'public' | 'private' }) {
    await expect(this.rootPage.locator(`[data-sharetype="${visibility}"]`)).toBeVisible();
  }

  async open() {
    await this.get().click();
    await this.rootPage.locator('.nc-modal-share-collaborate').waitFor({ state: 'visible' });
  }

  async clickSharePage() {
    await this.rootPage.getByTestId('docs-share-dlg-share-page').click();
  }

  async clickShareProject() {
    await this.rootPage.getByTestId('docs-share-dlg-share-project').click();
  }

  async clickShareProjectPublic() {
    await this.rootPage.getByTestId('docs-share-dlg-share-project-public').click();
  }

  async toggleShareProjectPublic() {
    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId('docs-project-share-public-toggle').click(),
      httpMethodsToMatch: ['PATCH'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects`,
    });
  }

  async toggleSharePage() {
    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId('docs-share-page-toggle').click(),
      httpMethodsToMatch: ['PUT'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });
  }

  async verifySharePageToggle({ isPublic }: { isPublic: boolean }) {
    await expect(this.rootPage.getByTestId('docs-share-page-toggle')).toHaveAttribute('aria-checked', `${isPublic}`);
  }

  async verifyShareProjectToggle({ isPublic }: { isPublic: boolean }) {
    await expect(this.rootPage.getByTestId('docs-project-share-public-toggle')).toHaveAttribute(
      'aria-checked',
      `${isPublic}`
    );
  }

  async verifyVisibility({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get()).toBeVisible();
    } else {
      await expect(this.get()).not.toBeVisible();
    }
  }

  async getPublicProjectLink() {
    await this.rootPage.getByTestId('docs-share-project-copy-link').click();
    return await this.getClipboardText();
  }

  async getPublicPageLink() {
    await this.rootPage.getByTestId('docs-share-page-copy-link').click();
    return await this.getClipboardText();
  }

  async close() {
    if (await this.rootPage.getByRole('button', { name: 'Finish' }).isVisible()) {
      await this.rootPage.getByRole('button', { name: 'Finish' }).click();
    } else {
      await this.rootPage.getByRole('button', { name: 'Cancel' }).click();
    }
    await this.rootPage.locator('.nc-modal-share-collaborate').waitFor({ state: 'hidden' });
  }
}
