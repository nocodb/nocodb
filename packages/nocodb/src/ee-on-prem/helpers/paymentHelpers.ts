import {
  NON_SEAT_ROLES,
  OnPremPlanDefinitions,
  OnPremPlanTitles,
  PlanFeatureTypes,
  PlanLimitTypes,
} from 'nocodb-sdk';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import NocoLicense from '~/NocoLicense';
import Plan, { EnterprisePlan, FreePlan } from '~/models/Plan';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

export * from 'src/ee/helpers/paymentHelpers';

// ── On-prem SSO overrides ────────────────────────────────────────────────────
// The EE base functions block all on-prem SSO (`if (!isCloud) throw`).
// On-prem plans gate SSO via FEATURE_SSO — override to use plan-based checks.

export async function checkIfWorkspaceSSOAvail(
  _workspaceId: string,
  throwError = true,
) {
  const plan = getOnPremPlan();
  const isSSOEnabled = plan?.meta?.[PlanFeatureTypes.FEATURE_SSO] ?? false;

  if (!isSSOEnabled) {
    if (throwError)
      NcError.forbidden('SSO is not available on your current plan');
    else return false;
  }

  return true;
}

export async function checkIfOrgSSOAvail(_orgId: string, throwError = true) {
  return checkIfWorkspaceSSOAvail('', throwError);
}

export const getOnPremPlan = () => {
  try {
    const config = NocoLicense.getConfig();
    const planTitle = config?.plan_title;

    // JWTs carry plan_title — apply SDK plan definitions as the base
    // restrictions, then overlay JWT config for per-subscription overrides.
    if (planTitle && Object.values(OnPremPlanTitles).includes(planTitle)) {
      const planDef = OnPremPlanDefinitions[planTitle];
      return Plan.prepare({
        title: planTitle,
        description: `On-premise ${planTitle} plan`,
        meta: {
          ...Plan.limitPairs(-1, false),
          ...Plan.featurePairs(true),
          ...(planDef?.features ?? {}),
          ...(planDef?.limits ?? {}),
          ...config,
        },
        free: false,
      });
    }

    // If limit_seat is set, inject it as LIMIT_EDITOR so that
    // preInviteValidate and other plan-based checks enforce it.
    const seatLimit = NocoLicense.getSeatLimit();
    if (NocoLicense.isEE) {
      if (seatLimit !== null && seatLimit > 0) {
        return {
          ...EnterprisePlan,
          meta: {
            ...EnterprisePlan.meta,
            [PlanLimitTypes.LIMIT_EDITOR]: seatLimit,
          },
        };
      }
      return EnterprisePlan;
    }

    return FreePlan;
  } catch {
    return FreePlan;
  }
};

export async function getActivePlanAndSubscription(
  _workspaceOrOrgId: string,
  _ncMeta = Noco.ncMeta,
) {
  const plan = getOnPremPlan();

  return { plan };
}

/**
 * Check if there is headroom for additional seat-consuming users (on-prem).
 * Used by team operations where per-user role transitions aren't available.
 */
export async function checkGlobalSeatHeadroom(
  additionalSeats = 1,
  ncMeta = Noco.ncMeta,
) {
  const seatLimit = NocoLicense.getSeatLimit();

  if (seatLimit === null || seatLimit <= 0) return;

  const currentCount = await NocoLicense.calculateGlobalSeatCount(ncMeta);

  if (currentCount + additionalSeats > seatLimit) {
    NcError.planLimitExceeded(
      `Maximum seat limit of ${seatLimit} reached. Contact your administrator to increase the licensed seat count.`,
      {
        plan: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
        limit: seatLimit,
        current: currentCount,
      },
    );
  }
}

/**
 * On-prem seat limit enforcement.
 * When limit_seat is set in config (airgapped or standard), enforce locally.
 * When limit_seat is absent, unlimited (current behavior preserved).
 */
export async function checkSeatLimit(
  _workspaceId: string,
  _fkUserId: string | null,
  oldRole: WorkspaceUserRoles | ProjectRoles,
  newRole: WorkspaceUserRoles | ProjectRoles,
  ncMeta = Noco.ncMeta,
) {
  const seatLimit = NocoLicense.getSeatLimit();

  // No seat limit configured — unlimited
  if (seatLimit === null || seatLimit <= 0) return;

  // Only check when transitioning from non-seat to seat-consuming role
  if (!NON_SEAT_ROLES.includes(newRole) && NON_SEAT_ROLES.includes(oldRole)) {
    const currentCount = await NocoLicense.calculateGlobalSeatCount(ncMeta);

    if (currentCount + 1 > seatLimit) {
      NcError.planLimitExceeded(
        `Maximum seat limit of ${seatLimit} reached. Contact your administrator to increase the licensed seat count.`,
        {
          plan: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
          limit: seatLimit,
          current: currentCount,
        },
      );
    }
  }
}
