import { ProjectRole, Role } from '~/lib'

const rolePermissions = {
  // general role permissions

  /**
   * Each permission value means the following
   * `*` - which is wildcard, means all permissions are allowed
   *  `include` - which is an object, means only the permissions listed in the object are allowed
   *  `exclude` - which is an object, means all permissions are allowed except the ones listed in the object
   *  `undefined` or `{}` - which is the default value, means no permissions are allowed
   * */

  /** todo: enable wildcard permission
   *  limited permission  due to unexpected behaviour in shared base if opened in same window  */
  [Role.Super]: '*',
  [Role.Admin]: {} as Record<string, boolean>,
  [Role.Guest]: {} as Record<string, boolean>,
  [Role.User]: {
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
    },
  },
  [ProjectRole.Owner]: {
    exclude: {
      appStore: true,
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
      csvImport: true,
      apiDocs: true,
      projectSettings: true,
      newUser: false,
    },
  },
  [ProjectRole.Commenter]: {
    include: {
      smartSheet: true,
      column: true,
      rowComments: true,
      projectSettings: true,
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

type RolePermissions = Omit<typeof rolePermissions, 'guest' | 'admin' | 'super'>

type GetKeys<T> = T extends Record<any, Record<infer Key, boolean>> ? Key : never

export type Permission<K extends keyof RolePermissions = keyof RolePermissions> = RolePermissions[K] extends Record<any, any>
  ? GetKeys<RolePermissions[K]>
  : never

export default rolePermissions
