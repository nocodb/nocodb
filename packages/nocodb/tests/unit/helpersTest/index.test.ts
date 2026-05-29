import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { publicDatasSanitizeTest } from './publicDatasSanitize.test';
import { publicDataExportSanitizeTest } from './publicDataExportSanitize.test';
import { stringHelperTest } from './stringHelpers.test';
import { planResolutionTests } from './planResolution.test';
import { attachmentHelpersTest } from './attachmentHelpers.test';
import { emailUtilsTest } from './emailUtils.test';
import { apiTokenPermissionTest } from './apiTokenPermission.test';
import { mailAuditTests } from './mailAudit.test';
import { jobsProcessorTest } from './jobsProcessor.test';
import { dateTimeFilterHandlerTest } from './dateTimeFilterHandler.test';
import { describeRowErrorTests } from './dataImportProcessor.test';
let dashboardV3ConfigTransformTest = () => {};
let dateDependencyHelperTests = () => {};
let verifyDefaultOrgTests = () => {};
let mfaHelperTests = () => {};
let cognitoTestShimTests = () => {};
let patResourceFilterTest = () => {};
let dynamicFieldFilterTests = () => {};
let onPremPlanResolutionTests = () => {};
let modelStatTests = () => {};
if (process.env.EE === 'true') {
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
}

function _helperTests() {
  stringHelperTest();
  NcConcurrentTest();
  attachmentHelpersTest();
  emailUtilsTest();
  jobsProcessorTest();
  dateTimeFilterHandlerTest();
  describeRowErrorTests();
  dashboardV3ConfigTransformTest();
  dateDependencyHelperTests();
  planResolutionTests();
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
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
