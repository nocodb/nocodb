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
    'passwordChange',

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
    'testConnection',
    'genericGPT',

    // TODO: add ACL with base scope
    'upload',
    'uploadViaURL',

    'notification',
    'deleteAccount',

    'globalAuditList',
  ],
  workspace: [
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
    'aiSchema',
    'createDataReflection',
    'deleteDataReflection',
    'getDataReflection',
    'paymentSeatCount',
    'manageSubcription',
    'requestUpgrade',

    'cloud-org_orgDomainAdd',
    'cloud-org_orgDomainVerify',
    'cloud-org_orgDomainUpdate',
    'cloud-org_orgDomainDelete',

    'cloud-org_orgDomainList',
  ],
  base: [
    'nestedDataListCopyPasteOrDeleteAll',
    'formViewGet',
    'baseGet',
    'tableGet',
    'dataList',
    'dataRead',
    'dataExist',
    'dataFindOne',
    'dataGroupBy',
    'exportCsv',
    'exportExcel',
    'sortList',
    'filterList',
    'baseInfoGet',
    'baseUserMetaUpdate',
    'galleryViewGet',
    'kanbanViewGet',
    'calendarViewGet',
    'gridViewUpdate',
    'formViewUpdate',
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
    'triggerList',
    'relationList',
    'relationListAll',
    'indexList',
    'list',
    'dataCount',
    'dataAggregate',
    'swaggerJson',
    'commentList',
    'commentsCount',
    'commentDelete',
    'commentUpdate',
    'hideAllColumns',
    'showAllColumns',
    'auditListRow',
    'dataUpdate',
    'dataDelete',
    'dataInsert',
    'viewColumnUpdate',
    'sortCreate',
    'sortUpdate',
    'sortDelete',
    'filterCreate',
    'filterUpdate',
    'filterDelete',
    'filterGet',
    'filterChildrenRead',
    'mmExcludedList',
    'hmExcludedList',
    'btExcludedList',
    'ooExcludedList',
    'gridColumnUpdate',
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

    // AI
    'aiUtils',
    'aiData',
    'aiBaseSchema',

    // Snapshots

    'manageSnapshots',

    // Scripts
    'createScript',
    'updateScript',
    'deleteScript',
    'listScripts',
    'getScript',
    'baseSchema',

    'createSync',
    'triggerSync',

    // MCP
    'mcpList',
    'mcpCreate',
    'mcpUpdate',
    'mcpDelete',
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
      // allow only in cloud
      testConnection: true,
      notification: true,
      deleteAccount: true,
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
      manageSubcription: true,
    },
  },
  [WorkspaceUserRoles.OWNER]: {
    exclude: {},
  },

  [ProjectRoles.VIEWER]: {
    include: {
      userInvite: true,

      formViewGet: true,

      // base
      baseGet: true,
      //table
      tableGet: true,
      // data
      dataList: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      // commentsCount: process.env.NC_CLOUD !== 'true',
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
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,

      dataCount: true,
      dataAggregate: true,
      swaggerJson: true,

      baseUserList: true,

      jobList: true,
      commentList: true,
      commentsCount: true,
      auditListRow: true,

      mcpList: true,
      mcpCreate: true,
      mcpUpdate: true,
      mcpDelete: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentRow: true,
      commentUpdate: true,
      commentDelete: true,
    },
  },
  [ProjectRoles.EDITOR]: {
    include: {
      hideAllColumns: true,
      showAllColumns: true,
      dataUpdate: true,
      dataDelete: true,
      dataInsert: true,
      nestedDataListCopyPasteOrDeleteAll: true,
      viewColumnUpdate: true,
      gridViewUpdate: true,
      formViewUpdate: true,
      sortCreate: true,
      sortUpdate: true,
      sortDelete: true,
      filterCreate: true,
      filterUpdate: true,
      filterDelete: true,
      filterGet: true,
      filterChildrenRead: true,
      mmExcludedList: true,
      hmExcludedList: true,
      btExcludedList: true,
      ooExcludedList: true,
      gridColumnUpdate: true,

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

      hookTrigger: true,

      // Sync
      triggerSync: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    exclude: {
      createBase: true,
      manageSnapshots: true,
      createScript: true,
      updateScript: true,
      deleteScript: true,
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

  passwordChange: 'change your password',

  workspaceList: 'view list of workspaces',
  workspaceCreate: 'create a new workspace',

  isPluginActive: 'check if a plugin is active',
  pluginList: 'view list of plugins',
  pluginTest: 'test a plugin',
  pluginRead: 'read plugin configuration',
  pluginUpdate: 'update plugin configuration',

  commandPalette: 'access the command palette',
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

  // base permissions
  formViewGet: 'view forms',
  baseGet: 'view base details',
  tableGet: 'view table details',
  dataList: 'view data',
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
  gridViewUpdate: 'update grid view',
  formViewUpdate: 'update form view',
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
  triggerList: 'view list of triggers',
  relationList: 'view list of relations',
  relationListAll: 'view all relations',
  indexList: 'view list of indexes',
  list: 'view list of items',
  dataCount: 'view data count',
  dataAggregate: 'view data aggregates',
  swaggerJson: 'view Swagger JSON',
  commentList: 'view list of comments',
  commentsCount: 'view comment count',
  commentDelete: 'delete comments',
  commentUpdate: 'update comments',
  hideAllColumns: 'hide all columns',
  showAllColumns: 'show all columns',
  auditListRow: 'view audit log for a row',
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
  filterChildrenRead: 'view child filters',
  mmExcludedList: 'view excluded many-to-many relationships',
  hmExcludedList: 'view excluded hierarchical relationships',
  btExcludedList: 'view excluded relationships',
  ooExcludedList: 'view excluded one-to-one relationships',
  gridColumnUpdate: 'update grid columns',
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

  globalAuditList: 'view list of audits',
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
