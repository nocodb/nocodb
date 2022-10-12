import { expect } from "@playwright/test";
import { DashboardPage } from ".";
import BasePage from "../Base";

export class TreeViewPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly project: any;

  constructor(dashboard: DashboardPage, project: any) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.project = project;
  }

  get() {
    return this.dashboard.get().locator(".nc-treeview-container");
  }

  async focusTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).focus();
  }

  // assumption: first view rendered is always GRID
  //
  async openTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).click();

    await expect(this.rootPage).toHaveURL(
      `/#/nc/${this.project.id}/table/${title}`
    );
    await this.dashboard
      .get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
    await this.dashboard.get().locator('.nc-grid-add-new-cell').waitFor();
  }

  async createTable({ title }: { title: string }) {
    await this.get().locator(".nc-add-new-table").click();

    await this.dashboard.get().locator(".ant-modal-body").waitFor();

    await this.dashboard.get().locator('[placeholder="Enter table name"]').fill(title);
    await this.dashboard.get().locator('button:has-text("Submit")').click();

    await expect(this.rootPage).toHaveURL(
      `/#/nc/${this.project.id}/table/${title}`
    );
    await this.dashboard.get()
      .locator('[pw-data="grid-load-spinner"]')
      .waitFor({ state: "hidden" });
    await this.dashboard.get().locator('.nc-grid-add-new-cell').waitFor();
  }

  async verifyTable({ title, index }: { title: string; index?: number }) {
    await expect(
      this.get().locator(`.nc-project-tree-tbl-${title}`)
    ).toBeVisible();

    if(index) {
      expect(await this.get().locator('.nc-tbl-title').nth(index)).toHaveText(title);
    }
  }

  async verifyTableDoesNotExist({ title }: { title: string }) {
    await expect(
      await this.get().locator(`.nc-project-tree-tbl-${title}`).count()
    ).toBe(0);
  }

  async deleteTable({ title }: { title: string }) {
    await this.get()
      .locator(`.nc-project-tree-tbl-${title}`)
      .click({ button: "right" });
    await this.dashboard.get()
      .locator('div.nc-project-menu-item:has-text("Delete")')
      .click();
    await this.dashboard.get().locator('button:has-text("Yes")').click();
    await this.toastWait({ message: "Deleted table successfully" });
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    await this.get()
      .locator(`.nc-project-tree-tbl-${title}`)
      .click({ button: "right" });
    await this.dashboard.get()
      .locator('div.nc-project-menu-item:has-text("Rename")')
      .click();
    await this.dashboard.get().locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.dashboard.get().locator('button:has-text("Submit")').click();
    await this.toastWait({  message: "Table renamed successfully" });
  }

  async reorderTables({ sourceTable, destinationTable}: {
    sourceTable: string;
    destinationTable: string;
  }) {

    await this.dashboard.get().locator(`[pw-data="tree-view-table-draggable-handle-${sourceTable}"]`).dragTo(
      this.get().locator(`[pw-data="tree-view-table-${destinationTable}"]`),
    );
  }
}
