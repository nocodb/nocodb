import baseTestV3 from './base.test';
import tableTestV3 from './table.test';
import baseUsersTestV3 from './baseUsers.test';
import errorHandlingMetaTestsV3 from './error-handling/index.test';

export default function () {
  baseTestV3();
  baseUsersTestV3();
  tableTestV3();
  errorHandlingMetaTestsV3();
}
