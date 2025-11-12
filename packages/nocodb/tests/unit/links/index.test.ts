import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { linksGenerateLinkRequestTest } from './tests/generateLinkRequest.test';

function _linksTests() {
  linksGenerateLinkRequestTest();
}

export const linksTests = runOnSet(2, function () {
  describe('Links', _linksTests);
});
