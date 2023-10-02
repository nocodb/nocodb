import 'mocha';
import authTests from './tests/auth.test';
import orgTests from './tests/org.test';
import baseTests from './tests/base.test';
import columnTypeSpecificTests from './tests/columnTypeSpecific.test';
import tableTests from './tests/table.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';
import attachmentTests from './tests/attachment.test';
import filterTest from './tests/filter.test';
import newDataApisTest from './tests/newDataApis.test';
import groupByTest from './tests/groupby.test';

let workspaceTest = () => {};
if (process.env.EE === 'true') {
  workspaceTest = require('./tests/ee/workspace.test').default;
}
// import layoutTests from './tests/layout.test';
// import widgetTest from './tests/widget.test';

function restTests() {
  authTests();
  orgTests();
  baseTests();
  tableTests();
  tableRowTests();
  viewRowTests();
  columnTypeSpecificTests();
  attachmentTests();
  filterTest();
  newDataApisTest();
  groupByTest();
  workspaceTest();

  // Enable for dashboard feature
  // widgetTest();
  // layoutTests();
}

export default function () {
  describe('Rest', restTests);
}
