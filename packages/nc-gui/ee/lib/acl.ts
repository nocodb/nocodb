import { CloudOrgUserRoles, OrgUserRoles, ProjectRoles, SourceRestriction, WorkspaceUserRoles } from 'nocodb-sdk'

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
  cloudOrg: [CloudOrgUserRoles.VIEWER, CloudOrgUserRoles.CREATOR, CloudOrgUserRoles.OWNER],
  workspace: [
    WorkspaceUserRoles.NO_ACCESS,
    WorkspaceUserRoles.VIEWER,
    WorkspaceUserRoles.COMMENTER,
    WorkspaceUserRoles.EDITOR,
    WorkspaceUserRoles.CREATOR,
    WorkspaceUserRoles.OWNER,
  ],
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
  [CloudOrgUserRoles.OWNER]: {
    include: {
      adminPanel: true,
      orgAdminPanel: true,
      globalAudits: true,
    },
  },
  [OrgUserRoles.CREATOR]: {
    include: {},
  },
  [CloudOrgUserRoles.CREATOR]: {
    include: {
      orgDomainList: true,
      orgDomainAdd: true,
      orgDomainVerify: true,
      orgDomainUpdate: true,
      orgDomainDelete: true,
    },
  },
  [CloudOrgUserRoles.VIEWER]: {
    include: {
      importRequest: true,
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      importRequest: true,
    },
  },

  [WorkspaceUserRoles.OWNER]: {
    include: {
      workspaceBilling: true,
      workspaceManage: true,
      baseDelete: true,
      orgDomainList: true,
      orgDomainAdd: true,
      orgDomainVerify: true,
      orgDomainUpdate: true,
      orgDomainDelete: true,
      transferWorkspaceOwnership: true,

      orgSsoClientList: true,
      orgSsoClientCreate: true,
      orgSsoClientUpdate: true,
      orgSsoClientDelete: true,

      workspaceSsoClientList: true,
      workspaceSsoClientCreate: true,
      workspaceSsoClientUpdate: true,
      workspaceSsoClientDelete: true,

      // todo: temporary permission
      moveWorkspaceToOrg: true,
      createConnectionDetails: true,
      workspaceAuditList: true,
    },
  },
  [WorkspaceUserRoles.CREATOR]: {
    include: {
      baseCreate: true,
      baseDuplicate: true,
      workspaceSettings: true,
      tableCreate: true,
      tableRename: true,
      tableDelete: true,
      viewCreateOrEdit: true,
      baseReorder: true,
      airtableImport: true,
      jsonImport: true,
      excelImport: true,
      workspaceIntegrations: true,
    },
  },
  [WorkspaceUserRoles.EDITOR]: {
    include: {},
  },
  [WorkspaceUserRoles.COMMENTER]: {
    include: {},
  },
  [WorkspaceUserRoles.VIEWER]: {
    include: {
      workspaceCollaborators: true,
    },
  },
  [WorkspaceUserRoles.NO_ACCESS]: {
    include: {},
  },

  // Base role permissions
  [ProjectRoles.OWNER]: {
    include: {
      baseDelete: true,
      manageSnapshot: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    include: {
      fieldUpdate: true,
      hookList: true,
      hookCreate: true,
      tableCreate: true,
      tableRename: true,
      tableDelete: true,
      tableDescriptionEdit: true,
      tableDuplicate: true,
      tableSort: true,
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
      reAssignViewOwner: true,

      extensionList: true,
      // Scripts
      scriptCreateOrEdit: true,
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

      // Scripts
      scriptExecute: true,
      scriptList: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentEdit: true,
      commentDelete: true,
      commentResolve: true,
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
} as Record<OrgUserRoles | WorkspaceUserRoles | ProjectRoles, Perm | '*'>

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
