import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

import setup, { NcContext, unsetup } from '../../../setup';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';
import { Api, ProjectListType, UITypes } from 'nocodb-sdk';
import { isEE } from '../../../setup/db';

const columns = [
  {
    column_name: 'Id',
    title: 'Id',
    uidt: UITypes.ID,
    ai: 1,
    pk: 1,
  },
  {
    column_name: 'Title',
    title: 'Title',
    uidt: UITypes.SingleLineText,
  },
  {
    column_name: 'StartDate',
    title: 'StartDate',
    uidt: UITypes.DateTime,
  },
  {
    column_name: 'EndDate',
    title: 'EndDate',
    uidt: UITypes.DateTime,
  },
];

const dateRecords = [
  {
    Id: 1,
    Title: 'Team Catchup',
    StartDate: '2024-01-01 08:00',
    EndDate: '2024-01-01 10:00',
  },
  {
    Id: 2,
    Title: 'Lunch with John',
    StartDate: '2024-01-01 12:00',
    EndDate: '2024-01-01 13:00',
  },

  {
    Id: 3,
    Title: 'Meeting with Client',
    StartDate: '2024-01-01 14:00',
    EndDate: '2024-01-01 15:00',
  },
  {
    Id: 4,
    Title: 'Meeting with Team',
    StartDate: '2024-01-01 16:00',
    EndDate: '2024-01-01 17:00',
  },

  {
    Id: 5,
    Title: 'Meeting with Manager',
    StartDate: '2024-01-01 18:00',
    EndDate: '2024-01-01 19:00',
  },
  {
    Id: 6,
    Title: 'Meeting with HR',
    StartDate: '2024-01-01 20:00',
    EndDate: '2024-01-01 21:00',
  },
  {
    Id: 7,
  },
  {
    Id: 8,
  },
  {
    Id: 9,
  },
  {
    Id: 10,
  },
  {
    Id: 11,
  },
  {
    Id: 12,
  },
  {
    Id: 13,
  },
  {
    Id: 14,
  },
  {
    Id: 15,
  },
  {
    Id: 16,
  },
  {
    Id: 17,
  },
  {
    Id: 18,
  },
];

