// playwright-dev-page.ts
import { expect, Locator, Page } from "@playwright/test";
import { BasePage } from "./Base";
import { ExpandedFormPage } from "./ExpandedForm";

export class DashboardPage {
  readonly project: any;
  readonly page: Page;
  readonly tablesSideBar: Locator;
  readonly tabBar: Locator;
  readonly base: BasePage;
  readonly expandedForm: ExpandedFormPage;

  constructor(page: Page, project: any) {
    this.page = page;
    this.base = new BasePage(page);
    this.project = project;
    this.tablesSideBar = page.locator(".nc-treeview-container");
    this.tabBar = page.locator(".nc-tab-bar");
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

  async openTable({ title }: { title: string }) {
    await this.tablesSideBar.locator(`.nc-project-tree-tbl-${title}`).click();
    await this.tabBar
      .textContent()
      .then((text) => expect(text).toContain(title));
  }

  async createTable({ title }: { title: string }) {
    await this.tablesSideBar.locator(".nc-add-new-table").click();

    await this.page.locator(".ant-modal-body").waitFor();

    await this.page.locator('[placeholder="Enter table name"]').fill(title);
    await this.page.locator('button:has-text("Submit")').click();

    await expect(this.page).toHaveURL(
      `/#/nc/${this.project.id}/table/${title}`
    );
    await this.page
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
  }

  async verifyTableExistsInSidebar({ title }: { title: string }) {
    await expect(
      this.tablesSideBar.locator(`.nc-project-tree-tbl-${title}`)
    ).toBeVisible();
  }

  async verifyTableDoesNotExistInSidebar({ title }: { title: string }) {
    await expect(
      await this.tablesSideBar.locator(`.nc-project-tree-tbl-${title}`).count()
    ).toBe(0);
  }

  async deleteTable({ title }: { title: string }) {
    await this.tablesSideBar
      .locator(`.nc-project-tree-tbl-${title}`)
      .click({ button: "right" });
    await this.page
      .locator('div.nc-project-menu-item:has-text("Delete")')
      .click();
    await this.page.locator('button:has-text("Yes")').click();
    await this.base.toastWait({ message: "Deleted table successfully" });
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    await this.tablesSideBar
      .locator(`.nc-project-tree-tbl-${title}`)
      .click({ button: "right" });
    await this.page
      .locator('div.nc-project-menu-item:has-text("Rename")')
      .click();
    await this.page.locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.page.locator('button:has-text("Submit")').click();
    await this.base.toastWait({ message: "Table renamed successfully" });
  }
}
