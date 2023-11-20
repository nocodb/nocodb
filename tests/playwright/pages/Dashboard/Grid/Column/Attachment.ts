import { ColumnPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';

export class AttachmentColumnPageObject extends BasePage {
  readonly column: ColumnPageObject;

  constructor(column: ColumnPageObject) {
    super(column.rootPage);
    this.column = column;
  }

  get() {
    return this.column.get();
  }

  async advanceConfig({
    columnTitle,
    fileCount,
    fileSize,
    fileTypesExcludeList,
  }: {
    columnTitle: string;
    fileCount?: number;
    fileSize?: number;
    fileTypesExcludeList?: string[];
  }) {
    await this.column.openEdit({ title: columnTitle });
    await this.column.editMenuShowMore();

    // text box : nc-attachment-max-count
    // text box : nc-attachment-max-size
    // checkbox : ant-tree-checkbox
    //     Checkbox order: Application, Audio, Image, Video, Misc

    if (fileCount) {
      const inputMaxCount = this.column.get().locator(`.nc-attachment-max-count`);
      await inputMaxCount.locator(`input`).fill(fileCount.toString());
    }

    if (fileSize) {
      const inputMaxSize = this.column.get().locator(`.nc-attachment-max-size`);
      await inputMaxSize.locator(`input`).fill(fileSize.toString());
    }

    if (fileTypesExcludeList) {
      // click on nc-allow-all-mime-type-checkbox
      const allowAllMimeCheckbox = this.column.get().locator(`.nc-allow-all-mime-type-checkbox`);
      await allowAllMimeCheckbox.click();

      const treeList = this.column.get().locator(`.ant-tree-list`);
      const checkboxList = treeList.locator(`.ant-tree-treenode`);

      for (let i = 0; i < fileTypesExcludeList.length; i++) {
        const fileType = fileTypesExcludeList[i];
        switch (fileType) {
          case 'Application':
            await checkboxList.nth(0).locator(`.ant-tree-checkbox`).click();
            break;
          case 'Audio':
            await checkboxList.nth(1).locator(`.ant-tree-checkbox`).click();
            break;
          case 'Image':
            await checkboxList.nth(2).locator(`.ant-tree-checkbox`).click();
            break;
          case 'Video':
            await checkboxList.nth(3).locator(`.ant-tree-checkbox`).click();
            break;
          case 'Misc':
            await checkboxList.nth(4).locator(`.ant-tree-checkbox`).click();
            break;
          default:
            break;
        }
      }

      await this.rootPage.waitForTimeout(1000);
    }

    await this.column.save({ isUpdated: true });
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
    await this.column.get().locator(`svg[data-testid="select-column-option-remove-${index}"]`).click();
    await expect(this.column.get().getByTestId(`select-column-option-${index}`)).toHaveClass(/removed/);
    await this.column.save({ isUpdated: true });
  }

  async deleteOptionWithUndo({ columnTitle, index }: { index: number; columnTitle: string }) {
    await this.column.openEdit({ title: columnTitle });
    await this.column.get().locator(`svg[data-testid="select-column-option-remove-${index}"]`).click();
    await expect(this.column.get().getByTestId(`select-column-option-${index}`)).toHaveClass(/removed/);
    await this.column.get().locator(`svg[data-testid="select-column-option-remove-undo-${index}"]`).click();
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
      `svg[data-testid="select-option-column-handle-icon-${sourceOption}"]`,
      `svg[data-testid="select-option-column-handle-icon-${destinationOption}"]`,
      {
        force: true,
      }
    );
    await this.column.save({ isUpdated: true });
  }
}
