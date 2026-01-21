import { runOnSet } from '../utils/runOnSet';
import { NcConcurrentTest } from './NcConcurrent.test';
import { stringHelperTest } from './stringHelpers.test';

function _helperTests() {
  stringHelperTest();
  NcConcurrentTest();
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
