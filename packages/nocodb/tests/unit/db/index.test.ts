import 'mocha';
import { runOnSet } from '../utils/runOnSet';

function _dbTests() {
  // SQL Identifier Validator tests
  require('./util/sqlIdentifierValidator.test');

  // PgClient Security tests
  require('./sql-client/pgClientSecurity.test');
}

export const dbTests = runOnSet(2, function () {
  describe('DBTests', _dbTests);
});
