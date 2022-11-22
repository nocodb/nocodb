import 'mocha';
import authTests from './tests/auth.test';
import orgTests from './tests/org.test';
import projectTests from './tests/project.test';
import tableTests from './tests/table.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';

function restTests() {
  authTests();
  orgTests();
  projectTests();
  tableTests();
  tableRowTests();
  viewRowTests();
}

export default function () {
  describe('Rest', restTests);
}
