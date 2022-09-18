const rolePermissions = {
  /** todo: enable wildcard permission
   *  limited permission  due to unexpected behaviour in shared base if opened in same window  */
  super: {
    projectTheme: true,
  },
  creator: '*',
  owner: '*',
  guest: {},
  editor: {
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
  commenter: {
    smartSheet: true,
    column: true,
    rowComments: true,
    projectSettings: true,
  },
  viewer: {
    smartSheet: true,
    column: true,
    projectSettings: true,
  },
  user: {
    projectCreate: true,
    projectActions: true,
    projectSettings: true,
  },
} as const

type GetKeys<T> = T extends Record<string, boolean> ? keyof T : never

export type Permission<T extends typeof rolePermissions = typeof rolePermissions, K extends keyof T = keyof T> =
  | (K extends 'creator' | 'owner' ? T[K] : never | T[K] extends Record<string, boolean> ? GetKeys<T[K]> : never)
  | string

export default rolePermissions
