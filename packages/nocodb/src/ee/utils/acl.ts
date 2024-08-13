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
    'auditRowUpdate',
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

    'pageGet',
    'pageList',
    'pageSearch',
    'pageParents',
    'pageCreate',
    'pageUpdate',
    'pageDelete',
    'pageGpt',
    'docsMagicCreatePages',
    'pagePaginate',
    'pageDirectoryImport',
    'layoutGet',
    'layoutList',
    'layoutCreate',
    'widgetsList',
    'widgetGet',
    'widgetCreate',
    'widgetUpdate',
    'widgetDelete',
    'widgetFilterList',
    'widgetFilterCreate',

    'jobList',
    // it's an extended scoped permission which is prefixed with the main scope
    'workspace_integrationList',

    // Webhooks
    'hookTrigger',
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
    },
  },
  [WorkspaceUserRoles.OWNER]: {
    exclude: {},
  },

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

      // Docs
      pageGet: true,
      pageList: true,
      pageSearch: true,
      pageParents: true,
      pagePaginate: true,

      // dashboards
      layoutGet: true,
      layoutList: true,
      widgetsList: true,
      widgetGet: true,
      widgetFilterList: true,

      baseUserList: true,

      jobList: true,
      commentList: true,
      commentsCount: true,
      auditListRow: true,
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
      auditRowUpdate: true,
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

      // Webhooks
      hookTrigger: true,

      // TODO implement this
      // upload: true,
      // uploadViaURL: true,

      // TODO remove these permissions
      // Docs
      pageCreate: true,
      pageUpdate: true,
      pageDelete: true,
      pageGpt: true,
      docsMagicCreatePages: true,
      pageDirectoryImport: true,

      // dashboards
      layoutCreate: true,
      widgetCreate: true,
      widgetUpdate: true,
      widgetDelete: true,
      widgetFilterCreate: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    exclude: {
      createBase: true,
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
