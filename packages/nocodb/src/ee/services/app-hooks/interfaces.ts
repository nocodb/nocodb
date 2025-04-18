import type { Optional } from 'src/services/app-hooks/interfaces';
import type {
  AppEventPayload as AppEventPayloadCE,
  NcBaseEvent,
} from 'src/services/app-hooks/interfaces';
import type {
  BaseType,
  IntegrationType,
  PlanFeatureTypes,
  PlanLimitTypes,
  UserType,
  WorkspaceType,
} from 'nocodb-sdk';
import type Snapshot from '~/models/Snapshot';

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

export * from 'src/services/app-hooks/interfaces';
