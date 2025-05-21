import { expect, Locator } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarFieldsPage } from './Fields';
import { ToolbarSortPage } from './Sort';
import { ToolbarFilterPage } from './Filter';
import { ToolbarViewMenuPage } from './ViewMenu';
import * as fs from 'fs';
import { GridPage } from '../../Grid';
import { ToolbarActionsPage } from './Actions';
import { GalleryPage } from '../../Gallery';
import { KanbanPage } from '../../Kanban';
import { FormPage } from '../../Form';
import { ToolbarStackbyPage } from './StackBy';
import { ToolbarAddEditStackPage } from './AddEditKanbanStack';
import { ToolbarSearchDataPage } from './SearchData';
import { RowHeight } from './RowHeight';
import { MapPage } from '../../Map';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { ToolbarGroupByPage } from './Groupby';
import { ToolbarCalendarViewModePage } from './CalendarViewMode';
import { CalendarPage } from '../../Calendar';
import { ToolbarCalendarRangePage } from './CalendarRange';

export class ToolbarPage extends BasePage {
  readonly parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage | CalendarPage;
  readonly fields: ToolbarFieldsPage;
  readonly sort: ToolbarSortPage;
  readonly filter: ToolbarFilterPage;
  readonly groupBy: ToolbarGroupByPage;
  readonly viewsMenu: ToolbarViewMenuPage;
  readonly actions: ToolbarActionsPage;
  readonly stackBy: ToolbarStackbyPage;
  readonly addEditStack: ToolbarAddEditStackPage;
  readonly searchData: ToolbarSearchDataPage;
  readonly rowHeight: RowHeight;
  readonly calendarViewMode: ToolbarCalendarViewModePage;
  readonly calendarRange: ToolbarCalendarRangePage;

  readonly btn_fields: Locator;
  readonly btn_sort: Locator;
  readonly btn_filter: Locator;
  readonly btn_rowHeight: Locator;
  readonly btn_groupBy: Locator;
  readonly btn_calendarSettings: Locator;
  readonly today_btn: Locator;

  constructor(parent: GridPage | GalleryPage | FormPage | KanbanPage | MapPage | CalendarPage) {
    super(parent.rootPage);
    this.parent = parent;
    this.fields = new ToolbarFieldsPage(this);
    this.sort = new ToolbarSortPage(this);
    this.filter = new ToolbarFilterPage(this);
    this.groupBy = new ToolbarGroupByPage(this);
    this.viewsMenu = new ToolbarViewMenuPage(this);
    this.actions = new ToolbarActionsPage(this);
    this.stackBy = new ToolbarStackbyPage(this);
    this.addEditStack = new ToolbarAddEditStackPage(this);
    this.searchData = new ToolbarSearchDataPage(this);
    this.rowHeight = new RowHeight(this);
    this.calendarViewMode = new ToolbarCalendarViewModePage(this);
    this.calendarRange = new ToolbarCalendarRangePage(this);

    this.btn_fields = this.get().locator(`button.nc-fields-menu-btn`);
    this.btn_sort = this.get().locator(`button.nc-sort-menu-btn`);
    this.btn_filter = this.get().locator(`button.nc-filter-menu-btn`);
    this.btn_rowHeight = this.get().locator(`button.nc-height-menu-btn`);
    this.btn_groupBy = this.get().locator(`button.nc-group-by-menu-btn`);
    this.btn_calendarSettings = this.get().getByTestId('nc-calendar-range-btn');

    this.today_btn = this.get().getByTestId('nc-calendar-today-btn');
  }

  get() {
    return this.rootPage.locator(`.nc-table-toolbar`);
  }

