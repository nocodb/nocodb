import 'mocha';
import { pgErrorExtractorTest } from './db-error-extractor/pg-error-extractor.test';

function _errorTests() {
  pgErrorExtractorTest();
}

export function errorTests() {
  describe('Error', _errorTests);
}
