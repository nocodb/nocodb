import { ProjectRole, Role } from './enums'

export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const EMPTY_TITLE_PLACEHOLDER_DOCS = 'Untitled'

export const BASE_FALLBACK_URL = process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080'

export const GROUP_BY_VARS = {
  NULL: '__nc_null__',
  TRUE: '__nc_true__',
  FALSE: '__nc_false__',
  VAR_TITLES: {
    __nc_null__: 'Empty',
    __nc_true__: 'Checked',
    __nc_false__: 'Unchecked',
  } as Record<string, string>,
}
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
      projectCreate: true,
      appStore: true,
      superAdminUserManagement: true,
      superAdminAppSettings: true,
      appLicense: true,
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
      csvImport: true,
      apiDocs: true,
      projectSettings: true,
      newUser: false,
      commentEditable: true,
      commentList: true,
      commentsCount: true,
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
      commentsCount: true,
    },
  },
  [ProjectRole.Viewer]: {
    include: {
      smartSheet: true,
      column: true,
      projectSettings: true,
    },
  },
} as const

export { rolePermissions }
