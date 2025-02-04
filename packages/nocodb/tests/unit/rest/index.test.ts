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
import baseTestV3 from './tests/metaApiV3/base.test';
import baseUsersTestV3 from './tests/metaApiV3/baseUsers.test';
import tableTests from './tests/meta-apis/table.test';

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

const testVersion = ['v1', 'v2', 'v3'];

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
  if (testVersion.includes('v2')) dataAPIsV3Test('v2');

  // v3 API tests
  if (testVersion.includes('v3')) {
    baseTestV3();
    baseUsersTestV3();
  }
}

export default function () {
  describe('Rest', restTests);
}
