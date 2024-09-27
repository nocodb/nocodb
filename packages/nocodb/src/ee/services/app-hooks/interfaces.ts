import type {
  AppEventPayload as AppEventPayloadCE,
  NcBaseEvent,
} from 'src/services/app-hooks/interfaces';
import type { UserType, WorkspaceType, IntegrationType } from 'nocodb-sdk';
export interface WorkspaceInviteEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  user: UserType;
  invitedBy: UserType;
}

export interface WorkspaceEvent extends NcBaseEvent {
  workspace: WorkspaceType;
  user: UserType;
  ip?: string;
}

export type AppEventPayload =
  | AppEventPayloadCE
  | WorkspaceInviteEvent
  | WorkspaceEvent;

export interface IntegrationEvent extends NcBaseEvent {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

export * from 'src/services/app-hooks/interfaces';
