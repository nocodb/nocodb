import { ProjectRole, Role } from './enums'

export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const BASE_URL =
  process.env.NC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:8080' : 'http://localhost:8080')

export const rolePermissions = {
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
  },
  [ProjectRole.Viewer]: {
    smartSheet: true,
    column: true,
    projectSettings: true,
  },
} as const
