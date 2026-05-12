import {
  MailEvent,
  RawMailParams,
  SKIP_STORING_MAIL_EVENTS,
} from 'src/interface/Mail';
import type { MailParams as CEMailParams } from 'src/interface/Mail';
import type {
  ColumnType,
  NcRequest,
  PlanLimitTypes,
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

interface WorkflowErrorDigestPayload {
  req?: NcRequest;
  user: UserType;
  workflow: {
    id: string;
    title: string;
  };
  workspace: {
    id: string;
    title: string;
  };
  base: {
    id: string;
    title: string;
  };
  failureCount: number;
  firstFailureTime: string;
  lastFailureTime: string;
  lastFailureId: string;
}

interface WorkflowDraftReminderPayload {
  req?: NcRequest;
  user: UserType;
  workflow: {
    id: string;
    title: string;
  };
  workspace: {
    id: string;
    title: string;
  };
  base: {
    id: string;
    title: string;
  };
  draftAgeDays: number;
}

interface LimitReachedPayload {
  req?: NcRequest;
  user: UserType;
  workspace: {
    id: string;
    title: string;
  };
  limitType: PlanLimitTypes;
  currentUsage: number;
  limitValue: number;
  gracePeriodStartAt: string;
  gracePeriodEndsAt: string;
  upgradeUrl: string;
}

interface BillingPayloadBase {
  req?: NcRequest;
  user: UserType;
  workspace: {
    id: string;
    title: string;
  };
  billingPortalUrl: string;
}

interface PaymentFailedPayload extends BillingPayloadBase {
  invoiceId: string;
  attemptCount: number;
  amountDue: number;
  currency: string;
  nextAttemptAt?: string;
  failureMessage?: string;
}

interface SubscriptionCreatedPayload extends BillingPayloadBase {
  subscriptionId: string;
  planTitle: string;
  seatCount: number;
  periodEnd?: string;
  isTrial: boolean;
}

interface SubscriptionCanceledPayload extends BillingPayloadBase {
  subscriptionId: string;
  planTitle: string;
  cancelAt?: string;
  periodEnd?: string;
}

interface PlanChangedPayload extends BillingPayloadBase {
  subscriptionId: string;
  oldPlanTitle: string;
  newPlanTitle: string;
  newPriceId: string;
  effectiveAt?: string;
}

interface TrialEndedPayload extends BillingPayloadBase {
  subscriptionId: string;
  planTitle: string;
  convertedToActive: boolean;
  periodEnd?: string;
}

interface RenewalReminderPayload extends BillingPayloadBase {
  subscriptionId: string;
  planTitle: string;
  periodEnd: string;
  amountDue?: number;
  currency?: string;
}

interface GracePeriodEndingPayload {
  req?: NcRequest;
  user: UserType;
  workspace: {
    id: string;
    title: string;
  };
  limitType: PlanLimitTypes;
  currentUsage: number;
  limitValue: number;
  gracePeriodStartAt: string;
  gracePeriodEndsAt: string;
  daysRemaining: number;
  upgradeUrl: string;
}

interface HookErrorDigestPayload {
  req?: NcRequest;
  user: UserType;
  hook: {
    id: string;
    title: string;
  };
  table: {
    id: string;
    title: string;
  };
  workspace: {
    id: string;
    title: string;
  };
  base: {
    id: string;
    title: string;
  };
  failureCount: number;
  firstFailureTime: string;
  lastFailureTime: string;
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
    }
  | {
      mailEvent: MailEvent.TEAM_MEMBER_INVITE;
      payload: {
        req: NcRequest;
        user: UserType;
        team: any;
        workspace: any;
        teamRole: string;
      };
    }
  | {
      mailEvent: MailEvent.TEAM_MEMBER_ROLE_UPDATE;
      payload: {
        req: NcRequest;
        user: UserType;
        team: any;
        workspace: any;
        oldTeamRole: string;
        teamRole: string;
      };
    }
  | {
      mailEvent: MailEvent.TEAM_MEMBER_REMOVED;
      payload: {
        req: NcRequest;
        user: UserType;
        team: any;
        workspace: any;
        teamRole: string;
      };
    }
  | {
      mailEvent: MailEvent.TEAM_ASSIGNED_TO_WORKSPACE;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        workspace: any;
        workspaceRole: string;
      };
    }
  | {
      mailEvent: MailEvent.TEAM_ASSIGNED_TO_BASE;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        base: any;
        baseRole: string;
      };
    }
  | {
      mailEvent: MailEvent.WORKSPACE_TEAM_REMOVED;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        workspace: any;
        workspaceRole: string;
      };
    }
  | {
      mailEvent: MailEvent.WORKSPACE_TEAM_ROLE_UPDATE;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        workspace: any;
        oldWorkspaceRole: string;
        workspaceRole: string;
      };
    }
  | {
      mailEvent: MailEvent.BASE_TEAM_REMOVED;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        base: any;
        baseRole: string;
      };
    }
  | {
      mailEvent: MailEvent.BASE_TEAM_ROLE_UPDATE;
      payload: {
        req: NcRequest;
        owner: UserType;
        team: any;
        base: any;
        oldBaseRole: string;
        baseRole: string;
      };
    }
  | {
      mailEvent: MailEvent.WORKFLOW_ERROR_DIGEST;
      payload: WorkflowErrorDigestPayload;
    }
  | {
      mailEvent: MailEvent.WORKFLOW_DRAFT_REMINDER;
      payload: WorkflowDraftReminderPayload;
    }
  | {
      mailEvent: MailEvent.HOOK_ERROR_DIGEST;
      payload: HookErrorDigestPayload;
    }
  | {
      mailEvent: MailEvent.LIMIT_REACHED;
      payload: LimitReachedPayload;
    }
  | {
      mailEvent: MailEvent.GRACE_PERIOD_ENDING;
      payload: GracePeriodEndingPayload;
    }
  | {
      mailEvent: MailEvent.PAYMENT_FAILED;
      payload: PaymentFailedPayload;
    }
  | {
      mailEvent: MailEvent.SUBSCRIPTION_CREATED;
      payload: SubscriptionCreatedPayload;
    }
  | {
      mailEvent: MailEvent.SUBSCRIPTION_CANCELED;
      payload: SubscriptionCanceledPayload;
    }
  | {
      mailEvent: MailEvent.PLAN_CHANGED;
      payload: PlanChangedPayload;
    }
  | {
      mailEvent: MailEvent.TRIAL_ENDED;
      payload: TrialEndedPayload;
    }
  | {
      mailEvent: MailEvent.RENEWAL_REMINDER;
      payload: RenewalReminderPayload;
    };

export {
  MailEvent,
  MailParams,
  RawMailParams,
  SKIP_STORING_MAIL_EVENTS,
  WorkflowErrorDigestPayload,
  WorkflowDraftReminderPayload,
  HookErrorDigestPayload,
  LimitReachedPayload,
  GracePeriodEndingPayload,
  PaymentFailedPayload,
  SubscriptionCreatedPayload,
  SubscriptionCanceledPayload,
  PlanChangedPayload,
  TrialEndedPayload,
  RenewalReminderPayload,
};
