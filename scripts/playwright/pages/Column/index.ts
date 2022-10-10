import { Page, expect } from "@playwright/test";
import { BasePage } from "../Base";
import {SelectOptionColumnPageObject} from "./SelectOptionColumn";

export class ColumnPageObject {
  readonly page: Page;
  readonly basePage: BasePage;
  readonly selectOption: SelectOptionColumnPageObject;

  constructor(page: Page) {
    this.page = page;
    this.selectOption = new SelectOptionColumnPageObject(this);
    this.basePage = new BasePage(this.page);
  }

  get() {
    return this.page.locator('[data-pw="add-or-edit-column"]');
  }

  async create({title, type = "SingleLineText"}: {title: string, type?: string}) {
    await this.page.locator('.nc-column-add').click();

    await this.page.locator('form[data-pw="add-or-edit-column"]').waitFor();

    await this.fillTitle({title});
    
    await this.selectType({type});

    switch (type) {
      case "SingleTextLine":
        break;
      case 'SingleSelect':
      case 'MultiSelect':
        await this.selectOption.addOption({index: 0, option: 'Option 1', skipColumnModal: true});
        await this.selectOption.addOption({index: 1, option: 'Option 2', skipColumnModal: true});
        break;
      default:
        break;
    }

    await this.save();
  }

  async fillTitle({title}: {title: string}) {
    await this.page.locator('.nc-column-name-input').fill(title);
  }

  async selectType({type}: {type: string}) {
    await this.get().locator('.ant-select-selector > .ant-select-selection-item').click();

    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

    // Select column type
    await this.page.locator(`text=${type}`).nth(1).click();
  }

  async delete({title}: {title: string}) {
    await this.page.locator(`text=#Title${title} >> svg >> nth=3`).click();
    await this.page.locator('li[role="menuitem"]:has-text("Delete")').waitFor()
    await this.page.locator('li[role="menuitem"]:has-text("Delete")').click();

    await this.page.locator('button:has-text("Delete")').click();

    // wait till modal is closed
    await this.page.locator('.nc-modal-column-delete').waitFor({state: 'hidden'});
  }
  
  async openEdit({title}: {title: string}) {
    await this.page.locator(`text=#Title${title} >> svg >> nth=3`).click();
    await this.page.locator('li[role="menuitem"]:has-text("Edit")').waitFor()
    await this.page.locator('li[role="menuitem"]:has-text("Edit")').click();

    await this.page.locator('form[data-pw="add-or-edit-column"]').waitFor();
  }

  async save({isUpdated}: {isUpdated?: boolean} = {}) {
    await this.page.locator('button:has-text("Save")').click();

    await this.basePage.toastWait({message: isUpdated ? 'Column updated' : 'Column created'});
    await this.page.locator('form[data-pw="add-or-edit-column"]').waitFor({state: 'hidden'});
    await this.page.waitForTimeout(200);
  }
}