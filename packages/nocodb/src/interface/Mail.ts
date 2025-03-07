import type {
  BaseType,
  ColumnType,
  CommentType,
  NcRequest,
  ProjectRoles,
  TableType,
  UserType,
  WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';

enum MailEvent {
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_UPDATE = 'COMMENT_UPDATE',
  ROW_USER_MENTION = 'ROW_USER_MENTION',
  BASE_ROLE_UPDATE = 'BASE_ROLE_UPDATE',
  BASE_INVITE = 'BASE_INVITE',
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
  WORKSPACE_ROLE_UPDATE = 'WORKSPACE_ROLE_UPDATE',
  WELCOME = 'WELCOME',
  RESET_PASSWORD = 'RESET_PASSWORD', //OSS
  VERIFY_EMAIL = 'VERIFY_EMAIL', // OSS
  ORGANIZATION_INVITE = 'ORGANIZATION_INVITE', // OSS
  ORGANIZATION_ROLE_UPDATE = 'ORGANIZATION_ROLE_UPDATE', // OSS
}

interface CommentPayload {
  base: BaseType;
  model: TableType;
  user: UserType;
  comment: CommentType;
  rowId: string;
  req: NcRequest;
}

interface RowMentionPayload {
  model: TableType;
  rowId: string;
  user: UserType;
  column: ColumnType;
  req: NcRequest;
  mentions: string[];
}

interface BaseRoleUpdatePayload {
  base: BaseType;
  user: UserType;
  req: NcRequest;
  role: ProjectRoles;
}

interface BaseInvitePayload {
  base: BaseType;
  user: UserType;
  req: NcRequest;
  role: ProjectRoles;
  token?: string;
}

interface WorkspaceInvitePayload {
  workspace: WorkspaceType;
  user: UserType;
  req: NcRequest;
  token?: string;
}

interface WorkspaceRoleUpdatePayload {
  workspace: WorkspaceType;
  user: UserType;
  req: NcRequest;
  role: WorkspaceUserRoles;
}

interface ResetPasswordPayload {
  req: NcRequest;
  user: UserType;
}

interface VerifyEmailPayload {
  req: NcRequest;
  user: UserType;
}

interface WelcomePayload {
  req: NcRequest;
  user: UserType;
}

interface OrganizationInvitePayload {
  user: UserType;
  req: NcRequest;
  token?: string;
}

interface OrganizationRoleUpdatePayload {
  user: UserType;
  req: NcRequest;
  role: WorkspaceUserRoles;
}

type MailParams =
  | {
      mailEvent: MailEvent.COMMENT_CREATE | MailEvent.COMMENT_UPDATE;
      payload: CommentPayload;
    }
  | {
      mailEvent: MailEvent.ROW_USER_MENTION;
      payload: RowMentionPayload;
    }
  | {
      mailEvent: MailEvent.BASE_ROLE_UPDATE;
      payload: BaseRoleUpdatePayload;
    }
  | {
      mailEvent: MailEvent.BASE_INVITE;
      payload: BaseInvitePayload;
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
      mailEvent: MailEvent.WELCOME;
      payload: WelcomePayload;
    }
  | {
      mailEvent: MailEvent.RESET_PASSWORD;
      payload: ResetPasswordPayload;
    }
  | {
      mailEvent: MailEvent.VERIFY_EMAIL;
      payload: VerifyEmailPayload;
    }
  | {
      mailEvent: MailEvent.ORGANIZATION_INVITE;
      payload: OrganizationInvitePayload;
    }
  | {
      mailEvent: MailEvent.ORGANIZATION_ROLE_UPDATE;
      payload: OrganizationRoleUpdatePayload;
    };

export { MailEvent, CommentPayload, RowMentionPayload, MailParams };
