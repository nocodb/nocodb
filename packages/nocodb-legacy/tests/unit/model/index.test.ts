import 'mocha';
import baseModelSqlTest from './tests/baseModelSql.test';

function modelTests() {
  baseModelSqlTest();
}

export default function () {
  describe('Model', modelTests);
}