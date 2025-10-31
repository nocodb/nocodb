import { runOnSet } from '../../../utils/runOnSet';
import baseTestV3 from './base.test';
import tableTestV3 from './table.test';
import viewTestV3 from './view.test';
import columnTestV3 from './column.test';
import baseUsersTestV3 from './baseUsers.test';
import errorHandlingMetaTestsV3 from './error-handling/index.test';
import workspaceUsersTest from './workspaceUsers.test';
// import teamPermissionsTestV3 from './team-permissions.test';
// import teamPermissionBehaviorTestV3 from './team-permission-behavior.test';
// import teamsTestV3 from './teams.test';
// import workspaceTeamsV3 from './workspace-teams.test';
// import baseTeamsV3 from './base-teams.test';

export default runOnSet(2, function () {
  baseTestV3();
  baseUsersTestV3();
  tableTestV3();
  viewTestV3();
  columnTestV3();
  errorHandlingMetaTestsV3();
  workspaceUsersTest();
  // teamPermissionsTestV3();
  // teamPermissionBehaviorTestV3();
  // teamsTestV3();
  // workspaceTeamsV3();
  // baseTeamsV3();
});
