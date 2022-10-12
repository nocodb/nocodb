// playwright-dev-page.ts
import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../Base";
import { GridPage } from "./Grid";
import { ExpandedFormPage } from "./ExpandedForm";
import { TreeViewPage } from "./TreeView";
import { SettingsPage } from "./Settings";
import { ViewSidebarPage } from "./ViewSidebar";

export class DashboardPage extends BasePage {
  readonly project: any;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;
  readonly treeView: TreeViewPage;
  readonly grid: GridPage;
  readonly expandedForm: ExpandedFormPage;
  readonly settings: SettingsPage;
  readonly viewSidebar: ViewSidebarPage;

  constructor(rootPage: Page, project: any) {
    super(rootPage);
    this.project = project;
    this.tablesSideBar = rootPage.locator(".nc-treeview-container");
    this.tabBar = rootPage.locator(".nc-tab-bar");
    this.treeView = new TreeViewPage(this, project);
    this.grid = new GridPage(this);
    this.expandedForm = new ExpandedFormPage(this);
    this.settings = new SettingsPage(this);
    this.viewSidebar = new ViewSidebarPage(this);
  }

  get() {
    return this.rootPage.locator("html");
  }

  async goto() {
    await this.rootPage.goto(`/#/nc/${this.project.id}/auth`);
  }

  async gotoSettings() {
    await this.rootPage.locator('[pw-data="nc-project-menu"]').click();
    await this.rootPage
      .locator('div.nc-project-menu-item:has-text(" Team & Settings")')
      .click();
  }

  async verifyInTabBar({ title }: { title: string }) {
    await this.tabBar
      .textContent()
      .then((text) => expect(text).toContain(title));
  }

  async closeTab({ title }: { title: string }) {
    let tab = await this.tabBar.locator(`.ant-tabs-tab:has-text("${title}")`);
    await tab.locator("button.ant-tabs-tab-remove").click();

    // fix me!
    // await tab.waitFor({ state: "detached" });
    await this.rootPage.waitForTimeout(2000);
  }
}
