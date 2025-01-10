import 'mocha';
import authTests from './tests/auth.test';
import orgTests from './tests/org.test';
import baseTests from './tests/base.test';
import columnTypeSpecificTests from './tests/columnTypeSpecific.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';
import attachmentTests from './tests/attachment.test';
import filterTest from './tests/filter.test';
import groupByTest from './tests/groupby.test';
import formulaTests from './tests/formula.test';
import typeCastsTest from './tests/typeCasts.test';
import readOnlyTest from './tests/readOnlySource.test';
import aggregationTest from './tests/aggregation.test';

import dataAPIsV3Test from './tests/dataAPIsV3.test';
import baseTest from './tests/meta-apis/base.test';
import tableTests from './tests/meta-apis/table.test';
import fieldsTests from './tests/meta-apis/fields.test';
import commentTests from './tests/meta-apis/comment.test';
import filterTests from './tests/meta-apis/filters.test';
import sortsTests from './tests/meta-apis/sorts.test';

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

const testVersion = ['v1', 'v2'];

function restTests() {
  authTests();
  orgTests();
  baseTests();
  tableRowTests();
  viewRowTests();
  columnTypeSpecificTests();
  attachmentTests();
  filterTest();
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

  if (testVersion.includes('v1')) tableTests('v1');
  // if (testVersion.includes('v2')) tableTests('v2');
  // if (testVersion.includes('v3')) tableTests('v3');

  // if (testVersion.includes('v1')) fieldsTests('v1');
  // if (testVersion.includes('v2')) fieldsTests('v2');
  // if (testVersion.includes('v3')) fieldsTests('v3');
  //
  // if (testVersion.includes('v1')) filterTests('v1');
  // if (testVersion.includes('v2')) filterTests('v2');
  // if (testVersion.includes('v3')) filterTests('v3');
  //
  // if (testVersion.includes('v1')) commentTests('v1');
  // if (testVersion.includes('v2')) commentTests('v2');
  // if (testVersion.includes('v3')) commentTests('v3');
  //
  // if (testVersion.includes('v1')) sortTests('v1');
  // if (testVersion.includes('v2')) sortTests('v2');
  // if (testVersion.includes('v3')) sortTests('v3');

  if (testVersion.includes('v2')) dataAPIsV3Test('v2');
  // if (testVersion.includes('v3')) dataAPIsV3Test('v3');
  //
  // if (testVersion.includes('v2')) baseTest('v2');
  // if (testVersion.includes('v3')) baseTest('v3');

  // Enable for dashboard feature
  // widgetTest();
  // layoutTests();
}

export default function () {
  describe('Rest', restTests);
}