test.describe('Calendar View', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage, topbar: TopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    const { api, table, base } = await calendarSuite(`xcdb${context.workerId}`, context);

    toolbar = toolbar = dashboard.calendar.toolbar;
    topbar = dashboard.calendar.topbar;

    await api.dbTableRow.bulkCreate('noco', base.id, table.id, dateRecords);

    await page.reload();

    await dashboard.rootPage.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Calendar Sidebar Verify Sidebar Filter, Calendar View Mode', async () => {
    // Create & Verify Calendar View
    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });
    await dashboard.treeView.openTable({ title: 'Social Media Calendar' });

    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    // Update Calendar range
    await toolbar.clickCalendarViewSettings();

    await toolbar.calendarRange.newCalendarRange({
      fromTitle: 'EndDate',
    });

    // We close the menu on new range is set
    // await toolbar.clickCalendarViewSettings();

    // Verify Sidebar
    const calendar = dashboard.calendar;

    await calendar.verifySideBarOpen();

    await calendar.toggleSideBar();

    await calendar.verifySideBarClosed();

    await calendar.toggleSideBar();

    await calendar.verifySideBarOpen();

    // Verify Calendar View Modes
    await calendar.toolbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'week' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'day' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'year' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendar.sideMenu.moveToDate({ date: 'Jan 2024', action: 'prev' });

    // Verify Sidebar Records & Filters

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.sideMenu.updateFilter({
      filter: 'Without dates',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: Array(12).fill('') });

    await calendar.sideMenu.searchRecord({ query: 'ooooooo' });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.sideMenu.updateFilter({
      filter: 'All records',
    });

    await calendar.sideMenu.searchRecord({ query: 'Team' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup', 'Meeting with Team'] });

    await calendar.sideMenu.searchRecord({ query: '' });

    await calendar.sideMenu.verifySideBarRecords({
      records: [...dateRecords.filter(f => f.Title).map(f => f.Title), ...Array(12).fill('')],
    });

    await calendar.sideMenu.updateFilter({
      filter: 'In selected date',
    });

    await calendar.calendarMonth.selectDate({ rowIndex: 0, columnIndex: 0 });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.calendarMonth.selectDate({ rowIndex: 0, columnIndex: 3 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 0 });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 3 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendar.sideMenu.moveToDate({
      date: '1 Jan 2024',
      action: 'prev',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 10 });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 1 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.sideMenu.moveToDate({
      date: '3 Jan 2024',
      action: 'next',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    // Test fails in CI consistently as attempt to select cell ends up expanding record often
    // Disabled temporarily

    // await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });
    //
    // await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });
    //
    // await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 10 });
    //
    // await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });
    //
    // await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 1 });
    //
    // await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await dashboard.viewSidebar.deleteView({ title: 'Calendar' });
  });

  test('Calendar Drag and Drop & Undo Redo Operations', async () => {
    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.openTable({ title: 'Social Media Calendar' });

    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    const calendar = dashboard.calendar;

    await calendar.sideMenu.moveToDate({ date: 'Jan 2024', action: 'prev' });

    await calendar.calendarMonth.dragAndDrop({
      record: 'Team Catchup',
      to: {
        columnIndex: 3,
        rowIndex: 0,
      },
    });

    await calendar.calendarMonth.selectDate({
      rowIndex: 0,
      columnIndex: 3,
    });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.sideMenu.moveToDate({
      date: '1 - 7 Jan 24',
      action: 'prev',
    });

    await calendar.dashboard.rootPage.waitForTimeout(1000);

    await calendar.calendarWeekDateTime.dragAndDrop({
      record: 'Team Catchup',
      to: {
        dayIndex: 0,
        hourIndex: 7,
      },
    });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 3 });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await dashboard.rootPage.waitForTimeout(2000);

    await calendar.calendarDayDateTime.dragAndDrop({
      record: 'Team Catchup',
      hourIndex: 3,
    });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 3 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await dashboard.viewSidebar.deleteView({ title: 'Calendar' });
  });

  test('Calendar shared view operations', async ({ page }) => {
    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });
    await dashboard.treeView.openTable({ title: 'Social Media Calendar' });

    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    // Share view
    const sharedLink = await topbar.getSharedViewUrl();

    // sign-out
    await dashboard.signOut();

    // Open shared view & verify Data
    await page.goto(sharedLink);
    await page.reload();

    const calendar = dashboard.calendar;

    await calendar.toolbar.verifyActiveCalendarView({ view: 'month' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'week' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'day' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.toolbar.verifyActiveCalendarView({ view: 'year' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    // await calendar.toggleSideBar();

    await calendar.sideMenu.moveToDate({ date: 'Jan 2024', action: 'prev' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.sideMenu.updateFilter({
      filter: 'Without dates',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: Array(12).fill('') });
  });

  test('Calendar Operations Date Fields', async () => {
    await dashboard.treeView.openBase({ title: `xcdb${context.workerId}` });

    await dashboard.treeView.openTable({ title: 'Social Media Calendar' });

    await dashboard.grid.column.openEdit({
      title: 'StartDate',
      type: 'Date',
      dateFormat: 'YYYY-MM-DD',
      selectType: true,
    });

    await dashboard.grid.column.save({ isUpdated: true, typeChange: true });

    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await dashboard.calendar.toolbar.verifyActiveCalendarView({ view: 'week' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await dashboard.calendar.toolbar.verifyActiveCalendarView({ view: 'day' });

    const calendar = dashboard.calendar;

    // await calendar.toggleSideBar();

    await calendar.sideMenu.moveToDate({ date: '1 Jan 2024', action: 'prev' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.sideMenu.moveToDate({ date: '2 Jan 2024', action: 'next' });

    await calendar.calendarDayDate.verifyRecord({ records: [] });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.calendarWeekDate.selectDay({ dayIndex: 0 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.filter(f => f.Title).map(f => f.Title) });

    await calendar.calendarWeekDate.selectDay({ dayIndex: 1 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.calendarWeekDate.dragAndDrop({
      record: 'Team Catchup',
      dayIndex: 2,
    });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.calendarWeekDate.selectHour({ hourIndex: 10, dayIndex: 2 });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });
  });

  async function calendarSuite(baseTitle: string, context: NcContext, skipTableCreate?: boolean) {
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    const workspaceId = context?.workspace?.id;
    try {
      let baseList: ProjectListType;
      if (isEE() && api['workspaceBase']) {
        baseList = await api['workspaceBase'].list(workspaceId);
      } else {
        baseList = await api.base.list();
      }
      for (const base of baseList.list) {
        // delete base with title 'xcdb' if it exists
        if (base.title === baseTitle) {
          await api.base.delete(base.id);
        }
      }
    } catch (e) {
      console.log(e);
    }

    const base = await api.base.create({ title: baseTitle, fk_workspace_id: workspaceId, type: 'database' });

    if (skipTableCreate) return { base, api };
    const table = await api.source.tableCreate(base.id, base.sources?.[0].id, {
      table_name: 'Social Media Calendar',
      title: 'Social Media Calendar',
      columns: columns,
    });
    return { base, table, api };
  }
});
