import { MailEvent } from 'src/interface/Mail';
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
  role: WorkspaceUserRoles;
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
    };

export { MailEvent, MailParams };
