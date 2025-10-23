import { expect } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { ScriptsTopbar } from './Topbar';
import { ScriptsConfigPanel } from './ConfigPanel';
import { ScriptsPlayground } from './Playground';

export class ScriptsPage extends BasePage {
  readonly dashboardPage: DashboardPage;
  readonly topbar: ScriptsTopbar;
  readonly configPanel: ScriptsConfigPanel;
  readonly playground: ScriptsPlayground;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboardPage = dashboard;
    this.topbar = new ScriptsTopbar(this);
    this.configPanel = new ScriptsConfigPanel(this);
    this.playground = new ScriptsPlayground(this);
  }

  get() {
    return this.dashboardPage.get().locator('.nc-scripts-content-resizable-wrapper');
  }

  getEditor() {
    return this.rootPage.getByTestId('nc-scripts-editor');
  }

  async isEditorVisible(): Promise<boolean> {
    return await this.getEditor().isVisible();
  }

  async getEditorContent(): Promise<string> {
    const editorContainer = this.getEditor();
    const content = await editorContainer.getAttribute('data-code');
    return content || '';
  }

  async verifyEditorHasContent(): Promise<void> {
    const content = await this.getEditorContent();
    expect(content.length).toBeGreaterThan(0);
  }

  async setEditorContent(
    content: string,
    scriptId: string,
    workspaceId: string,
    baseId: string,
    api: any
  ): Promise<void> {
    await api.internal.postOperation(
      workspaceId,
      baseId,
      {
        operation: 'updateScript',
      },
      {
        id: scriptId,
        script: content,
      }
    );

    await this.rootPage.waitForTimeout(500);
    await this.dashboardPage.waitForLoaderToDisappear();
  }

  async verifyEditorContentContains(text: string): Promise<void> {
    const content = await this.getEditorContent();
    expect(content).toContain(text);
  }

  getBottomBar() {
    return this.dashboardPage.get().locator('.h-9.border-t-1');
  }

  async toggleEditor(): Promise<void> {
    const toggleButton = this.getBottomBar().locator('button').first();
    await toggleButton.click();
    await this.rootPage.waitForTimeout(300);
  }

  async verifyEditorToggleState(isOpen: boolean): Promise<void> {
    const toggleButton = this.getBottomBar().locator('button').first();
    if (isOpen) {
      await expect(toggleButton).toHaveClass(/bg-nc-bg-brand/);
    } else {
      await expect(toggleButton).not.toHaveClass(/bg-nc-bg-brand/);
    }
  }

  async isPlaygroundVisible(): Promise<boolean> {
    return await this.playground.get().isVisible();
  }
}
