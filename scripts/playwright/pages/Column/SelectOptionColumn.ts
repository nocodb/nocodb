import { ColumnPageObject } from ".";

export class SelectOptionColumnPageObject {
  readonly column: ColumnPageObject;

  constructor(column: ColumnPageObject) {
    this.column = column;
  }

  async addOption({index, columnTitle,option, skipColumnModal}: {index: number, option: string, skipColumnModal?: boolean, columnTitle?: string}) {
    if(!skipColumnModal && columnTitle) await this.column.openEdit({title: columnTitle});

    await this.column.page.locator('button:has-text("Add option")').click();

    // Fill text=Select options can't be nullAdd option >> input[type="text"]
    await this.column.page.locator(`input[data-pw="select-column-option-input-${index}"]`).click();
    await this.column.page.locator(`input[data-pw="select-column-option-input-${index}"]`).fill(option);

    if(!skipColumnModal && columnTitle) await this.column.save({isUpdated: true});
  }

  async editOption({columnTitle, index, newOption}: {index: number, columnTitle: string, newOption: string}) {
    await this.column.openEdit({title: columnTitle});

    await this.column.page.locator(`input[data-pw="select-column-option-input-${index}"]`).click();
    await this.column.page.locator(`input[data-pw="select-column-option-input-${index}"]`).fill(newOption);

    await this.column.save({isUpdated: true});
  }

  async deleteOption({columnTitle, index}: {index: number, columnTitle: string}) {
    await this.column.openEdit({title: columnTitle});

    await this.column.page.locator(`svg[data-pw="select-column-option-remove-${index}"]`).click();

    await this.column.save({isUpdated: true});
  }

  async reorderOption({columnTitle, sourceOption, destinationOption}: {columnTitle: string, sourceOption: string, destinationOption: string}) {
    await this.column.openEdit({title: columnTitle});

    await this.column.page.waitForTimeout(150);

    await this.column.page.dragAndDrop(`svg[data-pw="select-option-column-handle-icon-${sourceOption}"]`, `svg[data-pw="select-option-column-handle-icon-${destinationOption}"]`, {
      force: true,
    });

    await this.column.save({isUpdated: true});
  }
}