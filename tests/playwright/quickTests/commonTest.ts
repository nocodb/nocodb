import { DashboardPage } from '../pages/Dashboard';
import { NcContext } from '../setup';
import { isMysql, isPg } from '../setup/db';

// normal fields
const recordCells = {
  Name: 'Movie-1',
  Notes: 'Good',
  Status: 'Todo',
  Tags: 'Jan',
  Phone: '123123123',
  Email: 'a@b.com',
  URL: 'www.a.com',
  Number: '1',
  Value: '$1.00',
  Percent: '0.01',
};

// links/ computed fields
const recordsVirtualCells = {
  Duration: '00:01',
  Done: true,
  Date: '2022-05-31',
  Rating: 1,
  Actor: ['Actor1', 'Actor2'],
  'Status (from Actor)': ['Todo', 'In progress'],
  RollUp: '128',
  Computation: '4.04',
  Producer: ['P1', 'P2'],
};

const tn = ['Film', 'Actor', 'Producer'];

const cn = [
  'Name',
  'Notes',
  'Status',
  'Tags',
  'Done',
  'Date',
  'Phone',
  'Email',
  'URL',
  'Number',
  'Percent',
  'Duration',
  'Rating',
  'Actor',
  'Status (from Actor)',
  'RollUp',
  'Computation',
  'Producer',
];

