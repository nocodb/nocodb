import BasePage from '../Base';
import { WorkspacePage } from './';
import { Locator } from '@playwright/test';

/*
  nc-workspace-settings
    nc-collaborator-table-container
 */

export class CollaborationPage extends BasePage {
  readonly workspace: WorkspacePage;
  readonly button_addUser: Locator;
  readonly input_email: Locator;
  readonly selector_role: Locator;
  readonly list_collaborators: Locator;

  constructor(workspace: WorkspacePage) {
    super(workspace.rootPage);
    this.workspace = workspace;
    this.button_addUser = this.get().locator('button.ant-btn.ant-btn-primary');
    this.input_email = this.get().locator('input[id="email"]');
    this.selector_role = this.get().locator('[data-testid="invite"] >> [data-testid="roles"]');
    this.list_collaborators = this.get().locator('.nc-collaborators-list-table');
  }

  get() {
    return this.workspace.get().locator('.nc-workspace-settings').locator('.nc-collaborator-table-container');
  }

  async waitFor({ state }) {
    await this.get().waitFor({ state });
  }

  async addUsers(email: string, role: string) {
    await this.waitFor({ state: 'visible' });

    // email
    await this.input_email.fill(email);
    await this.rootPage.keyboard.press('Enter');

    // role
    await this.selector_role.click();
    const menu = this.rootPage.locator('.nc-role-select-dropdown:visible');
    await menu.locator(`.nc-role-select-workspace-level-${role.toLowerCase()}:visible`).click();

    // submit

    // allow button to be enabled
    await this.rootPage.waitForTimeout(500);
    await this.rootPage.keyboard.press('Enter');
    await this.button_addUser.click();
    await this.verifyToast({ message: 'Invitation sent successfully' });
    await this.rootPage.waitForTimeout(500);
  }

  async getCollaboratorsCount() {
    await this.waitFor({ state: 'visible' });
    const collaborators = await this.list_collaborators.locator('tr.ant-table-row').count();
    return collaborators;
  }

  async getCollaborator({ index }: { index: number }) {
    await this.waitFor({ state: 'visible' });
    const email = await this.list_collaborators
      .locator('tr.ant-table-row')
      .nth(index)
      .locator('td.ant-table-cell')
      .nth(0)
      .innerText();
    const role = await this.list_collaborators
      .locator('tr.ant-table-row')
      .nth(index)
      .locator('td.ant-table-cell')
      .nth(1)
      .innerText();
    return { email, role };
  }

  async removeCollaborator({ index }: { index: number }) {
    await this.waitFor({ state: 'visible' });
    await this.list_collaborators
      .locator('tr.ant-table-row')
      .nth(index)
      .locator('td.ant-table-cell')
      .nth(2)
      .locator('button')
      .click();
  }
}
