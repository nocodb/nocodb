import {
  CloudOrgUserRoles,
  OrgUserRoles,
  ProjectRoles,
  SourceRestriction,
  WorkspaceUserRoles,
} from 'nocodb-sdk';

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
  cloudOrg: [
    CloudOrgUserRoles.VIEWER,
    CloudOrgUserRoles.CREATOR,
    CloudOrgUserRoles.OWNER,
  ],
  workspace: [
    WorkspaceUserRoles.NO_ACCESS,
    WorkspaceUserRoles.VIEWER,
    WorkspaceUserRoles.COMMENTER,
    WorkspaceUserRoles.EDITOR,
    WorkspaceUserRoles.CREATOR,
    WorkspaceUserRoles.OWNER,
  ],
  base: [
    ProjectRoles.VIEWER,
    ProjectRoles.COMMENTER,
    ProjectRoles.EDITOR,
    ProjectRoles.CREATOR,
    ProjectRoles.OWNER,
  ],
};

const permissionScopes = {
  cloudOrg: [
    // Organisation
    'orgUserAdd',
    'orgUserRemove',
    'orgUserRoleUpdate',

    'orgUpdate',
    'orgDomainList',
    'orgDomainAdd',
    'orgDomainVerify',
    'orgDomainUpdate',
    'orgDomainDelete',
    'orgSsoClientCreate',
    'orgSsoClientUpdate',
    'orgSsoClientDelete',

    'orgWorkspaceUpdate',
    'orgWorkspaceAdd',
    'orgGet',
    'orgWorkspaceList',
    'orgUserList',
    'orgBaseList',
    'orgSsoClientList',

    'paymentSeatCount',
    'manageSubscription',

    // etc
    'fetchViaUrl',
  ],
  org: [
    // SSO Client
    'ssoClientList',
    'ssoClientCreate',
    'ssoClientUpdate',
    'ssoClientDelete',
    'ssoClientGet',
    'ssoClientTest',

    // API Tokens
    'apiTokenList',
    'apiTokenCreate',
    'apiTokenDelete',

    // User
    'userList',
    'userAdd',
    'userUpdate',
    'userDelete',
    'passwordChange',
    'userInviteResend',
    'generateResetUrl',

    // Workspace Parent
    'workspaceList',
    'workspaceCreate',

    // Plugin
    'isPluginActive',
    'pluginList',
    'pluginTest',
    'pluginRead',
    'pluginUpdate',

    // Misc
    'commandPalette',
    'baseListAll',
    'instanceAdminStats',
    'instanceAdminWorkspaces',
    'instanceAdminBases',
    'testConnection',
    'genericGPT',

    // TODO: add ACL with base scope
    'upload',
    'uploadViaURL',

    'notification',
    'deleteAccount',

    'globalAuditList',

    // oAuth
    'oAuthClientList',
    'oAuthClientCreate',
    'oAuthClientUpdate',
    'oAuthClientDelete',
    'oAuthAuthorizationList',
    'oAuthAuthorizationRevoke',
    'oAuthClientGet',
    'oAuthClientRegenerateSecret',

    // mcp
    'mcpRootList',

    'getUserProfile',

    // Managed App (public operations)
    'managedAppStoreList',
    'managedAppGet',
    'managedAppVersionsList',
  ],
  workspace: [
    // Managed App (install operation)
    'managedAppInstall',
    'workspaceBaseList',
    'workspaceGet',
    'workspaceUpdate',
    'workspaceDelete',
    'workspaceUserList',
    'workspaceUserGet',
    'workspaceUserUpdate',
    'workspaceUserDelete',
    'workspaceInvite',
    'workspaceInvitationGet',
    'workspaceInvitationUpdate',
    'workspaceInvitationDelete',
    'workspaceInvitationAccept',
    'workspaceInvitationReject',
    'workspaceInvitationTokenRead',
    'duplicateSharedBase',
    'workspaceUpgrade',
    'orgWorkspaceUpgrade',
    'integrationGet',
    'integrationCreate',
    'integrationDelete',
    'integrationUpdate',
    'integrationList',
    'integrationStore',
    'integrationEndpointGet',
    'aiSchema',
    'createDataReflection',
    'deleteDataReflection',
    'getDataReflection',
    'requestUpgrade',

    'cloud-org_orgDomainAdd',
    'cloud-org_orgDomainVerify',
    'cloud-org_orgDomainUpdate',
    'cloud-org_orgDomainDelete',

    'cloud-org_orgDomainList',

    'cloud-org_paymentSeatCount',
    'cloud-org_manageSubscription',

    // Teams
    'teamList',
    'teamTree',
    'teamCreate',
    'teamGet',
    'teamUpdate',
    'teamDelete',
    'teamMove',
    'teamMembersAdd',
    'teamMembersRemove',
    'teamMembersUpdate',

    // Workspace-Team operations
    'workspaceTeamList',
    'workspaceTeamAdd',
    'workspaceTeamGet',
    'workspaceTeamUpdate',
    'workspaceTeamRemove',

    // Managed App
    'managedAppList',
    'managedAppCreate',

    // SCIM Config
    'scimConfigGet',
    'scimConfigCreate',
    'scimConfigUpdate',
    'scimConfigDelete',
  ],
  base: [
    'nestedDataListCopyPasteOrDeleteAll',
    'formViewGet',
    'baseGet',
    'tableGet',
    'dataList',
    'linkDataList',
    'bulkDataList',
    'dataRead',
    'dataExist',
    'dataFindOne',
    'dataGroupBy',
    'dataExport',
    'exportCsv',
    'exportExcel',
    'sortList',
    'filterList',
    'baseInfoGet',
    'baseUserMetaUpdate',
    'galleryViewGet',
    'kanbanViewGet',
    'calendarViewGet',
    'mapViewGet',
    'timelineViewGet',
    'timelineViewCreate',
    'timelineViewUpdate',
    'gridViewUpdate',
    'formViewUpdate',
    'formColumnUpdate',
    'galleryViewUpdate',
    'kanbanViewUpdate',
    'mapViewUpdate',
    'calendarViewUpdate',
    'listViewCreate',
    'listViewUpdate',
    'listViewDataList',
    'listViewDataCount',
    'groupedDataList',
    'mmList',
    'hmList',
    'commentRow',
    'baseList',
    'baseCost',
    'tableList',
    'viewList',
    'functionList',
    'sequenceList',
    'procedureList',
    'columnList',
    'viewColumnList',
    'triggerList',
    'relationList',
    'relationListAll',
    'indexList',
    'list',
    'dataCount',
    'dataAggregate',
    'bulkAggregate',
    'swaggerJson',
    'commentList',
    'commentCount',
    'commentDelete',
    'commentUpdate',
    'commentResolve',
    'hideAllColumns',
    'showAllColumns',
    'recordAuditList',
    'dataUpdate',
    'dataDelete',
    'dataInsert',
    'bulkDataUpsert',
    'viewColumnUpdate',
    'sortCreate',
    'sortUpdate',
    'sortDelete',
    'filterCreate',
    'filterUpdate',
    'filterDelete',
    'filterGet',
    'filterChildrenList',
    'buttonFilterList',
    'buttonFilterCreate',
    'mmExcludedList',
    'hmExcludedList',
    'btExcludedList',
    'ooExcludedList',
    'gridColumnUpdate',
    'timelineColumnUpdate',
    'bulkDataInsert',
    'bulkDataUpdate',
    'bulkDataUpdateAll',
    'bulkDataDelete',
    'bulkDataDeleteAll',
    'relationDataRemove',
    'relationDataAdd',
    'baseUserList',

    // Base API Tokens
    'baseApiTokenList',
    'baseApiTokenCreate',
    'baseApiTokenDelete',

    'createBase',
    'baseDelete',
    'sourceCreate',

    'userInvite',

    'jobList',
    // it's an extended scoped permission which is prefixed with the main scope
    'workspace_integrationList',

    // Webhooks
    'hookTrigger',

    // Actions
    'triggerAction',

    'integrationRemoteFetch',

    // AI
    'aiUtils',
    'aiData',
    'aiBaseSchema',

    // Snapshots

    'manageSnapshots',

    // Extensions
    'extensionList',
    'extensionRead',
    'extensionCreate',
    'extensionUpdate',
    'extensionDelete',

    // Scripts
    'createScript',
    'updateScript',
    'deleteScript',
    'listScripts',
    'duplicateScript',
    'getScript',
    'sendEmail',
    'baseSchema',

    'createSync',
    'triggerSync',

    // MCP
    'mcpList',
    'mcpCreate',
    'mcpUpdate',
    'mcpDelete',

    'viewRowColorInfo',
    'viewRowColorConditionAdd',
    'viewRowColorConditionUpdate',
    'viewRowColorConditionDelete',
    'viewRowColorSelectAdd',
    'viewRowColorInfoDelete',
    'rowColorConditionsFilterCreate',
    'viewSettingOverride',

    // Dashboard
    'dashboardList',
    'dashboardGet',
    'dashboardCreate',
    'dashboardUpdate',
    'dashboardDelete',
    'dashboardShare',

    // Widget
    'widgetList',
    'widgetGet',
    'widgetCreate',
    'widgetDuplicate',
    'widgetUpdate',
    'widgetDelete',
    'widgetDataGet',

    // Base Teams
    'baseTeamList',
    'baseTeamAdd',
    'baseTeamGet',
    'baseTeamUpdate',
    'baseTeamDelete',

    // Workflows
    'workflowList',
    'workflowGet',
    'workflowCreate',
    'workflowDuplicate',
    'workflowUpdate',
    'workflowDelete',
    'workflowExecutionList',
    'workflowExecutionGet',
    'workflowNodes',
    'workflowExecute',
    'workflowTestNode',
    'workflowPublish',
    'workflowNodeIntegrationFetchOptions',

    // Managed App (management operations)
    'managedAppGetUpdates',
    'managedAppUpdate',
    'managedAppDelete',
    'managedAppPublish',
    'managedAppUnpublish',

    // Sandbox
    'sandboxList',
    'sandboxGet',
    'sandboxCreate',
    'sandboxDiscard',
    'sandboxDelete',
    'sandboxMerge',
    'sandboxDiff',

    // Audit Logs
    'baseAuditList',

    // Send record email
    'sendRecordEmail',

    // Record Templates
    'recordTemplateList',
    'recordTemplateGet',
    'recordTemplateCreate',
    'recordTemplateUpdate',
    'recordTemplateDelete',
    'recordTemplateUse',

    // RLS (Row-Level Security) — owner only
    'rlsPolicyList',
    'rlsPolicyGet',
    'rlsPolicyCreate',
    'rlsPolicyUpdate',
    'rlsPolicyDelete',
    'rlsPolicySetSubjects',
    'rlsPolicyFilterList',
    'rlsPolicyFilterCreate',
  ],
};