const quickVerify = async ({
  dashboard,
  airtableImport,
  context,
}: {
  dashboard: DashboardPage;
  airtableImport?: boolean;
  context: NcContext;
}) => {
  await dashboard.treeView.openTable({ title: 'Film' });

  // Verify tables
  for (let i = 0; i < tn.length; i++) {
    await dashboard.treeView.verifyTable({ title: tn[i] });
  }

  let cellIndex = 0;
  let columnCount = cn.length;

  if (airtableImport) {
    cellIndex = 2;
    columnCount -= 3;
  }
  for (let i = 0; i < columnCount; i++) {
    await dashboard.grid.column.verify({ title: cn[i], scroll: true });
  }

  // Verify cells
  // normal cells
  for (const [index, [key, value]] of Object.entries(recordCells).entries()) {
    if (index === 0) {
      await dashboard.grid.cell.get({ index: index, columnHeader: key }).click();
    }

    await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: key, value });
  }

  // checkbox
  await dashboard.grid.cell.checkbox.verifyChecked({ index: cellIndex, columnHeader: 'Done' });

  // duration
  await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: 'Duration', value: recordsVirtualCells.Duration });

  // rating
  await dashboard.grid.cell.rating.verify({
    index: cellIndex,
    columnHeader: 'Rating',
    rating: recordsVirtualCells.Rating,
  });

  // Links
  await dashboard.grid.cell.verifyVirtualCell({
    index: cellIndex,
    columnHeader: 'Actor',
    value: isMysql(context) || isPg(context) ? ['Actor1'] : recordsVirtualCells.Actor,
  });

  // Status (from Actor)
  // todo: Find a way to verify only the elements that are passed in
  // await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: "Status (from Actor)", value: recordsVirtualCells["Status (from Actor)"][0] });

  if (!airtableImport) {
    // RollUp
    await dashboard.grid.cell.verify({ index: cellIndex, columnHeader: 'RollUp', value: recordsVirtualCells.RollUp });

    // Computation
    await dashboard.grid.cell.verify({
      index: cellIndex,
      columnHeader: 'Computation',
      value: recordsVirtualCells.Computation,
    });

    // Links
    await dashboard.grid.cell.verifyVirtualCell({
      index: cellIndex,
      columnHeader: 'Producer',
      value: recordsVirtualCells.Producer,
    });
  }

  // Verify form
  await dashboard.viewSidebar.openView({ title: 'FormTitle' });
  await dashboard.form.verifyHeader({ title: 'FormTitle', subtitle: 'FormDescription' });
  await dashboard.form.verifyFormFieldLabel({ index: 0, label: 'DisplayName' });
  await dashboard.form.verifyFormFieldHelpText({ index: 0, helpText: 'HelpText' });
  await dashboard.form.verifyFieldsIsEditable({ index: 0 });
  await dashboard.form.verifyAfterSubmitMsg({ msg: 'Thank you for submitting the form!' });
  await dashboard.form.verifyAfterSubmitMenuState({
    emailMe: false,
    showBlankForm: true,
    submitAnotherForm: true,
  });

  await dashboard.treeView.openTable({ title: 'Actor' });

  if (!airtableImport) {
    // Verify webhooks
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('Webhooks');

    await dashboard.webhookForm.openForm({
      index: 0,
    });
    await dashboard.webhookForm.verifyForm({
      title: 'Webhook-1',
      hookEvent: 'After Insert',
      notificationType: 'URL',
      urlMethod: 'POST',
      url: 'http://localhost:9090/hook',
      condition: false,
    });
    await dashboard.webhookForm.goBackFromForm();

    await dashboard.webhookForm.openForm({
      index: 1,
    });
    await dashboard.webhookForm.verifyForm({
      title: 'Webhook-2',
      hookEvent: 'After Update',
      notificationType: 'URL',
      urlMethod: 'POST',
      url: 'http://localhost:9090/hook',
      condition: false,
    });
    await dashboard.webhookForm.goBackFromForm();

    await dashboard.webhookForm.openForm({
      index: 2,
    });
    await dashboard.webhookForm.verifyForm({
      title: 'Webhook-3',
      hookEvent: 'After Delete',
      notificationType: 'URL',
      urlMethod: 'POST',
      url: 'http://localhost:9090/hook',
      condition: false,
    });

    await dashboard.webhookForm.close();
  }

  await dashboard.viewSidebar.openView({ title: 'Filter&Sort' });

  // Verify Fields, Filter & Sort
  await dashboard.grid.column.verify({ title: 'Name' });
  await dashboard.grid.column.verify({ title: 'Notes' });
  await dashboard.grid.column.verify({ title: 'Attachments', isVisible: false });
  await dashboard.grid.column.verify({ title: 'Status' });
  await dashboard.grid.column.verify({ title: 'Film' });

  // Verify Fields
  await dashboard.grid.toolbar.clickFields();
  await dashboard.grid.toolbar.fields.verify({ title: 'Name' });
  await dashboard.grid.toolbar.fields.verify({ title: 'Notes', checked: true });
  await dashboard.grid.toolbar.fields.verify({ title: 'Attachments', checked: false });
  await dashboard.grid.toolbar.fields.verify({ title: 'Status', checked: true });
  await dashboard.grid.toolbar.fields.verify({ title: 'Film', checked: true });

  // Verify Sort
  await dashboard.grid.toolbar.clickSort();
  await dashboard.grid.toolbar.sort.verify({ index: 0, column: 'Name', direction: 'A → Z' });

  // Verify Filter
  await dashboard.grid.toolbar.clickFilter();
  await dashboard.grid.toolbar.filter.verify({ index: 0, column: 'Name', operator: 'is like', value: '1' });
  await dashboard.grid.toolbar.filter.verify({ index: 1, column: 'Name', operator: 'is like', value: '2' });

  if (!airtableImport) {
    // Verify views
    // todo: Wait for 800ms, issue related to vue router
    await dashboard.rootPage.waitForTimeout(800);
    await dashboard.treeView.openTable({ title: 'Producer' });

    await dashboard.viewSidebar.verifyView({ index: 0, title: 'Grid view' });
    await dashboard.viewSidebar.verifyView({ index: 1, title: 'Grid 2' });
    await dashboard.viewSidebar.verifyView({ index: 2, title: 'Grid 3' });
    await dashboard.viewSidebar.verifyView({ index: 3, title: 'Grid 4' });
    await dashboard.viewSidebar.verifyView({ index: 4, title: 'Form' });
    await dashboard.viewSidebar.verifyView({ index: 5, title: 'Form 2' });
    await dashboard.viewSidebar.verifyView({ index: 6, title: 'Form 3' });
    await dashboard.viewSidebar.verifyView({ index: 7, title: 'Form 4' });
    await dashboard.viewSidebar.verifyView({ index: 8, title: 'Gallery' });
    await dashboard.viewSidebar.verifyView({ index: 9, title: 'Gallery 2' });
    await dashboard.viewSidebar.verifyView({ index: 10, title: 'Gallery 3' });

    // verify BT relation
    await dashboard.grid.cell.verifyVirtualCell({ index: 0, columnHeader: 'FilmRead', value: ['Movie-1'] });
  }

  if (airtableImport) {
    // Delete default context base
    // await dashboard.clickHome();
    // const workspacePage = new WorkspacePage(dashboard.rootPage);
    // await workspacePage.baseDelete({ title: context.base.title });
    await dashboard.treeView.deleteProject({ title: context.base.title, context });
  }
};

export { quickVerify };
