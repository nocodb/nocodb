import 'mocha';
import { runOnSet } from '~test/utils/runOnSet';
import { ajvErrorFormatterTest } from './ajv-error/formatAjvErrors.test';
import { isTransientErrorTest } from './db-error-extractor/is-transient-error.test';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';
import { pgErrorExtractorUnitTest } from './db-error-extractor/pg-error-extractor-unit.test';
import { mssqlErrorExtractorUnitTest } from './db-error-extractor/mssql-error-extractor-unit.test';

function _errorTests() {
  ajvErrorFormatterTest();
  isTransientErrorTest();
  pgErrorExtractorTest();
  pgErrorExtractorUnitTest();
  mssqlErrorExtractorUnitTest();
}

export const errorTests = runOnSet(3, function () {
  describe('Error', _errorTests);
});
