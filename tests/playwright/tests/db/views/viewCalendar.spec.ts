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

  test('Calendar Sidebar Verify Sidebar Filter, Calendar View Mode', async () => {
    // Create & Verify Calendar View
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

    await toolbar.clickCalendarViewSettings();

    // Verify Sidebar
    const calendar = dashboard.calendar;

    await calendar.verifySideBarOpen();

    await calendarTopbar.toggleSideBar();

    await calendar.verifySideBarClosed();

    await calendarTopbar.toggleSideBar();

    await calendar.verifySideBarOpen();

    // Verify Calendar View Modes
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

    // Verify Sidebar Records & Filters

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

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

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup', ['Meeting with Team']] });

    await calendar.sideMenu.searchRecord({ query: '' });

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

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'year' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 0 });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.calendarYear.selectDate({ monthIndex: 0, dayIndex: 3 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendar.calendarTopbar.moveToDate({
      date: '1 January 2024',
      action: 'prev',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 10 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 1 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await calendar.calendarTopbar.moveToDate({
      date: '3 January 2024',
      action: 'next',
    });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 10 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 1 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });

    await dashboard.viewSidebar.deleteView({ title: 'Calendar' });
  });

  test('Calendar Drag and Drop & Undo Redo Operations', async () => {
    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    await calendarTopbar.moveToDate({ date: 'January 2024', action: 'prev' });

    const calendar = dashboard.calendar;

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

    await calendarTopbar.moveToDate({
      date: '1 - 7 Jan 24',
      action: 'prev',
    });

    await calendar.calendarWeekDateTime.dragAndDrop({
      record: 'Team Catchup',
      to: {
        dayIndex: 0,
        hourIndex: 10,
      },
    });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.calendarWeekDateTime.selectHour({ dayIndex: 0, hourIndex: 10 });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await calendar.toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await dashboard.rootPage.waitForTimeout(5000);

    await calendar.calendarDayDateTime.dragAndDrop({
      record: 'Team Catchup',
      hourIndex: 5,
    });

    await calendar.calendarDayDateTime.selectHour({ hourIndex: 5 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected hours' });

    await calendar.sideMenu.verifySideBarRecords({ records: ['Team Catchup'] });

    await dashboard.viewSidebar.deleteView({ title: 'Calendar' });
  });

  test('Calendar shared view operations', async ({ page }) => {
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

  test('Calendar Operations Date Fields', async () => {
    await dashboard.grid.column.openEdit({
      title: 'StartDate',
      type: 'Date',
      dateFormat: 'YYYY-MM-DD',
    });

    await dashboard.grid.column.save({ isUpdated: true });

    await dashboard.viewSidebar.createCalendarView({
      title: 'Calendar',
    });

    await dashboard.viewSidebar.verifyView({
      title: 'Calendar',
      index: 0,
    });

    await dashboard.viewSidebar.openView({ title: 'Calendar' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'week' });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'day' });

    await calendarTopbar.verifyActiveCalendarView({ view: 'day' });

    const calendar = dashboard.calendar;

    await calendarTopbar.moveToDate({ date: '1 January 2024', action: 'prev' });

    await calendar.calendarDayDate.verifyRecord({ records: dateRecords.map(r => r.Title) });

    await calendarTopbar.moveToDate({ date: '2 January 2024', action: 'next' });

    await calendar.calendarDayDate.verifyRecord({ records: [] });

    await toolbar.calendarViewMode.changeCalendarView({ title: 'week' });

    await calendar.calendarWeekDate.selectDay({ dayIndex: 0 });

    await calendar.sideMenu.updateFilter({ filter: 'In selected date' });

    await calendar.sideMenu.verifySideBarRecords({ records: dateRecords.map(r => r.Title) });

    await calendar.calendarWeekDate.selectDay({ dayIndex: 1 });

    await calendar.sideMenu.verifySideBarRecords({ records: [] });
  });
});
