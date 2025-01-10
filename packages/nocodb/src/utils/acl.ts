import { OrgUserRoles, ProjectRoles, SourceRestriction } from 'nocodb-sdk';

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
  base: [
    ProjectRoles.VIEWER,
    ProjectRoles.COMMENTER,
    ProjectRoles.EDITOR,
    ProjectRoles.CREATOR,
    ProjectRoles.OWNER,
  ],
};

// todo: convert to enum
const permissionScopes = {
  org: [
    // API Tokens
    'apiTokenList',
    'apiTokenCreate',
    'apiTokenDelete',

    // Base
    'baseList',
    'baseCreate',

    // User
    'userList',
    'userAdd',
    'userUpdate',
    'userDelete',
    'passwordChange',
    'userInviteResend',
    'generateResetUrl',

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
    'duplicateSharedBase',

    // Cache
    'cacheGet',
    'cacheDelete',

    // TODO: add ACL with base scope
    'upload',
    'uploadViaURL',

    'notification',

    // Integration
    'integrationGet',
    'integrationCreate',
    'integrationDelete',
    'integrationUpdate',
    'integrationList',

    // AI
    'aiSchema',
  ],
  base: [
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
    'gridViewUpdate',
    'formViewUpdate',
    'calendarViewGet',
    'groupedDataList',
    'mmList',
    'hmList',
    'commentRow',
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
    'duplicateColumn',
    'nestedDataList',
    'nestedDataLink',
    'nestedDataUnlink',
    'nestedListCopyPasteOrDeleteAll',
    'baseUserList',
    'sourceCreate',

    // Base API Tokens
    'baseApiTokenList',
    'baseApiTokenCreate',
    'baseApiTokenDelete',

    // Extensions
    'extensionList',
    'extensionRead',
    'extensionCreate',
    'extensionUpdate',
    'extensionDelete',

    // Jobs
    'jobList',

    'org_integrationList',

    // Webhooks

    'hookTrigger',

    'userInvite',

    // AI
    'aiUtils',
    'aiData',
    'aiBaseSchema',
  ],
};

const rolePermissions:
  | Record<
      Exclude<OrgUserRoles, OrgUserRoles.SUPER_ADMIN> | ProjectRoles | 'guest',
      { include?: Record<string, boolean>; exclude?: Record<string, boolean> }
    >
  | Record<OrgUserRoles.SUPER_ADMIN, string> = {
  guest: {},
  [OrgUserRoles.SUPER_ADMIN]: '*',

  [ProjectRoles.VIEWER]: {
    include: {
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

      exportCsv: true,
      exportExcel: true,

      // sort & filter
      sortList: true,
      filterList: true,
      baseInfoGet: true,
      baseUserMetaUpdate: true,

      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,
      calendarViewGet: true,

      mmList: true,
      hmList: true,

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

      nestedDataList: true,
      baseUserList: true,

      extensionList: true,
      extensionRead: true,

      jobList: true,
      commentList: true,
      commentsCount: true,
      auditListRow: true,

      userInvite: true,
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

      nestedDataLink: true,
      nestedDataUnlink: true,
      nestedListCopyPasteOrDeleteAll: true,
      // TODO add ACL with base scope
      // upload: true,
      // uploadViaURL: true,
      hookTrigger: true,

      // AI
      aiUtils: true,
      aiData: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    exclude: {
      baseDelete: true,
    },
  },
  [ProjectRoles.OWNER]: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
      createBase: true,
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      passwordChange: true,
      baseList: true,
      testConnection: true,
      isPluginActive: true,
      commandPalette: true,
      notification: true,
    },
  },
  [OrgUserRoles.CREATOR]: {
    include: {
      userList: true,
      userAdd: true,
      userUpdate: true,
      userDelete: true,
      generateResetUrl: true,
      userInviteResend: true,
      upload: true,
      uploadViaURL: true,
      baseCreate: true,
      duplicateSharedBase: true,
      integrationGet: true,
      integrationCreate: true,
      integrationDelete: true,
      integrationUpdate: true,
      integrationList: true,
    },
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

// validate include and exclude can't exist at the same time
Object.values(rolePermissions).forEach((role) => {
  if (role === '*') return;
  if (role.include && role.exclude) {
    throw new Error(
      `Role ${role} has both include and exclude permissions. Please remove one of them`,
    );
  }
});

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

  pageGet: 'view page details',
  pageList: 'view list of pages',
  pageSearch: 'search pages',
  pageParents: 'view parent pages',
  pageCreate: 'create a new page',
  pageUpdate: 'update a page',
  pageDelete: 'delete a page',
  pageGpt: 'use GPT to assist with pages',
  docsMagicCreatePages: 'use Docs Magic to create pages',
  pagePaginate: 'paginate pages',
  pageDirectoryImport: 'import a page directory',
  layoutGet: 'view layout details',
  layoutList: 'view list of layouts',
  layoutCreate: 'create a new layout',
  widgetsList: 'view list of widgets',
  widgetGet: 'view widget details',
  widgetCreate: 'create a new widget',
  widgetUpdate: 'update a widget',
  widgetDelete: 'delete a widget',
  widgetFilterList: 'view list of widget filters',
  widgetFilterCreate: 'create a new widget filter',

  userInvite: 'invite a user',

  jobList: 'view list of jobs',

  hookTrigger: 'trigger a webhook',
};

// Human-readable descriptions for roles
const roleDescriptions: Record<string, string> = {
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
