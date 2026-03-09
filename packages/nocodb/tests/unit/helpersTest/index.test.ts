import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { stringHelperTest } from './stringHelpers.test';

let dashboardV3ConfigTransformTest = () => {};
if (process.env.EE === 'true') {
  dashboardV3ConfigTransformTest =
    require('./ee/dashboardV3ConfigTransform.test').dashboardV3ConfigTransformTest;
}

function _helperTests() {
  stringHelperTest();
  NcConcurrentTest();
  dashboardV3ConfigTransformTest();
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
