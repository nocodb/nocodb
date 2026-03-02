import { NON_SEAT_ROLES, OnPremPlanTitles, PlanLimitTypes } from 'nocodb-sdk';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import NocoLicense from '~/NocoLicense';
import Plan, {
  EnterprisePlan,
  EnterpriseStarterPlan,
  FreePlan,
} from '~/models/Plan';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

export * from 'src/ee/helpers/paymentHelpers';

export const getOnPremPlan = () => {
  try {
    const config = NocoLicense.getConfig();
    const planTitle = config?.plan_title;

    // New JWTs carry plan_title — build plan from everything-enabled base
    // and let the JWT config be the sole authority for restrictions.
    // This keeps plan definitions on the license server, not in client code.
    if (planTitle && Object.values(OnPremPlanTitles).includes(planTitle)) {
      return Plan.prepare({
        title: planTitle,
        description: `On-premise ${planTitle} plan`,
        meta: {
          ...Plan.limitPairs(-1, false),
          ...Plan.featurePairs(true),
          ...config,
        },
        free: false,
      });
    }

    // Legacy: JWT with config but no plan_title — infer from workspace limit
    if (config && Object.keys(config).length > 1) {
      const title =
        NocoLicense.getWorkspaceLimit() === 1
          ? OnPremPlanTitles.ENTERPRISE_STARTER
          : OnPremPlanTitles.ENTERPRISE;

      return Plan.prepare({
        title,
        description: 'On-premise plan',
        meta: {
          ...Plan.limitPairs(-1, false),
          ...Plan.featurePairs(true),
          ...config,
        },
        free: false,
      });
    }

    // Legacy: old JWT with only limit_workspace (no full config)
    const basePlan =
      NocoLicense.getWorkspaceLimit() === 1
        ? EnterpriseStarterPlan
        : EnterprisePlan;

    // If limit_seat is set, inject it as LIMIT_EDITOR so that
    // preInviteValidate and other plan-based checks enforce it.
    const seatLimit = NocoLicense.getSeatLimit();
    if (seatLimit !== null && seatLimit > 0) {
      return {
        ...basePlan,
        meta: {
          ...basePlan.meta,
          [PlanLimitTypes.LIMIT_EDITOR]: seatLimit,
        },
      };
    }

    // Licensed but no config restrictions → full enterprise
    if (NocoLicense.isEE) {
      return basePlan;
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
        plan: OnPremPlanTitles.ENTERPRISE,
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
          plan: OnPremPlanTitles.ENTERPRISE,
          limit: seatLimit,
          current: currentCount,
        },
      );
    }
  }
}
