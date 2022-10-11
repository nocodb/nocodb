// playwright-dev-page.ts
import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../Base";
import { GridPage } from "./Grid";
import { ExpandedFormPage } from "./Grid/ExpandedForm";
import { TreeViewPage } from "./TreeView";

export class DashboardPage {
  readonly project: any;
  readonly page: Page;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;
  readonly base: BasePage;
  readonly treeView: TreeViewPage;
  readonly grid: GridPage;
  readonly expandedForm: ExpandedFormPage;

  constructor(page: Page, project: any) {
    this.page = page;
    this.base = new BasePage(page);
    this.project = project;
    this.tablesSideBar = page.locator(".nc-treeview-container");
    this.tabBar = page.locator(".nc-tab-bar");
    this.treeView = new TreeViewPage(page, project);
    this.grid = new GridPage(page);
    this.expandedForm = new ExpandedFormPage(page);
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
