// playwright-dev-page.ts
import { expect, Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly project: any;
  readonly page: Page;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;

  constructor(page: Page, project: any) {
    this.page = page;
    this.project = project;
    this.tablesSideBar = page.locator('.nc-treeview-container');
    this.tabBar = page.locator('.nc-tab-bar');
  }

  async goto() {
    await this.page.goto(`http://localhost:3000/#/nc/${this.project.id}/auth`);
  }

  async openTable({ title }: { title: string }) {
    await this.tablesSideBar.locator(`.nc-project-tree-tbl-${title}`).click();
    await this.tabBar.textContent().then((text) => expect(text).toContain(title));
  }

  async createTable({ title }: { title: string }) {
    await this.tablesSideBar.locator('.nc-add-new-table').click();

    await this.page.locator('.ant-modal-body').waitFor()

    await this.page.locator('[placeholder="Enter table name"]').fill(title); 
    await this.page.locator('button:has-text("Submit")').click();

    await expect(this.page).toHaveURL(`http://localhost:3000/#/nc/${this.project.id}/table/${title}`);
    await this.page.locator('[pw-data="grid-load-spinner"]').waitFor({ state: 'hidden' });
  }
}