import type { Optional } from 'src/services/app-hooks/interfaces';
import type {
  AppEventPayload as AppEventPayloadCE,
  NcBaseEvent,
} from 'src/services/app-hooks/interfaces';
import type {
  BaseType,
  DashboardType,
  DocumentType,
  IntegrationType,
  OrgType,
  PlanFeatureTypes,
  PlanLimitTypes,
  ScriptType,
  UserType,
  ViewSectionType,
  WidgetType,
  WorkflowType,
  WorkspaceType,
} from 'nocodb-sdk';
import type Snapshot from '~/models/Snapshot';
import type { CustomUrl, Permission } from '~/models';
import type { Team } from '~/models';

export interface WorkspaceUserInviteEvent
  extends Optional<NcBaseEvent, 'context'> {
  workspace: WorkspaceType;
  user: UserType;
  invitedBy: UserType;
  roles: string;
}

export interface WorkspaceUserUpdateEvent
  extends Optional<NcBaseEvent, 'context'> {
  workspace: WorkspaceType;
  user: UserType;
  oldWorkspaceUser: any;
  workspaceUser: any;
}

export interface WorkspaceUserDeleteEvent
  extends Optional<NcBaseEvent, 'context'> {
  workspace: WorkspaceType;
  workspaceUser: any;
  user: UserType;
}

export interface ScimUserEvent extends Optional<NcBaseEvent, 'context'> {
  org: OrgType;
  user: UserType;
  orgUser: any;
  scimId: string;
}

export interface ScimGroupEvent extends Optional<NcBaseEvent, 'context'> {
  org: OrgType;
  team: any;
  scimId: string;
}

export interface WorkspaceEvent extends Optional<NcBaseEvent, 'context'> {
  workspace: WorkspaceType;
  ip?: string;
}

export interface WorkspaceUpdateEvent extends WorkspaceEvent {
  oldWorkspace: WorkspaceType;
}

export type AppEventPayload =
  | AppEventPayloadCE
  | WorkspaceUserInviteEvent
  | WorkspaceEvent;

export interface IntegrationEvent extends Optional<NcBaseEvent, 'context'> {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

export interface IntegrationUpdateEvent extends IntegrationEvent {
  oldIntegration: IntegrationType;
}

export interface SnapshotEvent extends NcBaseEvent {
  snapshot: Snapshot;
  base: BaseType;
}

export interface SnapshotDeleteEvent extends NcBaseEvent {
  snapshot: Snapshot;
  base: BaseType;
}

export interface SnapshotRestoreEvent extends NcBaseEvent {
  snapshot: Snapshot;
  targetBase: BaseType;
  sourceBase: BaseType;
}

export interface WorkspaceRequestUpgradeEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  user: UserType;
  requester: {
    email?: string;
    display_name?: string;
  };
  limitOrFeature: PlanLimitTypes | PlanFeatureTypes;
}

export interface ScriptCreateEvent extends NcBaseEvent {
  script: ScriptType;
  user: UserType;
}

export interface ScriptUpdateEvent extends NcBaseEvent {
  script: ScriptType;
  user: UserType;
  oldScript: ScriptType;
}

export interface ScriptDeleteEvent extends NcBaseEvent {
  script: ScriptType;
  user: UserType;
}

export interface ScriptDuplicateEvent extends NcBaseEvent {
  error?: string;
  sourceScript: ScriptType;
  destScript: ScriptType;
  user: UserType;
}

export interface WorkflowCreateEvent extends NcBaseEvent {
  workflow: WorkflowType;
  user: UserType;
}

export interface WorkflowUpdateEvent extends NcBaseEvent {
  workflow: WorkflowType;
  user: UserType;
  oldWorkflow: WorkflowType;
}

export interface WorkflowDeleteEvent extends NcBaseEvent {
  workflow: WorkflowType;
  user: UserType;
}

export interface WorkflowExecuteEvent extends NcBaseEvent {
  workflow: WorkflowType;
  user?: UserType;
}

export interface WorkflowDuplicateEvent extends NcBaseEvent {
  error?: string;
  sourceWorkflow: WorkflowType;
  destWorkflow: WorkflowType;
  user: UserType;
}

export interface DashboardCreateEvent extends NcBaseEvent {
  dashboard: DashboardType;
  user: UserType;
}

