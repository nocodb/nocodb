import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

import setup, { unsetup } from '../../../setup';
import { enableQuickRun, isPg, isSqlite } from '../../../setup/db';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';

const filmRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

test.describe('View', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage, toolbar: ToolbarPage, topbar: TopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = toolbar = dashboard.kanban.toolbar;
    topbar = dashboard.kanban.topbar;

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Film' });

    if (isSqlite(context)) {
      await dashboard.treeView.deleteTable({ title: 'FilmList' });
    }

    if (isPg(context)) {
      // Since these view depend on the Ratings column of the Film table
      await dashboard.treeView.deleteTable({ title: 'NicerButSlowerFilmList' });
      await dashboard.treeView.deleteTable({ title: 'FilmList' });
    }

    // in hub, after table delete- first table in the list gets rendered
    await dashboard.treeView.openTable({ title: 'Film' });

    if (isSqlite(context) || isPg(context)) {
      await dashboard.grid.column.openEdit({ title: 'Rating', type: 'SingleSelect' });
      await dashboard.grid.column.selectType({ type: 'SingleSelect' });
      let count = 0;
      for (const rating of filmRatings) {
        await dashboard.grid.column.selectOption.addOption({
          index: count,
          option: rating,
          skipColumnModal: true,
        });
        count = count + 1;
      }
      await dashboard.grid.column.save();
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Kanban', async () => {
    await dashboard.viewSidebar.createKanbanView({
      title: 'Film Kanban',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'Film Kanban',
      index: 0,
    });

    // configure stack-by field
    await toolbar.clickStackByField();
    await toolbar.stackBy.click({ title: 'Rating' });

    // menu overlaps the stack-by field; use escape key to close instead of clicking it explicitly
    // click again to close menu
    // await toolbar.clickStackByField();
    await toolbar.rootPage.keyboard.press('Escape');

    const kanban = dashboard.kanban;
    await kanban.verifyStackCount({ count: 6 });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17'],
    });
    await kanban.verifyStackFooter({
      count: [0, 178, 194, 223, 195, 210],
    });
    await kanban.verifyCardCount({
      count: [0, 25, 25, 25, 25, 25],
    });

    // hide fields
    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggleShowAllFields();
    await toolbar.fields.toggle({ title: 'Title' });
    await kanban.verifyCardCount({
      count: [0, 25, 25, 25, 25, 25],
    });

    // verify card order
    const order = [
      ['ACE GOLDFINGER', 'AFFAIR PREJUDICE', 'AFRICAN EGG'],
      ['ACADEMY DINOSAUR', 'AGENT TRUMAN', 'ALASKA PHANTOM'],
      ['AIRPLANE SIERRA', 'ALABAMA DEVIL', 'ALTER VICTORY'],
      ['AIRPORT POLLOCK', 'ALONE TRIP', 'AMELIE HELLFIGHTERS'],
      ['ADAPTATION HOLES', 'ALADDIN CALENDAR', 'ALICE FANTASIA'],
    ];
    for (let i = 1; i <= order.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order[i - 1],
      });

    // // verify inter stack drag-drop
    // await kanban.dragDropCard({
    //   from: "ACE GOLDFINGER",
    //   to: "ACADEMY DINOSAUR",
    // });

    // verify drag drop stack
    await kanban.dragDropStack({
      from: 1, // G
      to: 2, // PG
    });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'PG', 'G', 'PG-13', 'R', 'NC-17'],
    });
    // verify drag drop stack
    await kanban.dragDropStack({
      from: 2, // G
      to: 1, // PG
    });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'G', 'PG', 'PG-13', 'R', 'NC-17'],
    });

    // verify sort
    await toolbar.sort.add({
      title: 'Title',
      ascending: false,
      locallySaved: false,
    });
    // verify card order
    const order2 = [
      ['YOUNG LANGUAGE', 'WEST LION'],
      ['WORST BANGER', 'WORDS HUNTER'],
    ];
    for (let i = 1; i <= order2.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order2[i - 1],
      });
    await toolbar.sort.reset();
    // verify card order
    const order3 = [
      ['ACE GOLDFINGER', 'AFFAIR PREJUDICE', 'AFRICAN EGG'],
      ['ACADEMY DINOSAUR', 'AGENT TRUMAN', 'ALASKA PHANTOM'],
    ];
    for (let i = 1; i <= order3.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order3[i - 1],
      });

    // verify filter
    await toolbar.clickFilter({
      networkValidation: true,
    });
    await toolbar.filter.add({
      title: 'Title',
      operation: 'is like',
      value: 'BA',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    // verify card order
    const order4 = [
      ['BAKED CLEOPATRA', 'BALLROOM MOCKINGBIRD'],
      ['ARIZONA BANG', 'EGYPT TENENBAUMS'],
    ];
    for (let i = 1; i <= order4.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order4[i - 1],
      });
    await toolbar.filter.reset();
    const order5 = [
      ['ACE GOLDFINGER', 'AFFAIR PREJUDICE', 'AFRICAN EGG'],
      ['ACADEMY DINOSAUR', 'AGENT TRUMAN', 'ALASKA PHANTOM'],
    ];
    for (let i = 1; i <= order5.length; i++)
      await kanban.verifyCardOrder({
        stackIndex: i,
        order: order5[i - 1],
      });

    await dashboard.rootPage.waitForTimeout(1000);
  });

  test('Kanban view operations', async () => {
    test.slow();

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
    });
  });

  test.skip('Kanban shared view operations', async ({ page }) => {
    test.slow();

    await dashboard.viewSidebar.createKanbanView({
      title: 'Film Kanban',
    });
    await dashboard.viewSidebar.verifyView({
      title: 'Film Kanban',
      index: 0,
    });

    // Share view
    await toolbar.fields.toggle({ title: 'Rating' });
    const sharedLink = await topbar.getSharedViewUrl();
    // await toolbar.shareView.close();

    // sign-out
    await dashboard.signOut();

    // Open shared view & verify stack count
    await page.goto(sharedLink);
    await page.reload();
    const kanban = dashboard.kanban;
    await kanban.verifyStackCount({ count: 6 });
  });
});
