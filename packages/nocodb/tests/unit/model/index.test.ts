import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import baseModelSqlTest from './tests/baseModelSql.test';
import { tableHelpersTest } from './tableHelpers/tableHelpers.test';
import { isEE } from '../utils/helpers';

function modelTests() {
  baseModelSqlTest();

  if (isEE()) {
    // Document model + service tests require EE model implementations
    try {
      const documentTest = require('./tests/document.test').default;
      const documentsServiceTest =
        require('./tests/documentsService.test').default;
      documentTest();
      documentsServiceTest();
    } catch (e) {
      // EE test files not available in CE
    }
  }
}

export default runOnSet(1, function () {
  describe('tableHelpersTest', tableHelpersTest);
  describe('Model', modelTests);

  if (isEE()) {
    try {
      const {
        teamHierarchyUtilTests,
      } = require('./tests/ee/teamHierarchy.test');
      describe('TeamHierarchyUtils', teamHierarchyUtilTests);
    } catch (e) {
      // EE test files not available in CE
    }
  }
});
