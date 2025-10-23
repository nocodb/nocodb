import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { ScriptsPage } from './index';

export class ScriptsTopbar extends BasePage {
  readonly scriptsPage: ScriptsPage;

  constructor(scriptsPage: ScriptsPage) {
    super(scriptsPage.rootPage);
    this.scriptsPage = scriptsPage;
  }

  // Settings button
  getSettingsButton(): Locator {
    return this.rootPage.getByTestId('nc-script-settings-btn');
  }

  async clickSettings(): Promise<void> {
    await this.getSettingsButton().click();
    await this.rootPage.waitForTimeout(500);
  }

  async verifySettingsButtonVisible(): Promise<void> {
    await expect(this.getSettingsButton()).toBeVisible();
  }

  async verifySettingsButtonActive(isActive: boolean): Promise<void> {
    const button = this.rootPage.getByTestId('nc-script-settings-btn');
    if (isActive) {
      await expect(button).toHaveClass(/is-settings-open/);
    } else {
      await expect(button).not.toHaveClass(/is-settings-open/);
    }
  }

  // Run button
  getRunButton(): Locator {
    return this.rootPage.getByTestId('nc-script-run-btn');
  }

  async clickRun(): Promise<void> {
    await this.getRunButton().click();
    await this.rootPage.waitForTimeout(500);
  }

  async verifyRunButtonVisible(): Promise<void> {
    await expect(this.getRunButton()).toBeVisible();
  }

  async verifyRunButtonEnabled(): Promise<void> {
    await expect(this.getRunButton()).toBeEnabled();
  }

  async verifyRunButtonState(enabled: boolean): Promise<void> {
    if (enabled) {
      await expect(this.getRunButton()).toBeEnabled();
    } else {
      await expect(this.getRunButton()).toBeDisabled();
    }
  }

  // Stop button
  getStopButton(): Locator {
    return this.rootPage.getByTestId('nc-script-stop-btn');
  }

  async clickStop(): Promise<void> {
    await this.getStopButton().click();
    await this.rootPage.waitForTimeout(500);
  }

  async verifyStopButtonVisible(): Promise<void> {
    await expect(this.getStopButton()).toBeVisible();
  }

  // Restart button
  getRestartButton(): Locator {
    return this.rootPage.getByTestId('nc-script-restart-btn');
  }

  async clickRestart(): Promise<void> {
    await this.getRestartButton().click();
    await this.rootPage.waitForTimeout(500);
  }

  async verifyScriptState({ state }: { state: 'running' | 'stopped' }) {
    const elem = this.rootPage.getByTestId('nc-script-running-indicator');
    if (state === 'running') {
      await expect(elem).toBeVisible();
    } else {
      await expect(elem).not.toBeVisible();
    }
  }

  // Wait for execution to complete
  async waitForExecutionComplete(timeout: number = 10000): Promise<void> {
    await this.rootPage.waitForTimeout(500);

    // Wait for running indicator to disappear
    const runningIndicator = this.rootPage.getByTestId('nc-script-running-indicator');
    await runningIndicator.waitFor({ state: 'hidden', timeout });

    await this.rootPage.waitForTimeout(500);
  }

  async runScript(): Promise<void> {
    await this.clickRun();
    await this.waitForExecutionComplete();
  }

  get(): Locator {
    return this.rootPage.locator('.nc-table-topbar');
  }
}
