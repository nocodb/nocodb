import 'mocha';
import { willRunOnSet } from '../utils/runOnSet';
import authTests from './tests/auth.test';
import singleSessionLoginTests from './tests/single-session-login.test';
import orgTests from './tests/org.test';
import baseTests from './tests/base.test';
import columnTypeSpecificTests from './tests/columnTypeSpecific.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';
import viewRowLocalTests from './tests/viewRow-local.test';
import attachmentTests from './tests/attachment.test';
import filterTest from './tests/filter.test';
import groupByTest from './tests/groupby.test';
import formulaTests from './tests/formula.test';
import typeCastsTest from './tests/typeCasts.test';
import readOnlyTest from './tests/readOnlySource.test';
import aggregationMatrixTest from './tests/aggregationMatrix.test';

import dataAPIsV3Test from './tests/dataAPIsV3.test';
import bulkV1Test from './tests/bulk-v1.test';
import metaTestV3 from './tests/metaApiV3/index.test';
import { internalTests } from './tests/internal/index.test';
import tableTests from './tests/meta-apis/table.test';
import missingPrimaryKeyTests from './tests/meta-apis/missingPrimaryKey.test';
import { paymentTest } from './tests/payment/payment.test';
import { planGatingTests } from './tests/payment/planGating.test';
import { tableSyncGatingTests } from './tests/payment/tableSyncGating.test';
import convertDateFormatTests from './tests/convertDateFormat.test';
import linkPlaceholderTests from './tests/linkPlaceholder.test';
import pgEnumTests from './tests/pg-enum.test';

let workspaceTest = () => {};
let ssoTest = () => {};
let scimTest = () => {};
let scimComplianceTest = () => {};
let cloudOrgTest = () => {};
let orgUserInvitePickerTest = () => {};
let orgAdminRoleTest = () => {};
let columnTest = () => {};
let integrationTest = require('./tests/integration.test').default;
let oauthDCRTest = () => {};
let oauthTests = () => {};
let autoNumberTests = () => {};
let recordTrashTest = () => {};
let mfaTests = () => {};
let patResourceFilterTest = () => {};
let tableSyncTest = () => {};
let tableSyncDataTest = () => {};
let tableSyncHandlerTest = () => {};
let customSyncDataTest = () => {};
if (process.env.EE === 'true') {
  workspaceTest = require('./tests/ee/workspace.test').default;
  oauthDCRTest = require('./tests/ee/oAuthDCR.test').default;
  ssoTest = require('./tests/ee/sso.test').default;
  scimTest = require('./tests/ee/scim.test').default;
  scimComplianceTest = require('./tests/ee/scim-compliance.test').default;
  cloudOrgTest = require('./tests/ee/cloud-org.test').default;
  orgUserInvitePickerTest = require('./tests/ee/org-user-invite-picker.test').default;
  orgAdminRoleTest = require('./tests/ee/org-admin-role.test').default;
  columnTest = require('./tests/ee/column.test').default;
  integrationTest = require('./tests/ee/integration.test').default;
  oauthTests = require('./tests/oauth.test').default;
  autoNumberTests = require('./tests/ee/autoNumber.test').default;
  recordTrashTest = require('./tests/ee/record-trash.test').default;
  mfaTests = require('./tests/ee/mfa.test').default;
  patResourceFilterTest = require('./tests/ee/patResourceFilter.test').default;
  tableSyncTest = require('./tests/ee/tableSync.test').default;
  tableSyncDataTest = require('./tests/ee/tableSyncData.test').default;
  tableSyncHandlerTest = require('./tests/ee/tableSyncHandlers.test').default;
  customSyncDataTest = require('./tests/ee/customSyncData.test').default;
}

const testVersion = ['v1', 'v2', 'v3'];

function restTests() {
  if (willRunOnSet(1)) {
    authTests();
    singleSessionLoginTests();
    orgTests();
    baseTests();
    tableRowTests();
    viewRowLocalTests();
    columnTypeSpecificTests();
    autoNumberTests();
    attachmentTests();
    workspaceTest();
    formulaTests();
    ssoTest();
    scimTest();
    recordTrashTest();
    patResourceFilterTest();
  }
  if (willRunOnSet(2)) {
    convertDateFormatTests();
    filterTest();
    groupByTest();
    scimComplianceTest();
    cloudOrgTest();
    orgUserInvitePickerTest();
    orgAdminRoleTest();
    typeCastsTest();
    readOnlyTest();
    aggregationMatrixTest();
    columnTest();
    integrationTest();
    paymentTest();
    planGatingTests();
    tableSyncGatingTests();
    tableSyncTest();
    tableSyncDataTest();
    tableSyncHandlerTest();
    customSyncDataTest();
    oauthTests();
    bulkV1Test();
    oauthDCRTest();
    mfaTests();
    linkPlaceholderTests();
    pgEnumTests();
  }
  if (willRunOnSet(3)) {
    viewRowTests();
  }
  if (testVersion.includes('v1')) tableTests('v1');
  missingPrimaryKeyTests();
  if (testVersion.includes('v2')) dataAPIsV3Test('v2');

  // v3 API tests
  if (testVersion.includes('v3')) {
    metaTestV3();
    internalTests();
  }
}

export default function () {
  describe('Rest', restTests);
}
