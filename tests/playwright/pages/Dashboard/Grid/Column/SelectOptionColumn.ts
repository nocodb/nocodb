import { ColumnPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';

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

  // add multiple options at once after column creation is completed
  //
  async addOptions({ columnTitle, options }: { columnTitle: string; options: string[] }) {
    await this.column.openEdit({ title: columnTitle });
    for (let i = 0; i < options.length; i++) {
      await this.column.get().locator('button:has-text("Add option")').click();
      await this.column.get().locator(`[data-testid="select-column-option-input-${i}"]`).click();
      await this.column.get().locator(`[data-testid="select-column-option-input-${i}"]`).fill(options[i]);
    }
    await this.column.save({ isUpdated: true });
  }

  async editOption({ columnTitle, index, newOption }: { index: number; columnTitle: string; newOption: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).click();
    await this.column.get().locator(`[data-testid="select-column-option-input-${index}"]`).fill(newOption);

    await this.column.save({ isUpdated: true });
  }

  async deleteOption({ columnTitle, index }: { index: number; columnTitle: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator(`[data-testid="select-column-option-remove-${index}"]`).click();

    await expect(this.column.get().getByTestId(`select-column-option-${index}`)).toHaveClass(/removed/);

    await this.column.save({ isUpdated: true });
  }

  async deleteOptionWithUndo({ columnTitle, index }: { index: number; columnTitle: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator(`[data-testid="select-column-option-remove-${index}"]`).click();

    await expect(this.column.get().getByTestId(`select-column-option-${index}`)).toHaveClass(/removed/);

    await this.column.get().locator(`[data-testid="select-column-option-remove-undo-${index}"]`).click();

    await expect(this.column.get().getByTestId(`select-column-option-${index}`)).not.toHaveClass(/removed/);

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
      `[data-testid="select-option-column-handle-icon-${sourceOption}"]`,
      `[data-testid="select-option-column-handle-icon-${destinationOption}"]`,
      {
        force: true,
      }
    );

    await this.column.save({ isUpdated: true });
  }
}
