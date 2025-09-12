import { runOnSet } from '../../../utils/runOnSet';
import baseTestV3 from './base.test';
import tableTestV3 from './table.test';
import viewTestV3 from './view.test';
import columnTestV3 from './column.test';
import baseUsersTestV3 from './baseUsers.test';
import errorHandlingMetaTestsV3 from './error-handling/index.test';
import workspaceUsersTest from './workspaceUsers.test';

export default runOnSet(2, function () {
  baseTestV3();
  baseUsersTestV3();
  tableTestV3();
  viewTestV3();
  columnTestV3();
  errorHandlingMetaTestsV3();
  workspaceUsersTest();
});
