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
import formulaTests from './tests/formula.test';
import typeCastsTest from './tests/typeCasts.test';
import readOnlyTest from './tests/readOnlySource.test';
import aggregationTest from './tests/aggregation.test';

let workspaceTest = () => {};
let ssoTest = () => {};
let cloudOrgTest = () => {};
let bulkAggregationTest = () => {};
let columnTest = () => {};
let integrationTest = require('./tests/integration.test').default;
if (process.env.EE === 'true') {
  workspaceTest = require('./tests/ee/workspace.test').default;
  ssoTest = require('./tests/ee/sso.test').default;
  cloudOrgTest = require('./tests/ee/cloud-org.test').default;
  bulkAggregationTest = require('./tests/ee/bulkAggregation.test').default;
  columnTest = require('./tests/ee/column.test').default;
  integrationTest = require('./tests/ee/integration.test').default;
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
  formulaTests();
  ssoTest();
  cloudOrgTest();
  typeCastsTest();
  readOnlyTest();
  aggregationTest();
  bulkAggregationTest();
  columnTest();
  integrationTest();

  // Enable for dashboard feature
  // widgetTest();
  // layoutTests();
}

export default function () {
  describe('Rest', restTests);
}
