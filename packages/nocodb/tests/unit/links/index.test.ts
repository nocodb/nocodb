import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { isEE } from '../utils/helpers';
import { linksGenerateLinkRequestTest } from './tests/generateLinkRequest.test';

function _linksTests() {
  linksGenerateLinkRequestTest();
}

export const linksTests = runOnSet(2, function () {
  if (isEE()) {
    describe('Links', _linksTests);
  }
});
