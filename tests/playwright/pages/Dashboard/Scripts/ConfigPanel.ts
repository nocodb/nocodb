import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { ScriptsPage } from './index';

export class ScriptsConfigPanel extends BasePage {
  readonly scriptsPage: ScriptsPage;

  constructor(scriptsPage: ScriptsPage) {
    super(scriptsPage.rootPage);
    this.scriptsPage = scriptsPage;
  }

  get(): Locator {
    return this.rootPage.getByTestId('nc-script-config-panel');
  }

  async verifyVisible(): Promise<void> {
    await expect(this.get()).toBeVisible();
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.rootPage.getByTestId('nc-script-config-title')).toHaveText(title);
  }

  async verifyDescription(description: string): Promise<void> {
    await expect(this.rootPage.getByTestId('nc-script-config-description')).toContainText(description);
  }

  async verifyWarningVisible(): Promise<void> {
    await expect(this.rootPage.getByTestId('nc-script-config-warning')).toBeVisible();
  }

  async fillInput(
    key: string,
    value: string | number,
    type?: 'text' | 'number' | 'select' | 'table' | 'view' | 'field'
  ): Promise<void> {
    if (!type) {
      // Try to find which input exists
      const textInput = this.rootPage.getByTestId(`nc-script-config-text-${key}`);
      const numberInput = this.rootPage.getByTestId(`nc-script-config-number-${key}`);
      const selectInput = this.rootPage.getByTestId(`nc-script-config-select-${key}`);
      const tableInput = this.rootPage.getByTestId(`nc-script-config-table-${key}`);
      const viewInput = this.rootPage.getByTestId(`nc-script-config-view-${key}`);
      const fieldInput = this.rootPage.getByTestId(`nc-script-config-field-${key}`);

      if (await textInput.isVisible().catch(() => false)) {
        type = 'text';
      } else if (await numberInput.isVisible().catch(() => false)) {
        type = 'number';
      } else if (await selectInput.isVisible().catch(() => false)) {
        type = 'select';
      } else if (await tableInput.isVisible().catch(() => false)) {
        type = 'table';
      } else if (await viewInput.isVisible().catch(() => false)) {
        type = 'view';
      } else if (await fieldInput.isVisible().catch(() => false)) {
        type = 'field';
      }
    }

    switch (type) {
      case 'text':
        await this.rootPage.getByTestId(`nc-script-config-text-${key}`).fill(value.toString());
        break;
      case 'number':
        await this.rootPage.getByTestId(`nc-script-config-number-${key}`).fill(value.toString());
        break;
      case 'select':
        await this.rootPage.getByTestId(`nc-script-config-select-${key}`).click();
        await this.rootPage.waitForTimeout(300);
        await this.rootPage
          .locator(`.ant-select-dropdown:visible .ant-select-item`)
          .filter({ hasText: value.toString() })
          .first()
          .click();
        await this.rootPage.waitForTimeout(300);
        break;
      case 'table':
      case 'view':
      case 'field': {
        // Click the selector to open dropdown
        await this.rootPage.getByTestId(`nc-script-config-${type}-${key}`).click();
        await this.rootPage.waitForTimeout(500);

        // Find and click the item in the NcList dropdown
        const dropdown = this.rootPage.locator('.nc-dropdown-list-wrapper:visible, .nc-list-wrapper:visible');
        await dropdown.waitFor({ state: 'visible', timeout: 5000 });

        // Click the item by text
        const item = dropdown.locator('.nc-list-item').filter({ hasText: value.toString() }).first();
        await item.click();
        await this.rootPage.waitForTimeout(300);
        break;
      }
    }
  }

  async save(): Promise<void> {
    await this.rootPage.getByTestId('nc-script-config-save-btn').click();
    await this.rootPage.waitForTimeout(1000);
  }
}
