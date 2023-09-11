import { WorkspaceUserRoles } from 'nocodb-sdk'
import { ProjectRole, Role } from '../../lib/enums'

/**
 * Each permission value means the following
 * `*` - which is wildcard, means all permissions are allowed
 *  `include` - which is an object, means only the permissions listed in the object are allowed
 *  `exclude` - which is an object, means all permissions are allowed except the ones listed in the object
 *  `undefined` or `{}` - which is the default value, means no permissions are allowed
 * */
const rolePermissions = {
  // general role permissions

  [Role.Super]: '*',
  [Role.Admin]: {} as Record<string, boolean>,
  [Role.Guest]: {} as Record<string, boolean>,
  [Role.OrgLevelCreator]: {
    include: {
      projectCreate: true,
      projectActions: true,
      projectSettings: true,
    },
  },

  // Project role permissions
  [ProjectRole.Creator]: {
    exclude: {
      appStore: true,
      superAdminUserManagement: true,
      superAdminAppSettings: true,
      appLicense: true,
      moveProject: true,
      projectDelete: true,
      projectCreate: true,
    },
  },
  [ProjectRole.Owner]: {
    exclude: {
      appStore: true,
      superAdminUserManagement: true,
      superAdminAppSettings: true,
      appLicense: true,
      projectCreate: true,
    },
  },
  [ProjectRole.Editor]: {
    include: {
      smartSheet: true,
      xcDatatableEditable: true,
      column: true,
      tableAttachment: true,
      tableRowUpdate: true,
      dataInsert: true,
      rowComments: true,
      gridViewOptions: true,
      sortSync: true,
      fieldsSync: true,
      gridColUpdate: true,
      filterSync: true,
      filterChildrenRead: true,
      apiDocs: true,
      projectSettings: true,
      newUser: false,
      commentEditable: true,
      commentList: true,
      commentsCount: true,
      csvTableImport: true,
    },
  },
  [ProjectRole.Commenter]: {
    include: {
      smartSheet: true,
      column: true,
      rowComments: true,
      projectSettings: true,
      commentEditable: true,
      commentList: true,
      apiDocs: true,
      commentsCount: true,
    },
  },
  [ProjectRole.Viewer]: {
    include: {
      smartSheet: true,
      column: true,
      apiDocs: true,
      projectSettings: true,
    },
  },
} as const

// todo: fix type error
rolePermissions[WorkspaceUserRoles.OWNER] = rolePermissions[ProjectRole.Owner]
rolePermissions[WorkspaceUserRoles.CREATOR] = {
  exclude: {
    ...rolePermissions[ProjectRole.Creator].exclude,
    workspaceDelete: true,
  },
}
rolePermissions[WorkspaceUserRoles.VIEWER] = rolePermissions[ProjectRole.Viewer]
rolePermissions[WorkspaceUserRoles.EDITOR] = rolePermissions[ProjectRole.Editor]
rolePermissions[WorkspaceUserRoles.COMMENTER] = rolePermissions[ProjectRole.Commenter]

export { rolePermissions }

export * from '../../lib/constants'