export interface DashboardUpdateEvent extends NcBaseEvent {
  dashboard: DashboardType;
  user: UserType;
  oldDashboard: DashboardType;
}

export interface DashboardDeleteEvent extends NcBaseEvent {
  dashboard: DashboardType;
  user: UserType;
}

export interface DashboardDuplicateEvent extends NcBaseEvent {
  error?: string;
  sourceDashboard: DashboardType;
  destDashboard?: DashboardType;
  user: UserType;
  id?: string;
}

export interface WidgetCreateEvent extends NcBaseEvent {
  widget: WidgetType;
  user: UserType;
}

export interface WidgetUpdateEvent extends NcBaseEvent {
  widget: WidgetType;
  user: UserType;
  oldWidget: WidgetType;
}

export interface WidgetDeleteEvent extends NcBaseEvent {
  widget: WidgetType;
  user: UserType;
}

export interface WidgetDuplicateEvent extends NcBaseEvent {
  error?: string;
  sourceWidget: WidgetType;
  destWidget: WidgetType;
  user: UserType;
}

export interface ViewSectionCreateEvent extends NcBaseEvent {
  viewSection: ViewSectionType;
  user: UserType;
}

export interface ViewSectionUpdateEvent extends NcBaseEvent {
  viewSection: ViewSectionType;
  user: UserType;
}

export interface ViewSectionDeleteEvent extends NcBaseEvent {
  viewSection: ViewSectionType;
  user: UserType;
}

export interface SharedDashboardEvent extends NcBaseEvent {
  dashboard: DashboardType;
  link?: string;
  uuid?: string;
  customUrl?: CustomUrl;
}

export interface PermissionCreateEvent extends NcBaseEvent {
  permission: Permission;
  user: UserType;
}

export interface PermissionUpdateEvent extends NcBaseEvent {
  permission: Permission;
  oldPermission: Permission;
  user: UserType;
}

export interface PermissionDeleteEvent extends NcBaseEvent {
  permission: Permission;
  user: UserType;
}

// Team Events
export interface TeamCreateEvent extends NcBaseEvent {
  team: Team;
  workspace?: WorkspaceType;
  base?: BaseType;
}

export interface TeamUpdateEvent extends NcBaseEvent {
  team: Team;
  oldTeam: Team;
  workspace?: WorkspaceType;
  base?: BaseType;
}

export interface TeamDeleteEvent extends NcBaseEvent {
  team: Team;
  workspace?: WorkspaceType;
  base?: BaseType;
}

export interface TeamMoveEvent extends NcBaseEvent {
  team: Team;
  oldParentTeam?: Team | null;
  newParentTeam?: Team | null;
  workspace?: WorkspaceType;
}

export interface TeamMemberAddEvent extends NcBaseEvent {
  team: Team;
  user: UserType;
  teamRole: string;
  workspace?: WorkspaceType;
  base?: BaseType;
}

export interface TeamMemberUpdateEvent extends NcBaseEvent {
  team: Team;
  user: UserType;
  oldTeamRole: string;
  teamRole: string;
  workspace?: WorkspaceType;
  base?: BaseType;
}

export interface TeamMemberDeleteEvent extends NcBaseEvent {
  team: Team;
  user: UserType;
  teamRole: string;
  workspace?: WorkspaceType;
  base?: BaseType;
}

// Workspace Team Events
export interface WorkspaceTeamInviteEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  team: Team;
  role: string;
}

export interface WorkspaceTeamUpdateEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  team: Team;
  oldRole: string;
  role: string;
}

export interface WorkspaceTeamDeleteEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  team: Team;
  role: string;
}

// Base Team Events
export interface BaseTeamInviteEvent extends NcBaseEvent {
  base: BaseType;
  team: Team;
  role: string;
}

export interface BaseTeamUpdateEvent extends NcBaseEvent {
  base: BaseType;
  team: Team;
  oldRole: string;
  role: string;
}

export interface BaseTeamDeleteEvent extends NcBaseEvent {
  base: BaseType;
  team: Team;
  role: string;
}

export interface SandboxCreateEvent extends NcBaseEvent {
  sandboxId: string;
  baseId: string;
}

export interface SandboxDeleteEvent extends NcBaseEvent {
  sandboxId: string;
  baseId: string;
}

