import { runOnSet } from '../utils/runOnSet';
import { stringHelperTest } from './stringHelpers.test';

function _helperTests() {
  stringHelperTest();
}
export const helperTests = runOnSet(1, function () {
  describe('helpersTest', _helperTests);
});
