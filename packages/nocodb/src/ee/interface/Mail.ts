import { MailEvent, RawMailParams } from 'src/interface/Mail';
import type { MailParams as CEMailParams } from 'src/interface/Mail';
import type {
  ColumnType,
  NcRequest,
  TableType,
  UserType,
  WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';

interface WorkspaceInvitePayload {
  workspace: WorkspaceType;
  user: UserType;
  req: NcRequest;
  token?: string;
}

interface RowMentionPayload {
  model: TableType;
  rowId: string;
  user: UserType;
  column: ColumnType;
  req: NcRequest;
  mentions: string[];
}

interface WorkspaceRoleUpdatePayload {
  workspace: WorkspaceType;
  user: UserType;
  req: NcRequest;
  oldRole: WorkspaceUserRoles;
  newRole: WorkspaceUserRoles;
}

interface WorkspaceRequestUpgradePayload {
  workspace: WorkspaceType;
  user: UserType;
  requester: {
    email?: string;
    display_name?: string;
  };
  req: NcRequest;
  limitOrFeature: string;
}

type MailParams =
  | CEMailParams // Base CE types
  | {
      mailEvent: MailEvent.ROW_USER_MENTION;
      payload: RowMentionPayload;
    }
  | {
      mailEvent: MailEvent.WORKSPACE_INVITE;
      payload: WorkspaceInvitePayload;
    }
  | {
      mailEvent: MailEvent.WORKSPACE_ROLE_UPDATE;
      payload: WorkspaceRoleUpdatePayload;
    }
  | {
      mailEvent: MailEvent.WORKSPACE_REQUEST_UPGRADE;
      payload: WorkspaceRequestUpgradePayload;
    };

export { MailEvent, MailParams, RawMailParams };
