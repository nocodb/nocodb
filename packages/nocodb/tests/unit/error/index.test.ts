import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { ajvErrorFormatterTest } from './ajv-error/formatAjvErrors.test';
import { isTransientErrorTest } from './db-error-extractor/is-transient-error.test';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';

function _errorTests() {
  ajvErrorFormatterTest();
  isTransientErrorTest();
  pgErrorExtractorTest();
}

export const errorTests = runOnSet(3, function () {
  describe('Error', _errorTests);
});
