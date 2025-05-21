import { Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';

export class Extensions extends BasePage {
  readonly dashboardPage: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboardPage = dashboard;
  }

  async toggleExtensionButton() {
    const button = this.dashboardPage.get().getByTestId('nc-topbar-extension-btn');
    if (!(await button.isVisible()))
      throw new Error('Extension feature not enabled. Table/View must be open for extension to run.');
    await button.click();
  }

  isExtensionPaneOpen() {
    return this.getExtensionPane().isVisible();
  }

  get(): Locator {
    return this.getExtensionPane();
  }

  getExtensionPane() {
    return this.dashboardPage.get().locator('div.splitpanes__pane.nc-extension-pane');
  }

  async getInstalledExtensions() {
    const extensionPaneOpen = await this.isExtensionPaneOpen();
    if (!extensionPaneOpen) {
      await this.toggleExtensionButton();
    }
    const extensionPane = this.getExtensionPane();
    await this.dashboardPage.waitForLoaderToDisappear();

    const listLocator = extensionPane.locator('div.nc-extension-list-wrapper');
    return listLocator.locator('div.nc-extension-item').all();
  }

  getInstalledExtension(name: string) {
    return this._getInstalledExtension({ name });
  }

  getInstalledExtensionById(id: string) {
    return this._getInstalledExtension({ id });
  }

  getFirstInstalledExtension() {
    return this._getInstalledExtension({ first: true });
  }

  private async _getInstalledExtension({ name, id, first = false }: { name?: string; first?: boolean; id?: string }) {
    const installedExtensions = await this.getInstalledExtensions();
    if (installedExtensions.length === 0) {
      throw new Error('No installed extensions found.');
    }
    if (first) {
      return installedExtensions[0];
    }
    for (const ie of installedExtensions) {
      if (
        (name && (await ie.locator('span.extension-title').textContent()) === name) ||
        (id && (await ie.locator('div').first().getAttribute('data-testid')) === id)
      ) {
        return ie;
      }
    }
    return undefined;
  }

  addExtension({ id }: { id: string }) {
    return this._addExtension({ id });
  }

  addFirstExtension() {
    return this._addExtension({ first: true });
  }

  private async _addExtension({ id, first = false }: { id?: string; first?: boolean }) {
    const extensionPaneOpen = await this.isExtensionPaneOpen();
    if (!extensionPaneOpen) {
      await this.toggleExtensionButton();
    }
    const extensionPane = this.getExtensionPane();
    const addExtensionButton = extensionPane.locator('button.ant-btn.ant-btn-primary');
    await addExtensionButton.click();
    const extensionMarketModal = this.dashboardPage.get().locator('div.nc-modal-extension-market');
    if (first) {
      const availableExtensions = await extensionMarketModal.locator('div.nc-market-extension-item').all();
      if (availableExtensions.length === 0) {
        throw new Error('No extensions available in the marketplace.');
      }
      await availableExtensions[0].locator('button.ant-btn.ant-btn-secondary.small').click();
    } else if (id) {
      const e = extensionMarketModal.getByTestId(`nc-extension-${id}`);
      if (await e.isVisible()) {
        await e.locator('button.ant-btn.ant-btn-secondary.small').click();
        await this.dashboardPage.waitForLoaderToDisappear();
      } else {
        throw new Error(`No extension with id ${id} found in the marketplace.`);
      }
    }
  }
}