export interface SandboxDiscardEvent extends NcBaseEvent {
  sandboxId: string;
  baseId: string;
}

export interface SandboxMergeEvent extends NcBaseEvent {
  sandboxId: string;
  baseId: string;
  masterBaseId: string;
}

// Record Template Events
export interface RecordTemplateCreateEvent extends NcBaseEvent {
  template: { id?: string; title?: string; fk_model_id?: string };
}

export interface RecordTemplateUpdateEvent extends NcBaseEvent {
  template: { id?: string; title?: string; fk_model_id?: string };
}

export interface RecordTemplateDeleteEvent extends NcBaseEvent {
  template: { id?: string; title?: string; fk_model_id?: string };
}

export interface RecordTemplateUseEvent extends NcBaseEvent {
  template: {
    id?: string;
    title?: string;
    fk_model_id?: string;
    usage_count?: number;
  };
}

// RLS Events
export interface RlsPolicyCreateEvent extends NcBaseEvent {
  userId: string;
  policyId: string;
  policyTitle: string;
  tableId: string;
}

export interface RlsPolicyUpdateEvent extends NcBaseEvent {
  userId: string;
  policyId: string;
  policyTitle: string;
}

export interface RlsPolicyDeleteEvent extends NcBaseEvent {
  userId: string;
  policyId: string;
  tableId: string;
}

// Chat Events
export interface ChatSessionCreateEvent extends NcBaseEvent {
  sessionId: string;
}

export interface ChatSessionUpdateEvent extends NcBaseEvent {
  sessionId: string;
}

export interface ChatSessionDeleteEvent extends NcBaseEvent {
  sessionId: string;
}

// Doc AI Events
export interface DocAiCompletionEvent extends NcBaseEvent {
  operation: 'write' | 'continue' | 'improve' | 'summarize' | 'translate';
}

export interface DocumentCreateEvent extends NcBaseEvent {
  doc: DocumentType;
  user: UserType;
}

export interface DocumentUpdateEvent extends NcBaseEvent {
  doc: DocumentType;
  user: UserType;
}

export interface DocumentDeleteEvent extends NcBaseEvent {
  doc: DocumentType;
  user: UserType;
}

export interface DocumentUserMentionEvent extends NcBaseEvent {
  doc: DocumentType;
  user: UserType;
  mentions: string[];
}

export interface DocumentCommentCreateEvent extends NcBaseEvent {
  comment: Record<string, any>;
  user: UserType;
  docId: string;
}

export interface DocumentCommentUpdateEvent extends NcBaseEvent {
  comment: Record<string, any>;
  user: UserType;
  docId: string;
}

export interface DocumentCommentDeleteEvent extends NcBaseEvent {
  comment: Record<string, any>;
  user: UserType;
  docId: string;
}

// Date Dependency Events
export interface DateDependencyUpdateEvent extends NcBaseEvent {
  table: { id?: string; title?: string; base_id?: string };
  dateDependency: {
    id?: string;
    fk_start_date_field_id?: string;
    fk_end_date_field_id?: string;
    fk_duration_field_id?: string;
    fk_dependency_linkrow_field_id?: string;
    dependency_linkrow_role?: string;
    dependency_connection_type?: string;
    dependency_buffer_type?: string;
    dependency_buffer_days?: number;
    include_weekends?: boolean;
    is_active?: boolean;
  };
  isNew: boolean;
}

export interface DateDependencyDeleteEvent extends NcBaseEvent {
  table: { id?: string; title?: string; base_id?: string };
}

// Org Domain Events
export interface OrgDomainEvent {
  orgId: string;
  domainName?: string;
  domainId?: string;
  req?: any;
}

// SSO Client Events
export interface SsoClientEvent {
  orgId: string;
  title?: string;
  clientId?: string;
  req?: any;
}

// SCIM Config Events
export interface ScimConfigEvent {
  orgId: string;
  req?: any;
}

// Record Trash Events
export interface RecordsSoftDeleteEvent extends NcBaseEvent {
  tableId: string;
  rowIds: string[];
}

export interface RecordsRestoreEvent extends NcBaseEvent {
  tableId: string;
  rowIds: string[];
}

export interface RecordsPermanentDeleteEvent extends NcBaseEvent {
  tableId: string;
  rowIds: string[];
}

export * from 'src/services/app-hooks/interfaces';
