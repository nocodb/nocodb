import 'mocha';
import {
  diff,
  formatLeakReport,
  installLeakTracker,
  isInstalled,
  snapshot,
} from './utils/leakTracker';

// Patch Knex prototypes BEFORE any production code loads. Subsequent
// imports of TestDbMngr, BaseModelSqlv2 etc. will use the patched
// transaction()/initializePool/destroy methods.
installLeakTracker();

import dotenv from 'dotenv';
import restTests from './rest/index.test';
import modelTests from './model/index.test';
import { formulaTests } from './formula/index.test';
import TestDbMngr from './TestDbMngr';
import { dataApiV3Test } from './rest/tests/dataApiV3/index.test';
import { workflowApiV3Test } from './rest/tests/workflowApiV3/index.test';
import { processorTests } from './processor/index.test';
import { errorTests } from './error/index.test';
import { rollupTests } from './rollup/index.test';
import { linksTests } from './links/index.test';
import { crossBaseLinkTests } from './crossBaseLink/index.spec';
import { dbQueryClientTests } from './dbQueryClient/index.test';
import { helperTests } from './helpersTest/index.test';
import { trxLeakDetectionTests } from './trxLeakDetection/index.test';
import { typeAlignmentTestsSuite } from './typeAlignment/index.test';
import { isEE } from './utils/helpers';

process.env.NODE_ENV = 'test';
process.env.TEST = 'true';
// process.env.NC_DISABLE_CACHE = 'true';
process.env.NC_DISABLE_TELE = 'true';
// Test fixtures use SQLite filenames under tests/unit/; trust the local
// environment so factory.createSakilaProject and friends succeed.
process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS = 'true';

// Load environment variables from .env file
dotenv.config({
  path: __dirname + '/.env',
});

// Suite-level leak assertion (default-on). An end-of-suite hook diffs the
// open-trx set against a baseline taken at suite start; any non-terminated
// trx fails the run.
//
// We use end-of-suite rather than per-test because async background work
// (audit, webhook, fire-and-forget batchInsert paths) routinely spans test
// boundaries: a trx is opened during a test but commits a few microtasks
// after the test's afterEach runs. Per-test assertions false-flag those.
// End-of-suite gives every trx the full suite duration to drain.
//
// Pool tracking is intentionally NOT asserted here. Most pools are managed
// by `NcConnectionMgrv2`'s LRU cache and only destroyed on eviction — the
// first pool any test creates legitimately stays open for the rest of the
// session. Pool-leak coverage lives in `trxLeakDetection/` (orphan-pool-
// on-error scenario).
//
// Modes:
//   LEAK_TRACK=0       — tracker disabled entirely
//   LEAK_TRACK=warn    — tracker installed, suite-level check skipped
//   (default / any other) — tracker installed, suite-level check enforced
let suiteLeakBaseline: ReturnType<typeof snapshot> | null = null;
const SUITE_DRAIN_MAX_TICKS = 200;
const STRICT_LEAK_MODE = process.env.LEAK_TRACK !== 'warn';

before(function () {
  if (!isInstalled() || !STRICT_LEAK_MODE) return;
  suiteLeakBaseline = snapshot();
});
after(async function () {
  if (!isInstalled() || !STRICT_LEAK_MODE) return;
  if (!suiteLeakBaseline) return;

  for (let i = 0; i < SUITE_DRAIN_MAX_TICKS; i++) {
    if (diff(suiteLeakBaseline).trxs.length === 0) break;
    await new Promise((r) => setImmediate(r));
  }

  const report = diff(suiteLeakBaseline);
  if (report.trxs.length) {
    const msg = formatLeakReport({ trxs: report.trxs, pools: [] });
    throw new Error(`Suite leaked Knex transactions:\n${msg}`);
  }
});

(async function () {
  await TestDbMngr.init();

  trxLeakDetectionTests();
  typeAlignmentTestsSuite();
  helperTests();
  if (isEE()) {
    try {
      require('./dataReflection/index.test').dataReflectionTests();
    } catch (e) {
      // EE test files not available in CE
    }
    require('./command-registry/index.test').commandRegistryTests();
    try {
      describe(
        'Seat counting',
        require('./seatCounting/index.test').seatCountingTests,
      );
    } catch (e) {
      // EE test files not available in CE
    }
  }
  modelTests();
  formulaTests();
  dbQueryClientTests();
  linksTests();
  crossBaseLinkTests();
  rollupTests();
  errorTests();
  restTests();
  processorTests();
  await dataApiV3Test();
  await workflowApiV3Test();

  run();
})();
