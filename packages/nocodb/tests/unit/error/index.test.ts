import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { isTransientErrorTest } from './db-error-extractor/is-transient-error.test';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';

function _errorTests() {
  isTransientErrorTest();
  pgErrorExtractorTest();
}

export const errorTests = runOnSet(2, function () {
  describe('Error', _errorTests);
});
