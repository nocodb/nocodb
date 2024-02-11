import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

import setup, { unsetup } from '../../../setup';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';
import { CalendarTopbarPage } from '../../../pages/Dashboard/Calendar/CalendarTopBar';

const dateRecords = [
  {
    Title: 'Team Catchup',
    StartDate: '2024-01-01 09:00',
    EndDate: '2024-01-01 10:00',
  },
  {
    Title: 'Lunch with John',
    StartDate: '2024-01-01 12:00',
    EndDate: '2024-01-01 13:00',
  },

  {
    Title: 'Meeting with Client',
    StartDate: '2024-01-01 14:00',
    EndDate: '2024-01-01 15:00',
  },
  {
    Title: 'Meeting with Team',
    StartDate: '2024-01-01 16:00',
    EndDate: '2024-01-01 17:00',
  },

  {
    Title: 'Meeting with Manager',
    StartDate: '2024-01-01 18:00',
    EndDate: '2024-01-01 19:00',
  },
  {
    Title: 'Meeting with HR',
    StartDate: '2024-01-01 20:00',
    EndDate: '2024-01-01 21:00',
  },
];

test.describe('View', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage, topbar: TopbarPage, calendarTopbar: CalendarTopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = toolbar = dashboard.calendar.toolbar;
    topbar = dashboard.calendar.topbar;
    calendarTopbar = dashboard.calendar.calendarTopbar;

    await dashboard.treeView.createTable({
      title: 'Social Media Calendar',
      baseTitle: 'Getting Started',
    });

    await dashboard.treeView.openTable({ title: 'Social Media Calendar' });

    await dashboard.grid.column.create({
      title: 'StartDate',
      type: 'DateTime',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
    });

    await dashboard.grid.column.create({
      title: 'EndDate',
      type: 'DateTime',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
    });

    for (let i = 0; i < dateRecords.length; i++) {
      await dashboard.grid.addNewRow({
        index: i,
        columnHeader: 'Title',
        value: dateRecords[i].Title,
        networkValidation: false,
      });
    }

    for (let i = 0; i < dateRecords.length; i++) {
      await dashboard.grid.cell.dateTime.setDateTime({
        index: i,
        columnHeader: 'StartDate',
        dateTime: dateRecords[i].StartDate,
      });
    }
    for (let i = 0; i < dateRecords.length; i++) {
      await dashboard.grid.cell.dateTime.setDateTime({
        index: i,
        columnHeader: 'EndDate',
        dateTime: dateRecords[i].EndDate,
      });
    }

    await dashboard.rootPage.waitForTimeout(5000);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Calendar', async () => {
    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    await toolbar.clickCalendarViewSettings();

    await toolbar.calendarRange.newCalendarRange({
      fromTitle: 'EndDate',
    });

    await toolbar.clickCalendarViewSettings();

    const calendar = dashboard.calendar;

    await calendar.verifySideBarOpen();

    await calendarTopbar.toggleSideBar();

    await calendar.verifySideBarClosed();

    await calendarTopbar.toggleSideBar();

    await calendar.verifySideBarOpen();

    await calendarTopbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'week' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'day' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'year' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendarTopbar.moveToDate({ date: 'January 2024', action: 'prev' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.sideMenu.updateFilter({
      filter: 'Without dates',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: Array(12).fill('') });

    await calendar.sideMenu.updateFilter({
      filter: 'All records',
    });

    await calendar.sideMenu.verifySideBarRecords({
      records: [...dateRecords.map(r => r.Title), ...Array(12).fill('')],
    });

    await calendar.sideMenu.updateFilter({
      filter: 'In selected date',
    });

    await calendar.calendarMonth.selectDate({ rowIndex: 0, columnIndex: 0 });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.calendarMonth.selectDate({ rowIndex: 0, columnIndex: 3 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    /* await calendar.calendarMonth.dragAndDrop({
      record: dateRecords[0].Title,
      to: { rowIndex: 0, columnIndex: 3 },
    });*/

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 0 });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 3 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await dashboard.rootPage.waitForTimeout(10000);
  });

  test('Calendar view operations', async () => {
    /*test.slow();

    await dashboard.viewSidebar.createKanbanView({
      title: 'Film Kanban',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'Film Kanban',
      index: 0,
    });

    await toolbar.sort.add({
      title: 'Title',
      ascending: false,
      locallySaved: false,
    });

    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'BA',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggle({ title: 'Title' });

    await dashboard.viewSidebar.copyView({ title: 'Film Kanban' });
    await dashboard.viewSidebar.verifyView({
      title: 'Kanban',
      index: 1,
    });
    const kanban = dashboard.kanban;
    await kanban.verifyStackCount({ count: 6 });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17'],
    });
    await kanban.verifyStackFooter({
      count: [0, 4, 5, 8, 6, 6],
    });
    await kanban.verifyCardCount({
      count: [0, 4, 5, 8, 6, 6],
    });
    // verify card order
    const order2 = [
      ['BAREFOOT MANCHURIAN', 'BARBARELLA STREETCAR'],
      ['WORST BANGER', 'PRESIDENT BANG'],
    ];
    for (let i = 1; i <= order2.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order2[i - 1],
      });

    await dashboard.viewSidebar.changeViewIcon({
      title: 'Kanban',
      icon: 'american-football',
      iconDisplay: '🏈',
    });

    await dashboard.viewSidebar.deleteView({ title: 'Kanban' });
    ///////////////////////////////////////////////

    await dashboard.viewSidebar.openView({ title: 'Film Kanban' });

    // add new stack
    await kanban.addNewStack({ title: 'Test' });
    await dashboard.rootPage.waitForTimeout(1000);
    await kanban.verifyStackCount({ count: 7 });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17', 'Test'],
    });

    // collapse stack
    await kanban.verifyCollapseStackCount({ count: 0 });
    await kanban.collapseStack({ index: 0 });
    await kanban.verifyCollapseStackCount({ count: 1 });
    await kanban.expandStack({ index: 0 });
    await kanban.verifyCollapseStackCount({ count: 0 });

    // add record to stack & verify
    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggleShowSystemFields();
    await toolbar.fields.toggle({ title: 'LanguageId' });
    await toolbar.fields.toggle({ title: 'Title' });
    await toolbar.sort.reset();
    await toolbar.filter.reset();

    await kanban.addCard({ stackIndex: 6 });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: 'New record',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'LanguageId',
      value: '1',
    });
    // todo: Check why kanban doesnt reload the rows data
    await dashboard.expandedForm.save({ waitForRowsData: false });
    // kludge: reload the page
    await dashboard.rootPage.reload();

    await kanban.verifyStackCount({ count: 7 });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17', 'Test'],
    });
    await kanban.verifyCardCount({
      count: [0, 25, 25, 25, 25, 25, 1],
    });

    // delete stack
    await kanban.deleteStack({ index: 6 });
    await dashboard.rootPage.waitForTimeout(1000);
    await kanban.verifyStackCount({ count: 6 });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17'],
    });
    await kanban.verifyCardCount({
      count: [1, 25, 25, 25, 25, 25],
    });*/
  });

  test.only('Calendar shared view operations', async ({ page }) => {
    test.slow();
    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.rootPage.waitForTimeout(12000);

    // Share view
    const sharedLink = await topbar.getSharedViewUrl();

    // sign-out
    await dashboard.signOut();

    // Open shared view & verify Data
    await page.goto(sharedLink);
    await page.reload();

    const calendar = dashboard.calendar;

    await calendar.calendarTopbar.verifyActiveCalendarView({ view: 'month' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.calendarTopbar.verifyActiveCalendarView({ view: 'week' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendar.calendarTopbar.verifyActiveCalendarView({ view: 'day' });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendar.calendarTopbar.verifyActiveCalendarView({ view: 'month' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.calendarTopbar.verifyActiveCalendarView({ view: 'year' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'month' });

    await calendar.calendarTopbar.moveToDate({ date: 'January 2024', action: 'prev' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.sideMenu.updateFilter({
      filter: 'Without dates',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: Array(12).fill('') });
  });
});
