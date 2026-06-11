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
import type { XcEmailAttachment } from '~/types/nc-plugin';

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
  WORKSPACE_REQUEST_UPGRADE = 'WORKSPACE_REQUEST_UPGRADE',
  TEAM_MEMBER_INVITE = 'TEAM_MEMBER_INVITE',
  TEAM_MEMBER_ROLE_UPDATE = 'TEAM_MEMBER_ROLE_UPDATE',
  TEAM_MEMBER_REMOVED = 'TEAM_MEMBER_REMOVED',
  TEAM_ASSIGNED_TO_WORKSPACE = 'TEAM_ASSIGNED_TO_WORKSPACE',
  TEAM_ASSIGNED_TO_BASE = 'TEAM_ASSIGNED_TO_BASE',
  WORKSPACE_TEAM_REMOVED = 'WORKSPACE_TEAM_REMOVED',
  WORKSPACE_TEAM_ROLE_UPDATE = 'WORKSPACE_TEAM_ROLE_UPDATE',
  BASE_TEAM_REMOVED = 'BASE_TEAM_REMOVED',
  BASE_TEAM_ROLE_UPDATE = 'BASE_TEAM_ROLE_UPDATE',
  WORKFLOW_ERROR_DIGEST = 'WORKFLOW_ERROR_DIGEST',
  WORKFLOW_DRAFT_REMINDER = 'WORKFLOW_DRAFT_REMINDER',
  HOOK_ERROR_DIGEST = 'HOOK_ERROR_DIGEST',
  SEND_RECORD = 'SEND_RECORD',
  LIMIT_REACHED = 'LIMIT_REACHED',
  GRACE_PERIOD_ENDING = 'GRACE_PERIOD_ENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  PLAN_CHANGED = 'PLAN_CHANGED',
  TRIAL_ENDED = 'TRIAL_ENDED',
  TRIAL_ENDING = 'TRIAL_ENDING',
  // Activation nudges (cloud, scanner-driven). Fired at most once per user
  // per event ever, with cross-event mute (max 1 nudge/user/7d) at the check
  // layer. Targeting requires `last_active_at` to be populated.
  NUDGE_NO_BASE = 'NUDGE_NO_BASE',
  NUDGE_WORKFLOW_INACTIVE = 'NUDGE_WORKFLOW_INACTIVE',
  NUDGE_INVITE_TEAM = 'NUDGE_INVITE_TEAM',
  NUDGE_SEAT_LIMIT = 'NUDGE_SEAT_LIMIT',
  // On-prem self-serve billing (cloud-issued license, subscription in
  // `nc_subscriptions` with no workspace/org). Fired from OnPremLicenseService
  // webhook handlers, routed through the same deferred outbox as cloud billing.
  ON_PREM_LICENSE_ISSUED = 'ON_PREM_LICENSE_ISSUED',
  ON_PREM_PAYMENT_FAILED = 'ON_PREM_PAYMENT_FAILED',
  ON_PREM_PLAN_CHANGED = 'ON_PREM_PLAN_CHANGED',
  ON_PREM_SUBSCRIPTION_CANCELED = 'ON_PREM_SUBSCRIPTION_CANCELED',
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

interface SendRecordPayload {
  senderName: string;
  senderEmail: string;
  emails: string[];
  model: TableType;
  base: BaseType;
  message?: string;
  subject?: string;
  recordData: {
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
  }[];
  rowId: string;
  req: NcRequest;
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
    }
  | {
      mailEvent: MailEvent.SEND_RECORD;
      payload: SendRecordPayload;
    };

interface RawMailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: XcEmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * MailEvents excluded from the `nc_mail_sends` audit table.
 *
 * These are user-content sends where recipients + payload come from user data
 * (form responders, record-share targets). Logging them would create PII
 * exposure on data we don't otherwise hold.
 *
 * Denylist (not allowlist) so new platform-generated MailEvents default to
 * audited — safer audit posture.
 *
 * `sendMailRaw()` is also excluded from logging unconditionally — it's a
 * low-level passthrough used by workflow node email actions and the internal
 * raw-send controller.
 */
const SKIP_STORING_MAIL_EVENTS: ReadonlySet<MailEvent> = new Set([
  MailEvent.FORM_SUBMISSION,
  MailEvent.SEND_RECORD,
]);

export {
  MailEvent,
  MailParams,
  FormSubmissionPayload,
  SendRecordPayload,
  RawMailParams,
  SKIP_STORING_MAIL_EVENTS,
};
