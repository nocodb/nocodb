import { Page, expect } from "@playwright/test";
import { GridPage } from "..";
import BasePage from "../../../Base";
import { SelectOptionColumnPageObject } from "./SelectOptionColumn";

export class ColumnPageObject extends BasePage {
  readonly grid: GridPage;
  readonly selectOption: SelectOptionColumnPageObject;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
    this.selectOption = new SelectOptionColumnPageObject(this);
  }

  get() {
    return this.rootPage.locator('form[data-pw="add-or-edit-column"]');
  }

  async create({
    title,
    type = "SingleLineText",
  }: {
    title: string;
    type?: string;
  }) {
    await this.grid.get().locator(".nc-column-add").click();
    // await this.get().waitFor();

    await this.fillTitle({ title });

    await this.selectType({ type });

    switch (type) {
      case "SingleTextLine":
        break;
      case "SingleSelect":
      case "MultiSelect":
        await this.selectOption.addOption({
          index: 0,
          option: "Option 1",
          skipColumnModal: true,
        });
        await this.selectOption.addOption({
          index: 1,
          option: "Option 2",
          skipColumnModal: true,
        });
        break;
      default:
        break;
    }

    await this.save();
  }

  async fillTitle({ title }: { title: string }) {
    await this.get().locator(".nc-column-name-input").fill(title);
  }

  async selectType({ type }: { type: string }) {
    await this.get()
      .locator(".ant-select-selector > .ant-select-selection-item")
      .click();

    await this.get()
      .locator('.ant-select-selection-search-input[aria-expanded="true"]')
      .waitFor();
    await this.get()
      .locator('.ant-select-selection-search-input[aria-expanded="true"]')
      .fill(type);

    // Select column type
    await this.rootPage.locator(`text=${type}`).nth(1).click();
  }

  async delete({ title }: { title: string }) {
    await this.grid
      .get()
      .locator(`th[data-title="${title}"] >> svg.ant-dropdown-trigger`)
      .click();
    // await this.rootPage.locator('li[role="menuitem"]:has-text("Delete")').waitFor();
    await this.rootPage
      .locator('li[role="menuitem"]:has-text("Delete")')
      .click();

    await this.rootPage.locator('button:has-text("Delete")').click();

    // wait till modal is closed
    await this.rootPage
      .locator(".nc-modal-column-delete")
      .waitFor({ state: "hidden" });
  }

  async openEdit({ title }: { title: string }) {
    // todo: Improve this selector
    await this.grid
      .get()
      .locator(`text=#Title${title} >> svg >> nth=3`)
      .click();
    await this.rootPage.locator('li[role="menuitem"]:has-text("Edit")').click();

    await this.get().waitFor({ state: "visible" });
  }

  async save({ isUpdated }: { isUpdated?: boolean } = {}) {
    await this.get().locator('button:has-text("Save")').click();

    await this.toastWait({
      message: isUpdated ? "Column updated" : "Column created",
    });
    await this.get().waitFor({ state: "hidden" });
    await this.rootPage.waitForTimeout(200);
  }

  async verify({ title, isVisible }: { title: string; isVisible?: boolean }) {
    if (isVisible) {
      return expect(
        await this.rootPage.locator(`th[data-title="${title}"]`).count()
      ).toBe(0);
    }
    await expect(this.rootPage.locator(`th[data-title="${title}"]`)).toHaveText(
      title
    );
  }
}
