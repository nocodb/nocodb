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
  // Editor methods
  async getEditorContent(): Promise<string> {
    const editorContainer = this.rootPage.getByTestId('nc-scripts-editor');
    const content = await editorContainer.getAttribute('data-code');
    return content || '';
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
}
