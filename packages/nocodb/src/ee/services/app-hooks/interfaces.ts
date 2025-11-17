import type { Optional } from 'src/services/app-hooks/interfaces';
import type {
  AppEventPayload as AppEventPayloadCE,
  NcBaseEvent,
} from 'src/services/app-hooks/interfaces';
import type {
  BaseType,
  DashboardType,
  IntegrationType,
  PlanFeatureTypes,
  PlanLimitTypes,
  ScriptType,
  UserType,
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

export * from 'src/services/app-hooks/interfaces';
