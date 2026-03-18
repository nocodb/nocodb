import { OPERATION_SCOPES as OPERATION_SCOPES_CE } from 'src/controllers/internal/operationScopes';
export const OPERATION_SCOPES = {
  ...OPERATION_SCOPES_CE,

  // API tokens (fine-grained)
  apiTokenListWithScopes: 'org',
  apiTokenCreateWithScopes: 'org',
  apiTokenUpdateWithScopes: 'org',

  createDataReflection: 'workspace',
  getDataReflection: 'workspace',
  deleteDataReflection: 'workspace',
  refreshDataReflection: 'workspace',
  listenRemoteImport: 'workspace',
  createSync: 'base',
  triggerSync: 'base',
  migrateSync: 'base',
  addChildSync: 'base',
  authIntegrationTestConnection: 'workspace',
  baseAuthIntegrationTestConnection: 'base',
  syncIntegrationFetchOptions: 'base',
  integrationFetchOptions: 'workspace',
  listScripts: 'base',
  getScript: 'base',
  createScript: 'base',
  updateScript: 'base',
  deleteScript: 'base',
  baseSchema: 'base',
  workspaceAuditList: 'workspace',
  baseAuditList: 'base',
  duplicateScript: 'base',
  setPermission: 'base',
  dropPermission: 'base',
  bulkDropPermissions: 'base',

  dashboardList: 'base',
  dashboardGet: 'base',
  dashboardCreate: 'base',
  dashboardUpdate: 'base',
  dashboardDelete: 'base',
  widgetList: 'base',
  widgetGet: 'base',
  widgetCreate: 'base',
  widgetUpdate: 'base',
  widgetDelete: 'base',
  widgetDuplicate: 'base',
  widgetDataGet: 'base',
  dashboardShare: 'base',
  triggerAction: 'base',
  sendEmail: 'base',
  integrationRemoteFetch: 'base',

  // Teams operations
  teamList: 'workspace',
  teamTree: 'workspace',
  teamCreate: 'workspace',
  teamGet: 'workspace',
  teamUpdate: 'workspace',
  teamDelete: 'workspace',
  teamMove: 'workspace',

  teamMembersAdd: 'workspace',
  teamMembersRemove: 'workspace',
  teamMembersUpdate: 'workspace',

  // Workspace-Team operations
  workspaceTeamList: 'workspace',
  workspaceTeamAdd: 'workspace',
  workspaceTeamGet: 'workspace',
  workspaceTeamUpdate: 'workspace',
  workspaceTeamRemove: 'workspace',

  // Base-Team operations
  baseTeamList: 'base',
  baseTeamAdd: 'base',
  baseTeamGet: 'base',
  baseTeamUpdate: 'base',
  baseTeamRemove: 'base',

  // User Profile
  getUserProfile: 'org',

  // Templates
  templates: 'ncSkipAcl',
  template: 'ncSkipAcl',

  // Workflow operations
  workflowList: 'base',
  workflowGet: 'base',
  workflowCreate: 'base',
  workflowDuplicate: 'base',
  workflowUpdate: 'base',
  workflowDelete: 'base',
  workflowNodeIntegrationFetchOptions: 'base',
  workflowExecute: 'base',
  workflowTestNode: 'base',
  workflowPublish: 'base',
  workflowNodes: 'base',
  workflowListSubscribers: 'base',
  workflowAddSubscribers: 'base',
  workflowRemoveSubscriber: 'base',

  workflowExecutionList: 'base',
  workflowExecutionGet: 'base',
  // Hook subscriber operations
  hookListSubscribers: 'base',
  hookAddSubscribers: 'base',
  hookRemoveSubscriber: 'base',

  // Send Record Email
  sendRecordEmail: 'base',

  // Sandbox operations
  sandboxList: 'base',
  sandboxGet: 'base',
  sandboxCreate: 'base',
  sandboxDiscard: 'base',
  sandboxDelete: 'base',
  sandboxMerge: 'base',
  sandboxDiff: 'base',

  // RLS (Row-Level Security) operations
  rlsPolicyList: 'base',
  rlsPolicyGet: 'base',
  rlsPolicyCreate: 'base',
  rlsPolicyUpdate: 'base',
  rlsPolicyDelete: 'base',
  rlsPolicySetSubjects: 'base',
  rlsPolicyFilterList: 'base',
  rlsPolicyFilterCreate: 'base',

  // Documents (EE-only)
  documentList: 'base',
  documentListAll: 'base',
  documentGet: 'base',
  documentCreate: 'base',
  documentUpdate: 'base',
  documentDelete: 'base',
  documentReorder: 'base',

  // Document Comments (EE-only)
  documentCommentList: 'base',
  documentCommentCount: 'base',
  documentCommentCreate: 'base',
  documentCommentUpdate: 'base',
  documentCommentDelete: 'base',
  documentCommentResolve: 'base',
  documentCommentReactionToggle: 'base',
  documentCommentReactionList: 'base',

  // View Sections operations
  viewSectionList: 'base',
  viewSectionCreate: 'base',
  viewSectionUpdate: 'base',
  viewSectionDelete: 'base',

  // AI Data operations
  aiDataGenerateRows: 'base',
  aiDataFillRows: 'base',
  aiDataExtractRows: 'base',

  // Date Dependency
  getDateDependency: 'base',
  updateDateDependency: 'base',
  deleteTableDateDependency: 'base',

  // Record Trash (EE only)
  recordTrashEvents: 'base',
  recordTrashCount: 'base',
  recordTrashRestore: 'base',
  recordTrashPermanentDelete: 'base',
  recordTrashEmpty: 'base',
  recordTrashSettingsList: 'base',
  recordTrashSettingsUpdate: 'base',

  // MFA operations
  mfaSetup: 'org',
  mfaVerifySetup: 'org',
  mfaVerify: 'ncSkipAcl',
  mfaDisable: 'org',
  mfaStatus: 'org',
  mfaRegenerateBackupCodes: 'org',
} as const;
