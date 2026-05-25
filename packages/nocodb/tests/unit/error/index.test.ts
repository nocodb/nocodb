import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { ajvErrorFormatterTest } from './ajv-error/formatAjvErrors.test';
import { isTransientErrorTest } from './db-error-extractor/is-transient-error.test';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';
import { pgErrorExtractorUnitTest } from './db-error-extractor/pg-error-extractor-unit.test';

function _errorTests() {
  ajvErrorFormatterTest();
  isTransientErrorTest();
  pgErrorExtractorTest();
  pgErrorExtractorUnitTest();
}

export const errorTests = runOnSet(3, function () {
  describe('Error', _errorTests);
});
