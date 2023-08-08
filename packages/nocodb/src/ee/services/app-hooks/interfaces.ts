import type { AppEventPayload as AppEventPayloadCE } from 'src/services/app-hooks/interfaces';
import type { WorkspaceType } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';

export interface WorkspaceInviteEvent {
  workspace: WorkspaceType;
  user: UserType;
  invitedBy: UserType;
}

export interface WorkspaceEvent {
  workspace: WorkspaceType;
  user: UserType;
  ip?: string;
}

export type AppEventPayload =
  | AppEventPayloadCE
  | WorkspaceInviteEvent
  | WorkspaceEvent;

export * from 'src/services/app-hooks/interfaces';
