// playwright-dev-page.ts
import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./Base";
import { ExpandedFormPage } from "./ExpandedForm";
import { TreeViewPage } from "./TreeView";

export class DashboardPage {
  readonly project: any;
  readonly page: Page;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;
  readonly base: BasePage;
  readonly expandedForm: ExpandedFormPage;
  readonly treeView: TreeViewPage;

  constructor(page: Page, project: any) {
    this.page = page;
    this.base = new BasePage(page);
    this.project = project;
    this.tablesSideBar = page.locator(".nc-treeview-container");
    this.tabBar = page.locator(".nc-tab-bar");
    this.expandedForm = new ExpandedFormPage(page);
    this.treeView = new TreeViewPage(page, project);
  }

  async goto() {
    await this.page.goto(`/#/nc/${this.project.id}/auth`);
  }

  async gotoSettings() {
    await this.page.locator('[pw-data="nc-project-menu"]').click();
    await this.page
      .locator('div.nc-project-menu-item:has-text(" Team & Settings")')
      .click();
  }

  async verifyTableIsInTabBar({ title }: { title: string }) {
    await this.tabBar
      .textContent()
      .then((text) => expect(text).toContain(title));
  }
}
