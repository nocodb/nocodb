import type {
  BaseType,
  CommentType,
  FormType,
  NcRequest,
  OrgUserRoles,
  ProjectRoles,
  TableType,
  UITypes,
  UserType,
} from 'nocodb-sdk';

enum MailEvent {
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_UPDATE = 'COMMENT_UPDATE',
  BASE_ROLE_UPDATE = 'BASE_ROLE_UPDATE',
  BASE_INVITE = 'BASE_INVITE',
  WELCOME = 'WELCOME',
  FORM_SUBMISSION = 'FORM_SUBMISSION',
  RESET_PASSWORD = 'RESET_PASSWORD', //OSS
  VERIFY_EMAIL = 'VERIFY_EMAIL', // OSS
  ORGANIZATION_INVITE = 'ORGANIZATION_INVITE', // OSS
  ORGANIZATION_ROLE_UPDATE = 'ORGANIZATION_ROLE_UPDATE', // OSS
  ROW_USER_MENTION = 'ROW_USER_MENTION',
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
  WORKSPACE_ROLE_UPDATE = 'WORKSPACE_ROLE_UPDATE',
}

interface CommentPayload {
  base: BaseType;
  model: TableType;
  user: UserType;
  comment: CommentType;
  rowId: string;
  req: NcRequest;
}

interface BaseRoleUpdatePayload {
  base: BaseType;
  user: UserType;
  req: NcRequest;
  oldRole: ProjectRoles;
  newRole: ProjectRoles;
}

interface BaseInvitePayload {
  base: BaseType;
  user: UserType;
  req: NcRequest;
  role: ProjectRoles;
  token?: string;
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
  oldRole: OrgUserRoles;
  newRole: OrgUserRoles;
}

interface FormSubmissionPayload {
  formView: FormType;
  model: TableType;
  emails: string[];
  base: BaseType;
  data: {
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
  }[];
}

type MailParams =
  | {
      mailEvent: MailEvent.COMMENT_CREATE | MailEvent.COMMENT_UPDATE;
      payload: CommentPayload;
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
    }
  | {
      mailEvent: MailEvent.FORM_SUBMISSION;
      payload: FormSubmissionPayload;
    };

export { MailEvent, MailParams, FormSubmissionPayload };
