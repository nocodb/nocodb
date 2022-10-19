import { Locator, expect } from "@playwright/test";
import BasePage from "../../../Base";
import { GridPage } from "../../Grid";
import { ToolbarPage } from "./index";

export class ToolbarViewMenuPage extends BasePage {
  readonly toolbar: ToolbarPage;
  readonly viewsMenuBtn: Locator;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
    this.viewsMenuBtn = this.toolbar.get().locator(`.nc-actions-menu-btn`);
  }

  get() {
    return this.rootPage.locator(`.ant-dropdown.nc-dropdown-actions-menu`);
  }

  getLockTypeSubMenu() {
    return this.rootPage.locator(`[id="sub_menu_1_$$_lock-type-popup"]`);
  }

  // menu items
  //    Collaborative View
  //    Download
  //    Upload
  //    Shared View List
  //    Webhooks
  //    Get API Snippet
  //    ERD View

  async click({ menu, subMenu }: { menu: string; subMenu?: string }) {
    await this.viewsMenuBtn.click();
    await this.get()
      .locator(`.ant-dropdown-menu-title-content:has-text("${menu}")`)
      .first()
      .click();
    if (subMenu) {
      await this.getLockTypeSubMenu()
        .locator(`.nc-locked-menu-item:has-text("${subMenu}")`)
        .last()
        .click();
      switch (subMenu) {
        case "Locked View":
          await this.toastWait({
            message: "Successfully Switched to locked view",
          });
          break;
        case "Collaborative View":
          await this.toastWait({
            message: "Successfully Switched to collaborative view",
          });
          break;
        default:
          break;
      }
    }
    await this.toolbar.parent.waitLoading();
  }

  async verifyLockMode() {
    expect(
      await this.toolbar.get().locator(`.nc-fields-menu-btn.nc-toolbar-btn`)
    ).toBeDisabled();
    expect(
      await this.toolbar.get().locator(`.nc-filter-menu-btn.nc-toolbar-btn`)
    ).toBeDisabled();
    expect(
      await this.toolbar.get().locator(`.nc-sort-menu-btn.nc-toolbar-btn`)
    ).toBeDisabled();
    expect(
      await this.toolbar
        .get()
        .locator(`.nc-add-new-row-btn.nc-toolbar-btn > .nc-icon.disabled`)
    ).toBeVisible();

    await (this.toolbar.parent as GridPage).verifyEditDisabled({ columnHeader: "Country" });
  }

  async verifyCollaborativeMode() {
    expect(
      await this.toolbar.get().locator(`.nc-fields-menu-btn.nc-toolbar-btn`)
    ).toBeEnabled();
    expect(
      await this.toolbar.get().locator(`.nc-filter-menu-btn.nc-toolbar-btn`)
    ).toBeEnabled();
    expect(
      await this.toolbar.get().locator(`.nc-sort-menu-btn.nc-toolbar-btn`)
    ).toBeEnabled();
    expect(
      await this.toolbar
        .get()
        .locator(`.nc-add-new-row-btn.nc-toolbar-btn > .nc-icon`)
    ).toBeVisible();

    await (this.toolbar.parent as GridPage).verifyEditEnabled({ columnHeader: "Country" });
  }
}
