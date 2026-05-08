import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { preCommitThrowTests } from './pre-commit-throw.test';
import { postCommitThrowTests } from './post-commit-throw.test';
import { orphanPoolOnErrorTests } from './orphan-pool-on-error.test';
import { transactionNoNewPoolTests } from './transaction-no-new-pool.test';

function _trxLeakDetectionTests() {
  preCommitThrowTests();
  postCommitThrowTests();
  orphanPoolOnErrorTests();
  transactionNoNewPoolTests();
}

export const trxLeakDetectionTests = runOnSet(1, function () {
  describe('TrxLeakDetection', _trxLeakDetectionTests);
});
