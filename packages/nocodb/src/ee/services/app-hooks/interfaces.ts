import type { Optional } from 'src/services/app-hooks/interfaces';
import type {
  AppEventPayload as AppEventPayloadCE,
  NcBaseEvent,
} from 'src/services/app-hooks/interfaces';
import type { IntegrationType, UserType, WorkspaceType } from 'nocodb-sdk';

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

export * from 'src/services/app-hooks/interfaces';
