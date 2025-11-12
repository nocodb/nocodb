import 'mocha';
import { runOnSet } from '../utils/runOnSet';

function _linksTests() {}

export const linksTests = runOnSet(2, function () {
  describe('Formula', _linksTests);
});
