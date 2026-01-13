import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { ScriptsPage } from './index';

export class ScriptsPlayground extends BasePage {
  readonly scriptsPage: ScriptsPage;

  constructor(scriptsPage: ScriptsPage) {
    super(scriptsPage.rootPage);
    this.scriptsPage = scriptsPage;
  }

  get(): Locator {
    return this.rootPage.locator('.nc-playground-container').first();
  }

  async verifyTextOutput(text: string): Promise<void> {
    const textItem = this.rootPage.getByTestId('nc-playground-text-output').filter({ hasText: text });
    await expect(textItem).toBeVisible({ timeout: 10000 });
  }

  async verifyMarkdownOutput(text: string): Promise<void> {
    const markdownItem = this.rootPage.getByTestId('nc-playground-markdown-output').filter({ hasText: text });
    await expect(markdownItem).toBeVisible({ timeout: 10000 });
  }

  async verifyTableOutput(): Promise<void> {
    const tableItem = this.rootPage.getByTestId('nc-playground-table-output');
    await expect(tableItem).toBeVisible({ timeout: 10000 });
  }

  async verifyInspectOutput(): Promise<void> {
    const inspectItem = this.rootPage.getByTestId('nc-playground-inspect-output');
    await expect(inspectItem).toBeVisible({ timeout: 10000 });
  }

  // Input interaction methods
  async fillTextInput(label: string, value: string): Promise<void> {
    const inputContainer = this.rootPage.getByTestId('nc-playground-input');
    await inputContainer.waitFor({ state: 'visible', timeout: 10000 });

    const textInput = inputContainer.locator('input[type="text"], textarea').first();
    await textInput.fill(value);

    const submitButton = inputContainer.locator('button').first();
    await submitButton.click();
    await this.rootPage.waitForTimeout(500);
  }

  async clickButton(buttonLabel: string): Promise<void> {
    const inputContainer = this.rootPage.getByTestId('nc-playground-input');
    await inputContainer.waitFor({ state: 'visible', timeout: 10000 });

    const button = inputContainer.locator(`button:has-text("${buttonLabel}")`);
    await button.click();
    await this.rootPage.waitForTimeout(500);
  }

  async selectOption(optionLabel: string): Promise<void> {
    const inputContainer = this.rootPage.getByTestId('nc-playground-input');
    await inputContainer.waitFor({ state: 'visible', timeout: 10000 });

    const select = inputContainer.locator('select, .ant-select').first();
    await select.click();
    await this.rootPage.waitForTimeout(300);

    const option = this.rootPage.locator(`.ant-select-dropdown:visible .ant-select-item:has-text("${optionLabel}")`);
    await option.click();
    await this.rootPage.waitForTimeout(500);
  }

  async uploadFile(filePath: string): Promise<void> {
    const inputContainer = this.rootPage.getByTestId('nc-playground-input');
    await inputContainer.waitFor({ state: 'visible', timeout: 10000 });

    const fileInput = inputContainer.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.rootPage.waitForTimeout(1000);
  }

  // Generic output verification
  async verifyOutputContains(text: string): Promise<void> {
    await expect(this.get()).toContainText(text, { timeout: 10000 });
  }

  async verifyOutputNotContains(text: string): Promise<void> {
    await expect(this.get()).not.toContainText(text);
  }

  // Verify playground is cleared (no items)
  async verifyClear(): Promise<void> {
    // After clear, playground items should not exist
    const playgroundItems = this.rootPage.locator('[data-testid^="nc-playground-item-"]');
    await expect(playgroundItems).toHaveCount(0);
  }

  // Verify empty state message
  async verifyEmptyState(): Promise<void> {
    const emptyMessage = this.rootPage.getByTestId('nc-playground-empty');
    await expect(emptyMessage).toBeVisible();
  }

  // Workflow step verification
  async verifyWorkflowStep(title: string): Promise<void> {
    const workflowStep = this.get().locator('.workflow-step-card .step-header', { hasText: title });
    await expect(workflowStep).toBeVisible({ timeout: 10000 });
  }
}
