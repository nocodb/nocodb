import { ColumnPageObject } from '.';
import BasePage from '../../../Base';

export class SelectOptionColumnPageObject extends BasePage {
  readonly column: ColumnPageObject;

  constructor(column: ColumnPageObject) {
    super(column.rootPage);
    this.column = column;
  }

  get() {
    return this.column.get();
  }

  async addOption({
    index,
    columnTitle,
    option,
    skipColumnModal,
  }: {
    index: number;
    option: string;
    skipColumnModal?: boolean;
    columnTitle?: string;
  }) {
    if (!skipColumnModal && columnTitle) await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator('button:has-text("Add option")').click();

    // Fill text=Select options can't be nullAdd option >> input[type="text"]
    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).click();
    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).fill(option);

    if (!skipColumnModal && columnTitle) await this.column.save({ isUpdated: true });
  }

  async editOption({ columnTitle, index, newOption }: { index: number; columnTitle: string; newOption: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).click();
    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).fill(newOption);

    await this.column.save({ isUpdated: true });
  }

  async deleteOption({ columnTitle, index }: { index: number; columnTitle: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator(`svg[data-testid="select-column-option-remove-${index}"]`).click();

    await this.column.save({ isUpdated: true });
  }

  async reorderOption({
    columnTitle,
    sourceOption,
    destinationOption,
  }: {
    columnTitle: string;
    sourceOption: string;
    destinationOption: string;
  }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.rootPage.waitForTimeout(150);

    await this.column.rootPage.dragAndDrop(
      `svg[data-testid="select-option-column-handle-icon-${sourceOption}"]`,
      `svg[data-testid="select-option-column-handle-icon-${destinationOption}"]`,
      {
        force: true,
      }
    );

    await this.column.save({ isUpdated: true });
  }
}
