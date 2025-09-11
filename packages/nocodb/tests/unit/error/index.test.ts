import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';

function _errorTests() {
  pgErrorExtractorTest();
}

export const errorTests = runOnSet(2, function () {
  describe('Error', _errorTests);
});
