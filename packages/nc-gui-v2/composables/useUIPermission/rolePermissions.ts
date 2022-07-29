const rolePermissions = {
  creator: '*',
  owner: '*',
  guest: {},
  editor: {
    smartSheet: true,
    xcDatatableEditable: true,
    column: true,
    tableAttachment: true,
    tableRowUpdate: true,
    rowComments: true,
    gridViewOptions: true,
    sortSync: true,
    fieldsSync: true,
    gridColUpdate: true,
    filterSync: true,
    csvImport: true,
    apiDocs: true,
    projectSettings: true,
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

export default rolePermissions

type GetKeys<T> = T extends Record<string, any> ? keyof T : never

export type RolePermissions<T extends typeof rolePermissions = typeof rolePermissions, K extends keyof T = keyof T> =
  | T[K] extends string
  ? T[K]
  : never & T[K] extends Record<string, any>
  ? GetKeys<T[K]>
  : never
