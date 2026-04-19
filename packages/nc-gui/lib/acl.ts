import { OrgUserRoles, ProjectRoles, SourceRestriction, WorkspaceUserRoles } from 'nocodb-sdk'

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
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
  [OrgUserRoles.CREATOR]: {
    include: {
      superAdminUserManagement: true,
      orgAdminPanel: true,
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      importRequest: true,
    },
  },

  // Workspace role permissions
  [WorkspaceUserRoles.OWNER]: {
    include: {
      workspaceSettings: true,
      workspaceAuditList: true,
      workspaceIntegrations: true,
      workspaceManage: true,
      baseDelete: true,
    },
  },
  [WorkspaceUserRoles.CREATOR]: {
    include: {
      baseCreate: true,
      baseMove: true,
      baseDuplicate: true,
      newUser: true,
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
      migrateBase: true,
      baseAuditList: true,
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
      tablePermission: true,
      tableSort: true,
      layoutRename: true,
      layoutDelete: true,
      airtableImport: true,
      jsonImport: true,
      excelImport: true,
      nocodbImport: true,
      settingsPage: true,
      webhook: true,
      fieldEdit: true,
      fieldAlter: true,
      fieldDelete: true,
      fieldAdd: true,
      tableIconEdit: true,
      baseShare: true,
      baseMiscSettings: true,
      csvImport: true,
      baseRename: true,
      baseDuplicate: true,
      sourceCreate: true,

      // Base-scoped integrations
      baseIntegrationCreate: true,

      projectOverviewTab: true,

      // Extensions
      extensionCreate: true,
      extensionDelete: true,

      // Documents — creators can create and delete documents
      documentCreate: true,
      documentDelete: true,
    },
  },
  [ProjectRoles.EDITOR]: {
    include: {
      dataInsert: true,
      dataEdit: true,
      viewFieldDataEdit:
        true /** For editor just show hidden field in expanded form, fields menu and will not allow to configure it */,
      filterChildrenList: true,
      csvTableImport: true,
      excelTableImport: true,
      hookTrigger: true,

      // Editors can directly edit view filters / sorts / group-by / field
      // visibility & order / row coloring on collaborative views (backend
      // grants this via the middleware gate now requiring
      // lock_type=Personal). `isLocked` in the smartsheet store still
      // blocks the write UI on locked + non-owned personal views,
      // falling back to the read-only list there.
      sortSync: true,
      filterSync: true,
      groupBySync: true,
      viewFieldEdit: true,
      rowColourUpdate: true,

      // View operations (toolbar, aggregation footer, column reorder, column resize, etc.) will be restricted to below editor roles
      viewOperations: true,
      sortList: true,
      filterList: true,

      // View CRUD — editors can create/update/delete views.
      // Locked views and others' personal views are restricted at a finer
      // level via usePersonalViewPermissions + backend guards.
      viewCreateOrEdit: true,

      // Share — editors can create/update share links on collaborative
      // views they have access to. Matches Airtable behaviour.
      viewShare: true,

      // Extensions
      extensionUpdate: true,

      // Documents — editors can update and reorder, but NOT create/delete
      documentUpdate: true,
      documentReorder: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentDelete: true,
      commentResolve: true,
      commentEdit: true,

      // Document Comments — commenters can create/update/delete/resolve + reactions
      documentCommentCreate: true,
      documentCommentUpdate: true,
      documentCommentDelete: true,
      documentCommentResolve: true,
      documentCommentReactionToggle: true,
    },
  },
  [ProjectRoles.VIEWER]: {
    include: {
      baseSettings: true,
      expandedForm: true,
      apiDocs: true,

      commentList: true,
      commentCount: true,
      recordAuditList: true,
      newUser: true,
      manageMCP: true,

      // Extensions
      extensionList: true,

      // Documents — read-only for viewers
      documentList: true,
      documentGet: true,

      // Document Comments — read-only for viewers
      documentCommentList: true,
      documentCommentCount: true,
      documentCommentReactionList: true,
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
    nocodbImport: true,
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
    nocodbImport: true,
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

// Collapse org roles — VIEWER gets same as CREATOR (EE pattern)
rolePermissions[OrgUserRoles.VIEWER] = rolePermissions[OrgUserRoles.CREATOR]

export { rolePermissions }
