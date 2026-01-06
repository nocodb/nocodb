import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { rateLimitUtilTest } from './tests/rate-limit-util.test';

function _rateLimitUtilTests() {
  rateLimitUtilTest();
}

export const rateLimitUtilTests = runOnSet(3, function () {
  if (process.env.NC_REDIS_URL) {
    describe('Rate limit util', _rateLimitUtilTests);
  }
});
