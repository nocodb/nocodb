import { expect, Locator } from "@playwright/test";
import { GridPage } from "../../Grid";
import BasePage from "../../../Base";
import { AttachmentCellPageObject } from "./AttachmentCell";
import { SelectOptionCellPageObject } from "./SelectOptionCell";
import { SharedFormPage } from "../../../SharedForm";
import { CheckboxCellPageObject } from "./CheckboxCell";
import { RatingCellPageObject } from "./RatingCell";

export class CellPageObject extends BasePage {
  readonly parent: GridPage | SharedFormPage;
  readonly selectOption: SelectOptionCellPageObject;
  readonly attachment: AttachmentCellPageObject;
  readonly checkbox: CheckboxCellPageObject;
  readonly rating: RatingCellPageObject;
  constructor(parent: GridPage | SharedFormPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.selectOption = new SelectOptionCellPageObject(this);
    this.attachment = new AttachmentCellPageObject(this);
    this.checkbox = new CheckboxCellPageObject(this);
    this.rating = new RatingCellPageObject(this);
  }

  get({
    index,
    columnHeader,
  }: {
    index?: number;
    columnHeader: string;
  }): Locator {
    if (this.parent instanceof SharedFormPage) {
      return this.parent
        .get()
        .locator(`[pw-data="nc-form-input-cell-${columnHeader}"]`);
    } else {
      return this.parent
        .get()
        .locator(`td[data-pw="cell-${columnHeader}-${index}"]`);
    }
  }

  async click({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    return this.get({ index, columnHeader }).click();
  }

  async dblclick({
    index,
    columnHeader,
  }: {
    index?: number;
    columnHeader: string;
  }) {
    return this.get({ index, columnHeader }).dblclick();
  }

  async fillText({
    index,
    columnHeader,
    text
  }: {
    index?: number;
    columnHeader: string;
    text: string;
  }) {
    await this.dblclick({
      index,
      columnHeader,
    });
    await this.get({ index, columnHeader }).locator("input").fill(text);
  }

  async inCellExpand({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    await this.get({ index, columnHeader }).hover();
    await this.get({ index, columnHeader })
      .locator(".nc-action-icon >> nth=0")
      .click();
  }

  async inCellAdd({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    await this.get({ index, columnHeader }).hover();
    await this.get({ index, columnHeader })
      .locator(".nc-action-icon.nc-plus")
      .click();
  }

  async verify({
    index,
    columnHeader,
    value,
  }: {
    index: number;
    columnHeader: string;
    value: string | string[];
  }) {
    const _verify = async (text) => {
      await expect
        .poll(async () => {
          const innerTexts = await this.get({
            index,
            columnHeader,
          }).allInnerTexts();
          return typeof innerTexts === "string" ? [innerTexts] : innerTexts;
        })
        .toContain(text);
    };

    if (Array.isArray(value)) {
      for (const text of value) {
        await _verify(text);
      }
    } else {
      await _verify(value);
    }
  }

  // todo: Improve param names (i.e value => values)
  // verifyVirtualCell
  //  : virtual relational cell- HM, BT, MM
  //  : verify link count & cell value
  //
  async verifyVirtualCell({
    index,
    columnHeader,
    count,
    value,
  }: {
    index: number;
    columnHeader: string;
    count?: number;
    value: string[];
  }) {
    // const count = value.length;
    const cell = this.get({ index, columnHeader });
    const chips = cell.locator(".chips > .chip");
    const chipCount = await chips.count();

    // verify chip count & contents
    if(count) expect(chipCount).toEqual(count);

    // verify only the elements that are passed in
    for (let i = 0; i < value.length; ++i) {
      expect(await chips.nth(i).textContent()).toBe(value[i]);
    }
  }

  async unlinkVirtualCell({
    index,
    columnHeader,
  }: {
    index: number;
    columnHeader: string;
  }) {
    const cell = this.get({ index, columnHeader });
    await cell.click();
    await cell.locator(".nc-icon.unlink-icon").click();
  }

  async verifyRoleAccess(param: { role: string }) {
    console.log("verifyRoleAccess", param);

    // normal text cell
    const cell = await this.get({ index: 0, columnHeader: "Country" });
    // editable cell
    await cell.dblclick();
    expect(await cell.locator(`input`).count()).toBe(
      param.role === "creator" || param.role === "editor" ? 1 : 0
    );
    // right click context menu
    await cell.click({ button: "right" });
    expect(
      await this.rootPage
        .locator(`.nc-dropdown-grid-context-menu:visible`)
        .count()
    ).toBe(param.role === "creator" || param.role === "editor" ? 1 : 0);

    // virtual cell
    const vCell = await this.get({ index: 0, columnHeader: "City List" });
    await vCell.hover();
    // in-cell add
    expect(await vCell.locator(".nc-action-icon.nc-plus:visible").count()).toBe(
      param.role === "creator" || param.role === "editor" ? 1 : 0
    );
    // in-cell expand (all have access)
    expect(
      await vCell.locator(".nc-action-icon.nc-arrow-expand:visible").count()
    ).toBe(1);
    await vCell.click();
    // unlink
    expect(await vCell.locator(".nc-icon.unlink-icon:visible").count()).toBe(
      param.role === "creator" || param.role === "editor" ? 1 : 0
    );
  }
}
