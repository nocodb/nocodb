import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { publicDatasSanitizeTest } from './publicDatasSanitize.test';
import { publicDataExportSanitizeTest } from './publicDataExportSanitize.test';
import { stringHelperTest } from './stringHelpers.test';
import { planResolutionTests } from './planResolution.test';
import { seatConfigTests } from './seatConfig.test';
import { attachmentHelpersTest } from './attachmentHelpers.test';
import { emailUtilsTest } from './emailUtils.test';
import { apiTokenPermissionTest } from './apiTokenPermission.test';
import { mailAuditTests } from './mailAudit.test';
import { jobsProcessorTest } from './jobsProcessor.test';
import { dateTimeFilterHandlerTest } from './dateTimeFilterHandler.test';
import { describeRowErrorTests } from './dataImportProcessor.test';
import { isTokenExpiredTest } from './isTokenExpired.test';
import { isSafeRedirectUrlTests } from './isSafeRedirectUrl.test';
import { pkPreservationTests } from './pkPreservation.test';
import { csvFormulaEscapeTest } from './csvFormulaEscape.test';
import { singleQueryCacheInvalidatorTest } from './singleQueryCacheInvalidator.test';
let dashboardV3ConfigTransformTest = () => {};
let dateDependencyHelperTests = () => {};
let verifyDefaultOrgTests = () => {};
let mfaHelperTests = () => {};
let cognitoTestShimTests = () => {};
let patResourceFilterTest = () => {};
let dynamicFieldFilterTests = () => {};
let onPremPlanResolutionTests = () => {};
let modelStatTests = () => {};
let singleQueryCacheLinkageTests = () => {};
let tableSyncHelpersTests = () => {};
let mssqlLookupFlattenTest = () => {};
let dateTimeMssqlHandlerTest = () => {};
let jsonMssqlHandlerTest = () => {};
if (process.env.EE === 'true') {
  mssqlLookupFlattenTest =
    require('./mssqlLookupFlatten.test').mssqlLookupFlattenTest;
  dateTimeMssqlHandlerTest =
    require('./dateTimeMssqlHandler.test').dateTimeMssqlHandlerTest;
  jsonMssqlHandlerTest =
    require('./jsonMssqlHandler.test').jsonMssqlHandlerTest;
  dashboardV3ConfigTransformTest =
    require('./ee/dashboardV3ConfigTransform.test').dashboardV3ConfigTransformTest;
  dateDependencyHelperTests =
    require('./ee/dateDependencyHelper.test').dateDependencyHelperTests;
  verifyDefaultOrgTests =
    require('./ee/verifyDefaultOrg.test').verifyDefaultOrgTests;
  mfaHelperTests = require('./mfa.test').mfaHelperTests;
  cognitoTestShimTests =
    require('./cognitoTestShim.test').cognitoTestShimTests;
  patResourceFilterTest =
    require('./patResourceFilter.test').patResourceFilterTest;
  dynamicFieldFilterTests =
    require('./ee/dynamicFieldFilter.test').dynamicFieldFilterTests;
  onPremPlanResolutionTests =
    require('./ee/onPremPlanResolution.test').onPremPlanResolutionTests;
  modelStatTests = require('./ee/modelStat.test').modelStatTests;
  singleQueryCacheLinkageTests =
    require('./ee/singleQueryCacheLinkage.test').singleQueryCacheLinkageTests;
  tableSyncHelpersTests =
    require('./ee/tableSyncHelpers.test').tableSyncHelpersTests;
}

function _helperTests() {
  stringHelperTest();
  csvFormulaEscapeTest();
  singleQueryCacheInvalidatorTest();
  isTokenExpiredTest();
  isSafeRedirectUrlTests();
  NcConcurrentTest();
  attachmentHelpersTest();
  emailUtilsTest();
  tableSyncHelpersTests();
  jobsProcessorTest();
  dateTimeFilterHandlerTest();
  dateTimeMssqlHandlerTest();
  jsonMssqlHandlerTest();
  mssqlLookupFlattenTest();
  describeRowErrorTests();
  pkPreservationTests();
  dashboardV3ConfigTransformTest();
  dateDependencyHelperTests();
  planResolutionTests();
  seatConfigTests();
  onPremPlanResolutionTests();
  mfaHelperTests();
  cognitoTestShimTests();
  describe(
    'PublicDatasService - shared view column sanitization',
    publicDatasSanitizeTest,
  );
  publicDataExportSanitizeTest();
  apiTokenPermissionTest();
  patResourceFilterTest();
  verifyDefaultOrgTests();
  dynamicFieldFilterTests();
  mailAuditTests();
  modelStatTests();
  singleQueryCacheLinkageTests();
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
