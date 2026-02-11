import 'mocha';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import { withRateLimit } from '~/utils/rate-limit';

const executeXTimes = async (handle: () => Promise<void>, times: number) => {
  const promises: Promise<void>[] = [];
  for (let i = 0; i < times; i++) {
    promises.push(handle());
  }
  return Promise.all(promises);
};
const delayForMs = (delayMs: number, after?: number) => {
  let calculatedDelayMs = delayMs;
  if (after && after > 0) {
    const diff = Date.now() - after;
    calculatedDelayMs -= diff;
    calculatedDelayMs = Math.max(0, calculatedDelayMs);
  }
  if (calculatedDelayMs > 0) {
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        resolve();
      }, calculatedDelayMs),
    );
  }
};

function rateLimitUtilTests() {
  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  it('will not trigger rate limit of 5 request per second, but will trigger at 6th', async () => {
    const testFuncContext = {
      incr: 0,
    };
    const testFunc = async () => {
      await withRateLimit({
        maxHit: 5, // 5 hits
        blockDurationMs: 1 * 1000, // 1 secs
        intervalMs: 1 * 1000, // per 1 secs
      }).validate('test_batchof_5_1');
      testFuncContext.incr++;
    };

    await executeXTimes(testFunc, 5);
    await delayForMs(1000);
    let error = '';
    try {
      await executeXTimes(testFunc, 6);
    } catch (ex: any) {
      error = ex.error;
    }
    expect(error).to.eq('ERR_RATE_LIMIT_REACHED', 'Rate limit not triggered');
    await delayForMs(1000);
    await executeXTimes(testFunc, 5);
    expect(testFuncContext.incr).to.eq(
      15,
      'testFunc not triggered correct number of times',
    );
  });
}

export function rateLimitUtilTest() {
  describe('RateLimitUtilTest', rateLimitUtilTests);
}
