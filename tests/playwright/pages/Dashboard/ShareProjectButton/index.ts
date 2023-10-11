import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class ShareProjectButtonPage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().getByTestId('share-base-button');
  }

  // Prefixing to differentiate between emails created by the tests which are deleted after the test run
  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
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
    await this.rootPage.getByTestId('docs-share-dlg-share-base').click();
  }

  async clickShareProjectPublic() {
    await this.rootPage.getByTestId('docs-share-dlg-share-base-public').click();
  }

  async clickManageAccess() {
    await this.rootPage.getByTestId('docs-share-manage-access').click();
  }

  async changeRole({
    email,
    role,
    nonEmailPrefixed,
  }: {
    email: string;
    role: 'Editor' | 'Viewer' | 'Remove';
    nonEmailPrefixed?: boolean;
  }) {
    if (!nonEmailPrefixed) email = this.prefixEmail(email);
    await this.rootPage.getByTestId(`nc-manage-users-${email}`).locator('.nc-dropdown-user-role-container').click();
    await this.rootPage.getByTestId(`nc-manage-users-role-${role}`).last().click();
  }

  async submitManageAccess() {
    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId('nc-manage-users-submit').click(),
      httpMethodsToMatch: ['PATCH', 'DELETE'],
      requestUrlPathToMatch: `/users/`,
    });
  }

  async verifyUserCount({ count }: { count: number }) {
    await expect(this.rootPage.getByTestId('nc-manage-user-user-count')).toHaveText(`${count.toString()} users`);
  }

  async verifyUserInList({
    email,
    role,
    isVisible,
  }: {
    email: string;
    role?: 'Editor' | 'Viewer';
    isVisible?: boolean;
  }) {
    if (isVisible) {
      await expect(this.rootPage.getByTestId(`nc-manage-users-${email}`)).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId(`nc-manage-users-${email}`)).not.toBeVisible();
    }
  }

  async fillInviteEmail({ email }: { email: string }) {
    await this.rootPage.getByTestId('docs-share-dlg-share-base-collaborate-emails').fill(this.prefixEmail(email));
  }

  async selectInviteRole({ role }: { role: 'editor' | 'viewer' }) {
    await this.rootPage.getByTestId('docs-share-dlg-share-base-collaborate-role').click();
    await this.rootPage.getByTestId(`nc-share-invite-user-role-option-${role}`).click();
  }

  async clickShareButton() {
    await this.rootPage.getByTestId('docs-share-btn').click();
  }

  async copyInvitationLink() {
    await this.rootPage.getByTestId('docs-share-invitation-copy').click();
  }

  async toggleShareProjectPublic() {
    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId('docs-base-share-public-toggle').click(),
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
    await expect(this.rootPage.getByTestId('docs-base-share-public-toggle')).toHaveAttribute(
      'aria-checked',
      `${isPublic}`
    );
  }

  // Verify that opened page is shared through this page
  async verifyPageSharedParentShare({ parentTitle }: { parentTitle: string }) {
    await expect(this.rootPage.getByTestId(`docs-share-page-parent-share-${parentTitle}`)).toBeVisible();
  }

  async verifyVisibility({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get()).toBeVisible();
    } else {
      await expect(this.get()).not.toBeVisible();
    }
  }

  async getPublicProjectLink() {
    await this.rootPage.getByTestId('docs-share-base-copy-link').click();
    return await this.getClipboardText();
  }

  async getPublicPageLink() {
    await this.rootPage.getByTestId('docs-share-page-copy-link').click();
    return await this.getClipboardText();
  }

  async close() {
    if (await this.rootPage.getByRole('button', { name: 'Finish' }).isVisible()) {
      await this.rootPage.getByRole('button', { name: 'Finish' }).click();
    } else if (await this.rootPage.getByRole('button', { name: 'Cancel' }).isVisible()) {
      await this.rootPage.getByRole('button', { name: 'Cancel' }).click();
    } else {
      await this.rootPage.getByRole('button', { name: 'Close' }).click();
    }
    await this.rootPage.locator('.nc-modal-share-collaborate').waitFor({ state: 'hidden' });
  }
}
