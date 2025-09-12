import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import baseModelSqlTest from './tests/baseModelSql.test';

function modelTests() {
  baseModelSqlTest();
}

export default runOnSet(1, function () {
  describe('Model', modelTests);
});
