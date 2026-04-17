import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { publicDatasSanitizeTest } from './publicDatasSanitize.test';
import { stringHelperTest } from './stringHelpers.test';
import { planResolutionTests } from './planResolution.test';
import { attachmentHelpersTest } from './attachmentHelpers.test';
import { apiTokenPermissionTest } from './apiTokenPermission.test';
let dashboardV3ConfigTransformTest = () => {};
let dateDependencyHelperTests = () => {};
let verifyDefaultOrgTests = () => {};
let mfaHelperTests = () => {};
if (process.env.EE === 'true') {
  dashboardV3ConfigTransformTest =
    require('./ee/dashboardV3ConfigTransform.test').dashboardV3ConfigTransformTest;
  dateDependencyHelperTests =
    require('./ee/dateDependencyHelper.test').dateDependencyHelperTests;
  verifyDefaultOrgTests =
    require('./ee/verifyDefaultOrg.test').verifyDefaultOrgTests;
  mfaHelperTests = require('./mfa.test').mfaHelperTests;
}

function _helperTests() {
  stringHelperTest();
  NcConcurrentTest();
  attachmentHelpersTest();
  dashboardV3ConfigTransformTest();
  dateDependencyHelperTests();
  planResolutionTests();
  mfaHelperTests();
  describe('PublicDatasService - shared view column sanitization', publicDatasSanitizeTest);
  apiTokenPermissionTest();
  verifyDefaultOrgTests();
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
