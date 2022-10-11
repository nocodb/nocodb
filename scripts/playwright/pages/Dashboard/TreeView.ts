import { expect, Page } from "@playwright/test";
import { BasePage } from "../Base";

export class TreeViewPage {
  readonly page: Page;
  readonly base: BasePage;
  readonly project: any;

  constructor(page: Page, project: any) {
    this.page = page;
    this.project = project;
    this.base = new BasePage(page);
  }

  get() {
    return this.page.locator(".nc-treeview-container");;
  }

  async focusTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).focus();
  }

  async openTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).click();
  }

  async createTable({ title }: { title: string }) {
    await this.get().locator(".nc-add-new-table").click();

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
    await this.page
      .locator('div.nc-project-menu-item:has-text("Delete")')
      .click();
    await this.page.locator('button:has-text("Yes")').click();
    await this.base.toastWait({ message: "Deleted table successfully" });
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    await this.get()
      .locator(`.nc-project-tree-tbl-${title}`)
      .click({ button: "right" });
    await this.page
      .locator('div.nc-project-menu-item:has-text("Rename")')
      .click();
    await this.page.locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.page.locator('button:has-text("Submit")').click();
    await this.base.toastWait({ message: "Table renamed successfully" });
  }

  async reorderTables({ sourceTable, destinationTable}: {
    sourceTable: string;
    destinationTable: string;
  }) {

    await this.page.locator(`[pw-data="tree-view-table-draggable-handle-${sourceTable}"]`).dragTo(
      this.get().locator(`[pw-data="tree-view-table-${destinationTable}"]`),
    );
  }
}