  async clickActions() {
    const menuOpen = await this.actions.get().isVisible();

    await this.rootPage.locator(`div.nc-view-context-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.fields.get().waitFor({ state: 'hidden' });
  }

  async clickCalendarViewSettings() {
    const menuOpen = await this.calendarRange.get().isVisible();
    await this.rootPage.waitForTimeout(500);
    await this.btn_calendarSettings.click({
      force: true,
    });

    // Wait for the menu to close
    if (menuOpen) await this.calendarRange.get().waitFor({ state: 'hidden' });
  }

  async getActiveDate() {
    return this.get().getByTestId('nc-calendar-active-date').textContent();
  }

  async clickFields() {
    const menuOpen = await this.fields.get().isVisible();

    await this.get().locator(`button.nc-fields-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.fields.get().waitFor({ state: 'hidden' });
    else await this.fields.get().waitFor({ state: 'visible' });
  }

  async clickFindRowByScanButton() {
    await this.get().locator(`button.nc-btn-find-row-by-scan`).click();
  }

  async clickSort() {
    const menuOpen = await this.sort.get().isVisible();

    await this.get().locator(`button.nc-sort-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) await this.sort.get().waitFor({ state: 'hidden' });
  }

  async verifyFieldsButtonIsVisibleWithTextAndIcon() {
    await expect(this.get().locator(`button.nc-fields-menu-btn`)).toBeVisible();

    // menu text
    const fieldLocator = this.get().locator(`button.nc-fields-menu-btn`);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    expect(fieldText).toBe('Fields');

    // icons count within fields menu button
    expect(await this.get().locator(`button.nc-fields-menu-btn`).locator(`.material-symbols`).count()).toBe(2);
  }

  async verifyFieldsButtonIsVisibleWithoutTextButIcon() {
    await expect(this.get().locator(`button.nc-fields-menu-btn`)).toBeVisible();

    // menu text
    const fieldLocator = this.get().locator(`button.nc-fields-menu-btn`);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    expect(fieldText).not.toBe('Fields');

    // icons count within fields menu button
    expect(await this.get().locator(`button.nc-fields-menu-btn`).locator(`.material-symbols`).count()).toBe(2);
  }

  async clickGroupBy() {
    const menuOpen = await this.groupBy.get().isVisible();
    await this.get().locator(`button.nc-group-by-menu-btn`).click();

    // Wait for the menu to close
    if (menuOpen) {
      await this.groupBy.get().waitFor({ state: 'hidden' });
    }
  }

  async verifyActiveCalendarView({ view }: { view: string }) {
    const activeView = this.get().getByTestId('nc-active-calendar-view');

    await expect(activeView).toContainText(view);
  }

  async clickFilter({
    // `networkValidation` is used to verify that api calls are made when the button is clicked
    // which happens when the filter is opened for the first time
    networkValidation,
  }: { networkValidation?: boolean } = {}) {
    const menuOpen = await this.filter.get().isVisible();

    const clickFilterAction = () => this.get().locator(`button.nc-filter-menu-btn`).click();
    // Wait for the menu to close
    if (menuOpen) {
      await clickFilterAction();
      await this.filter.get().waitFor({ state: 'hidden' });
    } else {
      if (networkValidation) {
        // Since on opening filter menu, api is called to fetch filter options, and will rerender the menu
        await this.waitForResponse({
          uiAction: clickFilterAction,
          requestUrlPathToMatch: '/api/v1/',
          httpMethodsToMatch: ['GET'],
        });
      } else {
        await clickFilterAction();
      }
    }
  }

  async clickStackByField() {
    await this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn`).click();
  }

  async clickAddNewRow() {
    await this.get().locator(`.nc-toolbar-btn.nc-add-new-row-btn`).click();
  }

  async clickRowHeight() {
    // ant-btn nc-height-menu-btn nc-toolbar-btn
    await this.get().locator(`.nc-toolbar-btn.nc-height-menu-btn`).click();
  }

  async clickToday() {
    await this.today_btn.click();
  }

  async verifyStackByButton({ title }: { title: string }) {
    await this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn`).waitFor({ state: 'visible' });
    await expect(
      this.get().locator(`.nc-toolbar-btn.nc-kanban-stacked-by-menu-btn:has-text("${title}")`)
    ).toBeVisible();
  }

  async verifyDownloadDisabled() {
    await this.get().locator(`.nc-toolbar-btn.nc-actions-menu-btn`).waitFor({ state: 'hidden' });
  }

  async clickAddEditStack() {
    await this.get().locator(`.nc-kanban-stacked-by-menu-btn`).click();
  }

  async validateViewsMenu(param: { role: string; mode?: string }) {
    const menuItems = {
      creator: ['Download', 'Upload'],
      editor: ['Download', 'Upload'],
      commenter: ['CSV', 'Excel'],
      viewer: ['CSV', 'Excel'],
    };
    const vMenu = this.rootPage.locator('.nc-dropdown-actions-menu:visible');
    for (const item of menuItems[param.role.toLowerCase()]) {
      await expect(vMenu).toContainText(item);
    }
  }

  async verifyRoleAccess(param: { role: string; mode?: string }) {
    const role = param.role.toLowerCase();

    await this.clickActions();
    await this.validateViewsMenu({
      role: role,
      mode: param.mode,
    });
    await this.clickActions();

    expect(await this.btn_fields.count()).toBe(1);
    expect(await this.btn_filter.count()).toBe(1);
    expect(await this.btn_sort.count()).toBe(1);
    expect(await this.btn_rowHeight.count()).toBe(1);
  }

  getToolbarBtns() {
    return [
      {
        locator: this.btn_fields,
        dropdownLocator: this.rootPage.locator('.nc-dropdown.nc-dropdown-fields-menu'),
      },
      {
        locator: this.btn_filter,
        dropdownLocator: this.rootPage.locator('.nc-dropdown.nc-dropdown-filter-menu'),
      },
      {
        locator: this.btn_sort,
        dropdownLocator: this.rootPage.locator('.nc-dropdown.nc-dropdown-sort-menu'),
      },
      {
        locator: this.btn_groupBy,
        dropdownLocator: this.rootPage.locator('.nc-dropdown.nc-dropdown-group-by-menu'),
      },
      {
        locator: this.btn_rowHeight,
        dropdownLocator: this.rootPage.locator('.ant-dropdown.nc-dropdown-height-menu'),
      },
    ];
  }

  async verifyLockMode() {
    for (const menu of this.getToolbarBtns()) {
      await menu.locator.click();

      await menu.dropdownLocator.waitFor({ state: 'visible' });

      const lockedViewFooter = menu.dropdownLocator.locator('.nc-locked-view-footer');

      await expect(lockedViewFooter).toBeVisible();
    }
  }

  async verifyPersonalMode() {
    for (const menu of this.getToolbarBtns()) {
      await menu.locator.click();

      await menu.dropdownLocator.waitFor({ state: 'visible' });

      const lockedViewFooter = menu.dropdownLocator.locator('.nc-locked-view-footer');

      await expect(lockedViewFooter).toBeVisible();
    }
  }

  async verifyCollaborativeMode() {
    for (const menu of this.getToolbarBtns()) {
      await menu.locator.click();

      await menu.dropdownLocator.waitFor({ state: 'visible' });

      const lockedViewFooter = menu.dropdownLocator.locator('.nc-locked-view-footer');

      await expect(lockedViewFooter).toBeHidden();
    }
  }
}
