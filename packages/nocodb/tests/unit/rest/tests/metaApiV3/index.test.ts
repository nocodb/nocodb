import { runOnSet } from '../../../utils/runOnSet';
import baseTestV3 from './base.test';
import tableTestV3 from './table.test';
import viewTestV3 from './view.test';
import columnTestV3 from './column.test';
import uniqueConstraintTestV3 from './unique-constraint.test';
import baseUsersTestV3 from './baseUsers.test';
import errorHandlingMetaTestsV3 from './error-handling/index.test';
import workspaceUsersTest from './workspaceUsers.test';
import scriptsTestV3 from './scripts.test';
import dashboardTestV3 from './dashboard.test';
import commentsTestV3 from './comments.test';
import tableVisibilityPermissionsTestV3 from './table-visibility-permissions.test';
import timelineTestV3 from './timeline.test';
import hooksTestV3 from './hooks.test';
import { isEE } from '../../../utils/helpers';
// import teamsTestV3 from './teams.test';
// import workspaceTeamsV3 from './workspace-teams.test';
// import baseTeamsV3 from './base-teams.test';
import orgTeamsTestV3 from './org-teams.test';

export default runOnSet(3, function () {
  baseTestV3();
  baseUsersTestV3();
  tableTestV3();
  viewTestV3();
  columnTestV3();
  if (isEE()) {
    uniqueConstraintTestV3();

    try {
      require('../ee/team-hierarchy.test').default();
      require('../ee/org-team-cross-scope.test').default();
    } catch (e) {
      // EE test files not available in CE
    }
  }
  errorHandlingMetaTestsV3();
  workspaceUsersTest();
  scriptsTestV3();
  dashboardTestV3();
  commentsTestV3();
  tableVisibilityPermissionsTestV3();
  timelineTestV3();
  if (isEE()) {
    try {
      require('./filters.test').default();
      require('./sorts.test').default();
      require('./apiTokens.test').default();
      require('./workspace.test').default();
      require('./documents.test').default();
    } catch (e) {
      // EE test files not available in CE
    }
    hooksTestV3();
  }
  // teamsTestV3();
  // workspaceTeamsV3();
  // baseTeamsV3();
  if (isEE()) {
    orgTeamsTestV3();
  }
});
