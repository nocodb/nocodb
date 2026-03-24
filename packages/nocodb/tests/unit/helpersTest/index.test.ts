import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { publicDatasSanitizeTest } from './publicDatasSanitize.test';
import { stringHelperTest } from './stringHelpers.test';
import { planResolutionTests } from './planResolution.test';

let dashboardV3ConfigTransformTest = () => {};
let dateDependencyHelperTests = () => {};
if (process.env.EE === 'true') {
  dashboardV3ConfigTransformTest =
    require('./ee/dashboardV3ConfigTransform.test').dashboardV3ConfigTransformTest;
  dateDependencyHelperTests =
    require('./ee/dateDependencyHelper.test').dateDependencyHelperTests;
}

function _helperTests() {
  stringHelperTest();
  NcConcurrentTest();
  dashboardV3ConfigTransformTest();
  dateDependencyHelperTests();
  planResolutionTests();
  describe('PublicDatasService - shared view column sanitization', publicDatasSanitizeTest);
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
