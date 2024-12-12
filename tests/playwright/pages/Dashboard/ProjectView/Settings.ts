import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { expect } from '@playwright/test';
import { DashboardPage } from '../index';

export class BaseSettingsPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly baseView: ProjectViewPage;

  constructor(baseView: ProjectViewPage) {
    super(baseView.rootPage);

    this.baseView = baseView;
  }

  get() {
    return this.baseView.get().locator('.nc-base-settings');
  }

  async changeTab(tabName: 'snapshots' | 'visibility') {
    await this.get().getByTestId(`${tabName}-tab`).click();

    await this.rootPage.waitForTimeout(1000);
  }

  async createSnapshot({ snapshotName }: { snapshotName: string }) {
    await this.rootPage.getByTestId('add-new-snapshot').click();

    await this.rootPage.waitForTimeout(1000);

    await this.rootPage.locator('.new-snapshot-title').fill(snapshotName);

    await this.rootPage.getByTestId('create-snapshot-btn').click();

    await this.rootPage.waitForTimeout(1000);
  }

  async deleteSnapshot({ snapshotName }: { snapshotName: string }) {
    await this.rootPage.getByTestId(`snapshot-${snapshotName}`).getByTestId('delete-snapshot-btn').click();
    await this.rootPage.getByTestId('nc-delete-modal-delete-btn').click();
    await this.rootPage.waitForTimeout(1000);
  }

  async restoreSnapshot({ snapshotName }: { snapshotName: string }) {
    await this.rootPage.getByTestId(`snapshot-${snapshotName}`).getByTestId('restore-snapshot-btn').click();
    await this.rootPage.getByTestId('confirm-restore-snapshot-btn').click();
    await this.rootPage.waitForTimeout(3000);
  }

  async verifySnapshot({ snapshotName, isVisible }: { snapshotName: string; isVisible: boolean }) {
    const snapshot = this.rootPage.getByTestId(`snapshot-${snapshotName}`);
    if (isVisible) {
      await expect(snapshot).toBeVisible({ visible: true });
    } else {
      await expect(snapshot).toBeVisible({ visible: false });
    }
  }
}