const rolePermissions:
  | Record<
      | Exclude<OrgUserRoles, OrgUserRoles.SUPER_ADMIN>
      | ProjectRoles
      | WorkspaceUserRoles
      | CloudOrgUserRoles
      | 'guest',
      { include?: Record<string, boolean>; exclude?: Record<string, boolean> }
    >
  | Record<OrgUserRoles.SUPER_ADMIN, string> = {
  [OrgUserRoles.SUPER_ADMIN]: '*', // all permissions
  guest: {
    include: {},
  },

  [OrgUserRoles.VIEWER]: {
    include: {
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      passwordChange: true,

      workspaceList: true,
      workspaceCreate: true,
      commandPalette: true,
      baseListAll: true,
      // allow only in cloud
      testConnection: true,
      notification: true,
      deleteAccount: true,

      // oauth allowed for all users
      oAuthClientList: true,
      oAuthClientCreate: true,
      oAuthClientUpdate: true,
      oAuthClientDelete: true,
      oAuthClientGet: true,
      oAuthAuthorizationList: true,
      oAuthAuthorizationRevoke: true,
      oAuthClientRegenerateSecret: true,

      // mcp
      mcpRootList: true,

      getUserProfile: true,

      // Managed App (public operations - available to everyone)
      managedAppStoreList: true,
      managedAppGet: true,
      managedAppVersionsList: true,
    },
  },
  [CloudOrgUserRoles.VIEWER]: {
    include: {},
  },
  [OrgUserRoles.CREATOR]: {
    include: {
      upload: true,
      uploadViaURL: true,
      isPluginActive: true,
      genericGPT: true,
    },
  },
  [WorkspaceUserRoles.NO_ACCESS]: {
    include: {
      workspaceGet: true,
      workspaceBaseList: true,

      // Teams
      teamList: true,
    },
  },

  [CloudOrgUserRoles.OWNER]: {
    include: {
      orgUserAdd: true,
      orgUserRemove: true,
      orgUserRoleUpdate: true,
      orgDomainAdd: true,
      orgDomainVerify: true,
      orgDomainUpdate: true,
      orgDomainDelete: true,
      orgUpdate: true,

      orgSsoClientCreate: true,
      orgSsoClientUpdate: true,
      orgSsoClientDelete: true,

      manageSubscription: true,
      paymentSeatCount: true,
    },
  },
  [CloudOrgUserRoles.CREATOR]: {
    include: {
      orgWorkspaceUpdate: true,
      orgWorkspaceAdd: true,
      orgDomainList: true,
      orgGet: true,
      orgWorkspaceList: true,
      orgUserList: true,
      orgBaseList: true,
      orgSsoClientList: true,
    },
  },

  [WorkspaceUserRoles.VIEWER]: {
    include: {
      workspaceUserList: true,
      workspaceInvite: true,
      workspaceUserDelete: true,
      requestUpgrade: true,

      // Teams
      teamGet: true,
      teamTree: true,
      teamCreate: true,
      teamUpdate: true,
      teamDelete: true,
      teamMove: true,
      teamMembersAdd: true,
      teamMembersRemove: true,
      teamMembersUpdate: true,

      // Workspace-Team operations
      workspaceTeamList: true,
      workspaceTeamAdd: true,
      workspaceTeamGet: true,
      workspaceTeamUpdate: true,
      workspaceTeamRemove: true,
    },
  },
  [WorkspaceUserRoles.COMMENTER]: {
    include: {},
  },
  [WorkspaceUserRoles.EDITOR]: {
    include: {},
  },
  [WorkspaceUserRoles.CREATOR]: {
    exclude: {
      workspaceDelete: true,
      'cloud-org_manageSubscription': true,
      scimConfigGet: true,
      scimConfigCreate: true,
      scimConfigUpdate: true,
      scimConfigDelete: true,
    },
  },
  [WorkspaceUserRoles.OWNER]: {
    exclude: {},
  },

  [ProjectRoles.VIEWER]: {
    include: {
      userInvite: true,

      // Base Teams
      baseTeamAdd: true,

      formViewGet: true,

      // base
      baseGet: true,
      //table
      tableGet: true,
      // data
      dataList: true,
      linkDataList: true,
      bulkDataList: true,
      dataRead: true,
      dataExist: true,
      dataExport: true,
      dataFindOne: true,
      dataGroupBy: true,
      // commentCount: process.env.NC_CLOUD !== 'true',
      exportCsv: true,
      exportExcel: true,

      // sort & filter
      sortList: true,
      filterList: true,
      baseInfoGet: true,
      baseUserMetaUpdate: true,

      galleryViewGet: true,
      kanbanViewGet: true,
      calendarViewGet: true,
      timelineViewGet: true,
      listViewDataList: true,
      listViewDataCount: true,
      mapViewGet: true,
      groupedDataList: true,

      mmList: true,
      hmList: true,

      baseList: true,
      baseCost: true,

      tableList: true,
      viewList: true,
      functionList: true,
      sequenceList: true,
      procedureList: true,
      columnList: true,
      viewColumnList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,

      dataCount: true,
      dataAggregate: true,
      bulkAggregate: true,
      swaggerJson: true,

      baseUserList: true,

      // Extensions
      extensionList: true,
      extensionRead: true,

      jobList: true,
      commentList: true,
      commentCount: true,
      recordAuditList: true,

      mcpList: true,
      mcpCreate: true,
      mcpUpdate: true,
      mcpDelete: true,

      viewRowColorInfo: true,

      // Dashboard
      dashboardList: true,
      dashboardGet: true,

      // Widget
      widgetList: true,
      widgetGet: true,
      widgetDataGet: true,

      // Base Teams
      baseTeamList: true,
      baseTeamGet: true,

      // Send record email
      sendRecordEmail: true,
      // Sandbox
      sandboxGet: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentRow: true,
      commentUpdate: true,
      commentResolve: true,
      commentDelete: true,
    },
  },
  [ProjectRoles.EDITOR]: {
    include: {
      dataUpdate: true,
      dataDelete: true,
      dataInsert: true,
      bulkDataUpsert: true,
      nestedDataListCopyPasteOrDeleteAll: true,
      filterGet: true,
      filterChildrenList: true,
      mmExcludedList: true,
      hmExcludedList: true,
      btExcludedList: true,
      ooExcludedList: true,

      bulkDataInsert: true,
      bulkDataUpdate: true,
      bulkDataUpdateAll: true,
      bulkDataDelete: true,
      bulkDataDeleteAll: true,
      relationDataRemove: true,
      relationDataAdd: true,

      // TODO implement this
      // upload: true,
      // uploadViaURL: true,

      // AI
      aiUtils: true,
      aiData: true,

      // Scripts
      listScripts: true,
      getScript: true,
      baseSchema: true,
      sendEmail: true,

      hookTrigger: true,
      triggerAction: true,

      integrationRemoteFetch: true,

      // Sync
      triggerSync: true,

      // Extensions
      extensionUpdate: true,

      // Sort/Filter/ViewColumn/View operations for personal views (middleware handles ownership check)
      sortCreate: true,
      sortUpdate: true,
      sortDelete: true,
      filterCreate: true,
      filterUpdate: true,
      filterDelete: true,
      viewColumnUpdate: true,
      hideAllColumns: true,
      showAllColumns: true,
      gridColumnUpdate: true,
      gridViewUpdate: true,
      galleryViewUpdate: true,
      kanbanViewUpdate: true,
      mapViewUpdate: true,
      calendarViewUpdate: true,
      timelineViewUpdate: true,
      listViewUpdate: true,

      // Row color operations for personal views (middleware handles ownership check)
      viewRowColorConditionAdd: true,
      viewRowColorConditionUpdate: true,
      viewRowColorConditionDelete: true,
      viewRowColorSelectAdd: true,
      viewRowColorInfoDelete: true,
      rowColorConditionsFilterCreate: true,

      // Record Templates
      recordTemplateList: true,
      recordTemplateGet: true,
      recordTemplateCreate: true,
      recordTemplateUpdate: true,
      recordTemplateDelete: true,
      recordTemplateUse: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    exclude: {
      createBase: true,
      manageSnapshots: true,
      baseAuditList: true,
      rlsPolicyList: true,
      rlsPolicyGet: true,
      rlsPolicyCreate: true,
      rlsPolicyUpdate: true,
      rlsPolicyDelete: true,
      rlsPolicySetSubjects: true,
      rlsPolicyFilterList: true,
      rlsPolicyFilterCreate: true,
    },
  },
  [ProjectRoles.OWNER]: {
    exclude: {},
  },
};

// Excluded permissions for source restrictions
// `true` means permission is restricted and `false`/missing means permission is allowed
export const sourceRestrictions = {
  [SourceRestriction.SCHEMA_READONLY]: {
    tableCreate: true,
    tableDelete: true,
  },
  [SourceRestriction.DATA_READONLY]: {
    dataUpdate: true,
    dataDelete: true,
    dataInsert: true,
    bulkDataInsert: true,
    bulkDataUpdate: true,
    bulkDataUpdateAll: true,
    bulkDataDelete: true,
    bulkDataDeleteAll: true,
    relationDataRemove: true,
    relationDataAdd: true,
    nestedDataListCopyPasteOrDeleteAll: true,
    nestedDataUnlink: true,
    nestedDataLink: true,
  },
};

// VALIDATIONS

// validate no permission shared between scopes
{
  const scopePermissions = {};
  const duplicates = [];
  Object.keys(permissionScopes).forEach((scope) => {
    permissionScopes[scope].forEach((perm) => {
      if (scopePermissions[perm]) {
        duplicates.push(perm);
      } else {
        scopePermissions[perm] = true;
      }
    });
    if (duplicates.length) {
      throw new Error(
        `Duplicate permissions found in scope ${scope}. Please remove duplicate permissions: ${duplicates.join(
          ', ',
        )}`,
      );
    }
  });
}

// validate no duplicate permissions within same scope
/*
  We inherit include permissions from previous roles in the same scope (role order)
  We inherit exclude permissions from previous roles in the same scope (reverse role order)
  To determine role order, we use `roleScopes` object
*/
Object.values(roleScopes).forEach((roles) => {
  const scopePermissions = {};
  const duplicates = [];
  roles.forEach((role) => {
    const perms =
      rolePermissions[role].include || rolePermissions[role].exclude || {};
    Object.keys(perms).forEach((perm) => {
      if (scopePermissions[perm]) {
        duplicates.push(perm);
      }
      scopePermissions[perm] = true;
    });
  });
  if (duplicates.length) {
    throw new Error(
      `Duplicate permissions found in roles ${roles.join(
        ', ',
      )}. Please remove duplicate permissions: ${duplicates.join(', ')}`,
    );
  }
});

// validate permission scopes are valid
Object.entries(rolePermissions).forEach(([role, permissions]) => {
  if (permissions === '*') return;
  if (role === 'guest') return;

  let roleScope = null;

  Object.entries(roleScopes).forEach(([scope, roles]) => {
    if ((roles as any).includes(role)) {
      roleScope = scope;
    }
  });

  if (!roleScope) {
    throw new Error(
      `Role ${role} does not belong to any scope, please assign it to a scope`,
    );
  }

  const scopePermissions = permissionScopes[roleScope];

  if (!scopePermissions) {
    throw new Error(
      `Scope ${roleScope} does not exist, please create it in permissionScopes`,
    );
  }

  const mismatchedPermissions = [];

  Object.keys(permissions.include || {}).forEach((perm) => {
    if (!scopePermissions.includes(perm)) {
      mismatchedPermissions.push(perm);
    }
  });

  Object.keys(permissions.exclude || {}).forEach((perm) => {
    if (!scopePermissions.includes(perm)) {
      mismatchedPermissions.push(perm);
    }
  });

  if (mismatchedPermissions.length) {
    throw new Error(
      `Role ${role} has permissions that do not belong to its scope ${roleScope}. Please remove or add these permissions: ${mismatchedPermissions.join(
        ', ',
      )}`,
    );
  }
});

// inherit include permissions within scope (role order)
Object.values(roleScopes).forEach((roles) => {
  let roleIndex = 0;
  for (const role of roles) {
    if (roleIndex === 0) {
      roleIndex++;
      continue;
    }

    if (rolePermissions[role] === '*') continue;
    if (rolePermissions[role].include) {
      Object.assign(
        rolePermissions[role].include,
        rolePermissions[roles[roleIndex - 1]].include,
      );
    }

    roleIndex++;
  }
});

// inherit exclude permissions within scope (reverse role order)
Object.values(roleScopes).forEach((roles) => {
  const reversedRoles = [...roles].reverse();
  let roleIndex = 0;
  for (const role of reversedRoles) {
    if (roleIndex === 0) {
      roleIndex++;
      continue;
    }

    if (rolePermissions[role] === '*') continue;

    if (rolePermissions[role].exclude) {
      Object.assign(
        rolePermissions[role].exclude,
        rolePermissions[roles[roleIndex - 1]].exclude,
      );
    }

    roleIndex++;
  }
});

// exclude out of scope permissions
// - org roles exclude base and workspace permissions
// - workspace roles exclude org permissions (we don't exclude base permissions as we inherit base permissions to workspace)
// - base roles exclude workspace and org permissions
Object.entries(roleScopes).forEach(([scope, roles]) => {
  const outOfScopePermissions = Object.keys(permissionScopes).reduce(
    (acc, curr) => {
      if (curr !== scope) {
        Object.assign(
          acc,

          permissionScopes[curr].reduce((acc, val) => {
            acc[val] = true;
            return acc;
          }, {}),
        );
      }
      return acc;
    },
    {},
  );

  roles.forEach((role) => {
    if (rolePermissions[role] === '*') return;
    if (!rolePermissions[role].exclude) return;
    Object.assign(rolePermissions[role].exclude, outOfScopePermissions);
  });
});

// validate include and exclude can't exist at the same time
Object.values(rolePermissions).forEach((role) => {
  if (role === '*') return;
  if (role.include && role.exclude) {
    throw new Error(
      `Role ${role} has both include and exclude permissions. Please remove one of them`,
    );
  }
});

// In cloud everyone have same org permissions other than super admin
rolePermissions[OrgUserRoles.VIEWER] = rolePermissions[OrgUserRoles.CREATOR];

export default rolePermissions;

const permissionDescriptions: Record<string, string> = {
  // cloudOrg permissions
  orgUserAdd: 'add users to the organization',
  orgUserRemove: 'remove users from the organization',
  orgUserRoleUpdate: 'update user roles in the organization',
  orgUpdate: 'update organization details',
  orgDomainList: 'view organization domains',
  orgDomainAdd: 'add a new domain to the organization',
  orgDomainVerify: 'verify a domain in the organization',
  orgDomainUpdate: 'update domain details in the organization',
  orgDomainDelete: 'remove a domain from the organization',
  orgSsoClientCreate: 'create a new SSO client',
  orgSsoClientUpdate: 'update SSO client details',
  orgSsoClientDelete: 'delete an SSO client',
  orgWorkspaceUpdate: 'update workspace details',
  orgWorkspaceAdd: 'add a new workspace',
  orgGet: 'view organization details',
  orgWorkspaceList: 'view list of workspaces in the organization',
  orgUserList: 'view list of users in the organization',
  orgBaseList: 'view list of bases in the organization',
  orgSsoClientList: 'view list of SSO clients in the organization',

  // org permissions
  ssoClientList: 'view list of SSO clients',
  ssoClientCreate: 'create a new SSO client',
  ssoClientUpdate: 'update SSO client details',
  ssoClientDelete: 'delete an SSO client',
  ssoClientGet: 'view SSO client details',
  ssoClientTest: 'test an SSO client',

  apiTokenList: 'view list of API tokens',
  apiTokenCreate: 'create a new API token',
  apiTokenDelete: 'delete an API token',

  userList: 'view list of users',
  userAdd: 'add a new user',
  userUpdate: 'update user details',
  userDelete: 'delete a user',
  passwordChange: 'change your password',
  userInviteResend: 'resend user invitation',
  generateResetUrl: 'generate a password reset URL',

  workspaceList: 'view list of workspaces',
  workspaceCreate: 'create a new workspace',

  isPluginActive: 'check if a plugin is active',
  pluginList: 'view list of plugins',
  pluginTest: 'test a plugin',
  pluginRead: 'read plugin configuration',
  pluginUpdate: 'update plugin configuration',

  commandPalette: 'access the command palette',
  baseListAll: 'list all workspaces and bases',
  instanceAdminStats: 'view instance admin statistics',
  instanceAdminWorkspaces: 'list all workspaces in instance admin',
  instanceAdminBases: 'list all bases in instance admin',
  testConnection: 'test connection to a service',
  genericGPT: 'use generic GPT functionality',

  upload: 'upload files',
  uploadViaURL: 'upload files via URL',

  notification: 'send notifications',

  // workspace permissions
  workspaceBaseList: 'view list of bases in the workspace',
  workspaceGet: 'view workspace details',
  workspaceUpdate: 'update workspace details',
  workspaceDelete: 'delete a workspace',
  workspaceUserList: 'view list of users in the workspace',
  workspaceUserGet: 'view workspace user details',
  workspaceUserUpdate: 'update workspace user details',
  workspaceUserDelete: 'remove a user from the workspace',
  workspaceInvite: 'invite users to the workspace',
  workspaceInvitationGet: 'view workspace invitations',
  workspaceInvitationUpdate: 'update workspace invitations',
  workspaceInvitationDelete: 'delete workspace invitations',
  workspaceInvitationAccept: 'accept a workspace invitation',
  workspaceInvitationReject: 'reject a workspace invitation',
  workspaceInvitationTokenRead: 'read workspace invitation token',
  duplicateSharedBase: 'duplicate a shared base',
  workspaceUpgrade: 'upgrade the workspace',
  orgWorkspaceUpgrade: 'upgrade the organization workspace',
  integrationGet: 'view integration details',
  integrationCreate: 'create a new integration',
  integrationDelete: 'delete an integration',
  integrationUpdate: 'update integration details',
  integrationList: 'view list of integrations',
  integrationStore: "get data from an integration's store",
  integrationEndpointGet: 'call get request to an exposed integration endpoint',

  // Teams permissions
  teamList: 'view list of teams in the workspace',
  teamTree: 'view team hierarchy tree in the workspace',
  teamCreate: 'create a new team in the workspace',
  teamGet: 'view team details',
  teamUpdate: 'update team details',
  teamDelete: 'delete a team from the workspace',
  teamMove: 'move a team to a different parent in the hierarchy',
  teamMembersAdd: 'add members to a team',
  teamMembersRemove: 'remove members from a team',
  teamMembersUpdate: 'update member roles in a team',

  // SCIM Config permissions
  scimConfigGet: 'view SCIM configuration',
  scimConfigCreate: 'initialize SCIM configuration',
  scimConfigUpdate: 'update SCIM configuration',
  scimConfigDelete: 'delete SCIM configuration',

  // base permissions
  formViewGet: 'view forms',
  baseGet: 'view base details',
  tableGet: 'view table details',
  dataList: 'view data',
  linkDataList: 'view data',
  bulkDataList: 'view data',
  dataRead: 'read data',
  dataExist: 'check if data exists',
  dataFindOne: 'find a single data record',
  dataGroupBy: 'group data by a specific field',
  exportCsv: 'export data to CSV',
  exportExcel: 'export data to Excel',
  sortList: 'view list of sorts',
  filterList: 'view list of filters',
  baseInfoGet: 'view base information',
  baseUserMetaUpdate: 'update user metadata for the base',
  galleryViewGet: 'view gallery',
  kanbanViewGet: 'view Kanban board',
  calendarViewGet: 'view calendar',
  timelineViewGet: 'view timeline',
  timelineViewCreate: 'create timeline view',
  timelineViewUpdate: 'update timeline view',
  listViewCreate: 'create list view',
  listViewUpdate: 'update list view',
  listViewDataList: 'view list view data',
  listViewDataCount: 'view list view data count',
  mapViewGet: 'view map',
  gridViewUpdate: 'update grid view',
  formViewUpdate: 'update form view',
  formColumnUpdate: 'update form columns',
  groupedDataList: 'view grouped data',
  mmList: 'view many-to-many relationships',
  hmList: 'view hierarchical relationships',
  commentRow: 'comment on a row',
  baseList: 'view list of bases',
  baseCost: 'view base cost',
  tableList: 'view list of tables',
  viewList: 'view list of views',
  functionList: 'view list of functions',
  sequenceList: 'view list of sequences',
  procedureList: 'view list of procedures',
  columnList: 'view list of columns',
  viewColumnList: 'view list of view columns',
  triggerList: 'view list of triggers',
  relationList: 'view list of relations',
  relationListAll: 'view all relations',
  indexList: 'view list of indexes',
  list: 'view list of items',
  dataCount: 'view data count',
  dataAggregate: 'view data aggregates',
  bulkAggregate: 'view data aggregates',
  swaggerJson: 'view Swagger JSON',
  commentList: 'view list of comments',
  commentCount: 'view comment count',
  commentDelete: 'delete comments',
  commentUpdate: 'update comments',
  commentResolve: 'resolve comments',
  hideAllColumns: 'hide all columns',
  showAllColumns: 'show all columns',
  recordAuditList: 'view audit log for a row',
  dataUpdate: 'update data',
  dataDelete: 'delete data',
  dataInsert: 'insert new data',
  viewColumnUpdate: 'update view columns',
  sortCreate: 'create a new sort',
  sortUpdate: 'update an existing sort',
  sortDelete: 'delete a sort',
  filterCreate: 'create a new filter',
  filterUpdate: 'update an existing filter',
  filterDelete: 'delete a filter',
  filterGet: 'view filter details',
  filterChildrenList: 'view child filters',
  buttonFilterList: 'list button visibility filters',
  buttonFilterCreate: 'create a button visibility filter',
  mmExcludedList: 'view excluded many-to-many relationships',
  hmExcludedList: 'view excluded hierarchical relationships',
  btExcludedList: 'view excluded relationships',
  ooExcludedList: 'view excluded one-to-one relationships',
  gridColumnUpdate: 'update grid columns',
  timelineColumnUpdate: 'update timeline columns',
  bulkDataInsert: 'bulk insert data',
  bulkDataUpdate: 'bulk update data',
  bulkDataUpdateAll: 'bulk update all data',
  bulkDataDelete: 'bulk delete data',
  bulkDataDeleteAll: 'bulk delete all data',
  relationDataRemove: 'remove related data',
  relationDataAdd: 'add related data',
  baseUserList: 'view list of users in the base',

  baseApiTokenList: 'view list of base API tokens',
  baseApiTokenCreate: 'create a new base API token',
  baseApiTokenDelete: 'delete a base API token',

  createBase: 'create a new base',
  baseDelete: 'delete a base',
  sourceCreate: 'create a new source',

  userInvite: 'invite a user',

  jobList: 'view list of jobs',
  workspace_integrationList: 'view list of workspace integrations',

  hookTrigger: 'trigger a webhook',

  mcpList: 'view list of MCP tokens',
  mcpCreate: 'create a new MCP token',
  mcpUpdate: 'update an MCP token',
  mcpDelete: 'delete an MCP token',

  dashboardList: 'view list of dashboards',
  dashboardGet: 'view dashboard details',
  dashboardCreate: 'create a new dashboard',
  dashboardUpdate: 'update dashboard details',
  dashboardDelete: 'delete a dashboard',
  dashboardShare: 'share a dashboard',

  widgetList: 'view list of widgets',
  widgetGet: 'view widget details',
  widgetCreate: 'create a new widget',
  widgetDuplicate: 'duplicate a widget',
  widgetUpdate: 'update widget details',
  widgetDelete: 'delete a widget',
  widgetDataGet: 'view widget data',

  // Base Teams permissions
  baseTeamList: 'view list of teams in the base',
  baseTeamAdd: 'create a new team in the base',
  baseTeamGet: 'view team details',
  baseTeamUpdate: 'update team details',
  baseTeamDelete: 'delete a team from the base',

  globalAuditList: 'view list of audits',

  // Managed App permissions
  managedAppStoreList: 'browse public managed apps in the app store',
  managedAppList: 'view list of managed apps in the workspace',
  managedAppGet: 'view managed app details',
  managedAppCreate: 'create a new managed app',
  managedAppUpdate: 'update managed app details',
  managedAppDelete: 'delete a managed app',
  managedAppPublish: 'publish a managed app to the app store',
  managedAppUnpublish: 'unpublish a managed app from the app store',
  managedAppInstall: 'install a managed app as a new base',
  managedAppGetUpdates: 'check for updates to an installed managed app',

  // Sandbox permissions
  sandboxList: 'view list of sandboxes for the base',
  sandboxGet: 'view sandbox status and details',
  sandboxCreate: 'create a sandbox environment for the base',
  sandboxDiscard: 'discard an active sandbox environment',
  sandboxMerge: 'merge sandbox changes back to the master base',
  sandboxDelete: 'delete a sandbox environment',
  sandboxDiff: 'view differences between sandbox and master base',

  viewRowColorInfo: 'view row colouring info',
  viewSettingOverride: 'copy view configuration from other view',

  workflowList: 'view list of workflows',
  workflowGet: 'view workflow details',
  workflowCreate: 'create a new workflow',
  workflowDuplicate: 'duplicate a workflow',
  workflowUpdate: 'update workflow details',
  workflowDelete: 'delete a workflow',
  workflowExecutionList: 'view workflow execution logs',
  workflowExecutionGet: 'view workflow execution details',

  baseAuditList: 'view audit log for a base',
};

// Human-readable descriptions for roles
const roleDescriptions: Record<string, string> = {
  // CloudOrg roles
  [CloudOrgUserRoles.VIEWER]: 'Viewer',
  [CloudOrgUserRoles.CREATOR]: 'Creator',
  [CloudOrgUserRoles.OWNER]: 'Owner',
  // Workspace roles
  [WorkspaceUserRoles.NO_ACCESS]: 'No Access',
  [WorkspaceUserRoles.VIEWER]: 'Viewer',
  [WorkspaceUserRoles.COMMENTER]: 'Commenter',
  [WorkspaceUserRoles.EDITOR]: 'Editor',
  [WorkspaceUserRoles.CREATOR]: 'Creator',
  [WorkspaceUserRoles.OWNER]: 'Owner',
  // Base roles
  [ProjectRoles.VIEWER]: 'Viewer',
  [ProjectRoles.COMMENTER]: 'Commenter',
  [ProjectRoles.EDITOR]: 'Editor',
  [ProjectRoles.CREATOR]: 'Creator',
  [ProjectRoles.OWNER]: 'Owner',
};

export function generateReadablePermissionErr(
  permissionName: string,
  roles: Record<string, boolean>,
  _scope: string,
): string {
  const roleLabels = Object.keys(roles)
    .filter((key) => roles[key])
    .map((role) => roleDescriptions[role])
    .join(', ');

  const permissionDescription =
    permissionDescriptions[permissionName] ||
    `perform the action "${permissionName}"`;

  return `You do not have permission to ${permissionDescription} with the roles: ${roleLabels}.`;
}
