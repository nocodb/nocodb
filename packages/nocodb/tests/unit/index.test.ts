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

// Load environment variables from .env file
dotenv.config({
  path: __dirname + '/.env',
});

// Opt-in suite-level leak assertion (LEAK_TRACK=strict). When enabled, an
// end-of-suite hook diffs the open-trx set against a baseline taken at
// suite start; any non-terminated trx fails the run.
//
// Why opt-in rather than default-on:
//   - Async background work (audit, webhook, fire-and-forget batchInsert)
//     routinely spans test boundaries; per-test assertions get noisy.
//   - End-of-suite avoids attribution noise but the SQLite/PG full suite
//     can run >10 min, so adding strict mode by default would lengthen CI.
//   - The targeted scenarios in `trxLeakDetection/` already directly assert
//     each postmortem leak pattern can't recur, and `typeAlignment/` blocks
//     reintroduction of the `_trx` parameter on data-event hooks. Strict
//     suite mode is the wide-net belt-and-braces.
//
// Pool tracking is intentionally NOT asserted here. Most pools are managed
// by `NcConnectionMgrv2`'s LRU cache and only destroyed on eviction — the
// first pool any test creates legitimately stays open for the rest of the
// session. Pool-leak coverage lives in `trxLeakDetection/` (orphan-pool-
// on-error scenario).
//
// Opt-out the tracker entirely: LEAK_TRACK=0.
let suiteLeakBaseline: ReturnType<typeof snapshot> | null = null;
const SUITE_DRAIN_MAX_TICKS = 200;
const STRICT_LEAK_MODE = process.env.LEAK_TRACK === 'strict';

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
