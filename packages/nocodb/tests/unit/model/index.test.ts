import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import baseModelSqlTest from './tests/baseModelSql.test';
import { tableHelpersTest } from './tableHelpers/tableHelpers.test';

function modelTests() {
  baseModelSqlTest();
}

export default runOnSet(1, function () {
  describe('tableHelpersTest', tableHelpersTest);
  describe('Model', modelTests);
});
