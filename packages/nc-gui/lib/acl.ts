import { OrgUserRoles, ProjectRoles, SourceRestriction } from 'nocodb-sdk'

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
  base: [
    ProjectRoles.NO_ACCESS,
    ProjectRoles.VIEWER,
    ProjectRoles.COMMENTER,
    ProjectRoles.EDITOR,
    ProjectRoles.CREATOR,
    ProjectRoles.OWNER,
  ],
}

interface Perm {
  include?: Record<string, boolean>
}

/**
 * Each permission value means the following
 * `*` - which is wildcard, means all permissions are allowed
 *  `include` - which is an object, means only the permissions listed in the object are allowed
 *  `undefined` or `{}` - which is the default value, means no permissions are allowed
 * */
const rolePermissions = {
  // org level role permissions
  [OrgUserRoles.SUPER_ADMIN]: '*',
  [OrgUserRoles.CREATOR]: {
    include: {
      workspaceSettings: true,
      superAdminUserManagement: true,
      baseCreate: true,
      baseMove: true,
      baseDelete: true,
      baseDuplicate: true,
      newUser: true,
      tableRename: true,
      tableDelete: true,
      viewCreateOrEdit: true,
      baseReorder: true,
      orgAdminPanel: true,
      workspaceAuditList: true,
      workspaceIntegrations: true,
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      importRequest: true,
    },
  },

  // Base role permissions
  [ProjectRoles.OWNER]: {
    include: {
      baseDelete: true,
      manageSnapshot: true,
      migrateBase: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    include: {
      baseCreate: true,
      fieldUpdate: true,
      hookList: true,
      hookCreate: true,
      tableCreate: true,
      tableRename: true,
      tableDelete: true,
      tableDescriptionEdit: true,
      tableDuplicate: true,
      tableSort: true,
      layoutRename: true,
      layoutDelete: true,
      airtableImport: true,
      jsonImport: true,
      excelImport: true,
      settingsPage: true,
      webhook: true,
      fieldEdit: true,
      fieldAlter: true,
      fieldDelete: true,
      fieldAdd: true,
      tableIconEdit: true,
      viewCreateOrEdit: true,
      viewShare: true,
      baseShare: true,
      baseMiscSettings: true,
      csvImport: true,
      baseRename: true,
      baseDuplicate: true,
      sourceCreate: true,
      baseAuditList: true,

      extensionList: true,
    },
  },
  [ProjectRoles.EDITOR]: {
    include: {
      dataInsert: true,
      dataEdit: true,
      sortSync: true,
      filterSync: true,
      filterChildrenRead: true,
      viewFieldEdit: true,
      csvTableImport: true,
      excelTableImport: true,
      hookTrigger: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentDelete: true,
      commentResolve: true,
      commentEdit: true,
    },
  },
  [ProjectRoles.VIEWER]: {
    include: {
      baseSettings: true,
      expandedForm: true,
      apiDocs: true,

      commentList: true,
      commentCount: true,
      auditListRow: true,
      newUser: true,
    },
  },
  [ProjectRoles.NO_ACCESS]: {
    include: {},
  },
} as Record<OrgUserRoles | ProjectRoles, Perm | '*'>

// excluded/restricted permissions at source level based on source restriction
// `true` means permission is restricted and `false`/missing means permission is allowed
export const sourceRestrictions = {
  [SourceRestriction.DATA_READONLY]: {
    dataInsert: true,
    dataEdit: true,
    dataDelete: true,
    airtableImport: true,
    csvImport: true,
    jsonImport: true,
    excelImport: true,
    duplicateColumn: true,
    duplicateModel: true,
    tableDuplicate: true,
  },
  [SourceRestriction.SCHEMA_READONLY]: {
    tableCreate: true,
    tableRename: true,
    tableDelete: true,
    tableDuplicate: true,
    airtableImport: true,
    csvImport: true,
    jsonImport: true,
    excelImport: true,
    duplicateColumn: true,
    duplicateModel: true,
  },
}

/*
  We inherit include permissions from previous roles in the same scope (role order)
  To determine role order, we use `roleScopes` object

  So for example ProjectRoles.COMMENTER has `commentEdit` permission,
    which means ProjectRoles.EDITOR, ProjectRoles.CREATOR, ProjectRoles.OWNER will also have `commentEdit` permission
    where as ProjectRoles.VIEWER, ProjectRoles.NO_ACCESS will not have `commentEdit` permission.

  This is why we are validating that there are no duplicate permissions within the same scope
    even though it is not required for the code to work. It is to keep the code clean and easy to understand.
*/

// validate no duplicate permissions within same scope
Object.values(roleScopes).forEach((roles) => {
  const scopePermissions: Record<string, boolean> = {}
  const duplicates: string[] = []
  roles.forEach((role) => {
    const perms = (rolePermissions[role] as Perm).include || {}
    Object.keys(perms).forEach((perm) => {
      if (scopePermissions[perm]) {
        duplicates.push(perm)
      }
      scopePermissions[perm] = true
    })
  })
  if (duplicates.length) {
    throw new Error(
      `Duplicate permissions found in roles ${roles.join(', ')}. Please remove duplicate permissions: ${duplicates.join(', ')}`,
    )
  }
})

// inherit include permissions within scope (role order)
Object.values(roleScopes).forEach((roles) => {
  let roleIndex = 0
  for (const role of roles) {
    if (roleIndex === 0) {
      roleIndex++
      continue
    }

    if (rolePermissions[role] === '*') continue
    if ((rolePermissions[role] as Perm).include && (rolePermissions[roles[roleIndex - 1]] as Perm).include) {
      Object.assign((rolePermissions[role] as Perm).include!, (rolePermissions[roles[roleIndex - 1]] as Perm).include)
    }

    roleIndex++
  }
})

export { rolePermissions }
