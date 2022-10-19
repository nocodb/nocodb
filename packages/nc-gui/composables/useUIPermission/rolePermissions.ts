import { ProjectRole, Role } from '~/lib'

const rolePermissions = {
  // general role permissions
  /** todo: enable wildcard permission
   *  limited permission  due to unexpected behaviour in shared base if opened in same window  */
  [Role.Super]: {
    projectTheme: true,
  },
  [Role.Admin]: {},
  [Role.Guest]: {},
  [Role.User]: {
    projectCreate: true,
    projectActions: true,
    projectSettings: true,
  },

  // Project role permissions
  [ProjectRole.Creator]: '*',
  [ProjectRole.Owner]: '*',
  [ProjectRole.Editor]: {
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
  [ProjectRole.Commenter]: {
    smartSheet: true,
    column: true,
    rowComments: true,
    projectSettings: true,
    filterSync: true,
  },
  [ProjectRole.Viewer]: {
    smartSheet: true,
    column: true,
    projectSettings: true,
    filterSync: true,
  },
} as const

type RolePermissions = Omit<typeof rolePermissions, 'creator' | 'owner' | 'guest' | 'admin'>

type GetKeys<T> = T extends Record<string, any> ? keyof T : never

export type Permission<K extends keyof RolePermissions = keyof RolePermissions> = RolePermissions[K] extends Record<string, any>
  ? GetKeys<RolePermissions[K]>
  : never

export default rolePermissions
