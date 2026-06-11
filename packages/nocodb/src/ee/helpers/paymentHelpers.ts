import {
  AddonDefinitions,
  GRACE_PERIOD_DURATION,
  NON_SEAT_ROLES,
  PlanFeatureTypes,
  PlanLimitTypes,
  applyAddons,
  resolvePlanMeta,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import type {
  NcApiVersion,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type Stripe from 'stripe';
import { NcError } from '~/helpers/catchError';
import {
  Addon,
  Domain,
  Org,
  Subscription,
  SubscriptionAddon,
  Workspace,
} from '~/models';
import Noco from '~/Noco';
import Plan, { CommonLimits, FreePlan, GraceLimits } from '~/models/Plan';
import { isCloud, isOnPrem } from '~/utils';

async function getLimit(
  type: PlanLimitTypes,
  workspaceOrId?: string | Workspace,
  ncMeta = Noco.ncMeta,
): Promise<{
  limit: number;
  plan?: Partial<Plan>;
}> {
  if (!workspaceOrId) {
    if (CommonLimits[type] === undefined || CommonLimits[type] === null) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    if (CommonLimits[type] === -1) {
      return {
        limit: Infinity,
      };
    }

    return {
      limit: CommonLimits[type] ?? Infinity,
    };
  }

  const workspace =
    typeof workspaceOrId === 'string'
      ? await Workspace.get(workspaceOrId, undefined, ncMeta)
      : workspaceOrId;

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  const plan = workspace?.payment?.plan;

  // plan.meta is fully populated by resolvePlanMeta (CommonLimits + CommonPaidLimits + plan-specific)
  const limit = plan?.meta?.[type] ?? Infinity;

  if (limit === -1) {
    return {
      limit: Infinity,
      plan,
    };
  }

  return {
    limit,
    plan,
  };
}

async function checkLimit(args: {
  workspace?: Workspace;
  workspaceId?: string;
  type: PlanLimitTypes;
  count?: number;
  delta?: number;
  message?: (args: { limit?: number; plan?: string }) => string;
  throwError?: boolean;
  ncMeta?: typeof Noco.ncMeta;
}): Promise<void> {
  const {
    workspaceId,
    type,
    delta,
    message,
    throwError = true,
    ncMeta = Noco.ncMeta,
  } = args;

  try {
    let workspace = args.workspace;

    if (!workspace) {
      if (!workspaceId)
        NcError.badRequest('Workspace ID or workspace is required');

      workspace = await Workspace.get(workspaceId, undefined, ncMeta);
    }

    if (!workspace) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    const plan = workspace?.payment?.plan;

    // plan.meta is fully populated by resolvePlanMeta (CommonLimits + CommonPaidLimits + plan-specific)
    const limit = plan?.meta?.[type] ?? Infinity;

    const statName =
      type === PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE ? 'row_count' : type;

    // Coerce — PG BIGINT count/sum returns string, would flip `+` into concat.
    const count = Number(args.count ?? workspace.stats?.[statName] ?? 0) || 0;
    const numDelta = Number(delta) || 0;

    if (limit === -1) {
      return;
    }

    if (count + numDelta > limit) {
      if (type in GraceLimits && plan?.free) {
        let gracePeriodStartAt = workspace.grace_period_start_at;

        if (type === PlanLimitTypes.LIMIT_API_CALL)
          gracePeriodStartAt = workspace.api_grace_period_start_at;
        if (type === PlanLimitTypes.LIMIT_AUTOMATION_RUN)
          gracePeriodStartAt = workspace.automation_grace_period_start_at;

        if (gracePeriodStartAt) {
          // midday UTC time
          const gracePeriodEndAt = dayjs(gracePeriodStartAt)
            .utc()
            .add(GRACE_PERIOD_DURATION, 'day')
            .startOf('day')
            .add(12, 'hour')
            .toDate();

          if (dayjs().isBefore(gracePeriodEndAt)) {
            if (count + numDelta > GraceLimits[type]) {
              NcError.planLimitExceeded(
                message?.({
                  limit: GraceLimits[type],
                  plan: plan?.title,
                }) ||
                  `You have reached the limit of ${limit} (${type}) for your plan.`,
                {
                  plan: plan?.title,
                  limit: GraceLimits[type],
                  current: count,
                },
              );
            }
            return;
          }

          NcError.planLimitExceeded(
            message?.({
              limit: GraceLimits[type],
              plan: plan?.title,
            }) ||
              `You have reached the limit of ${limit} (${type}) for your plan.`,
            {
              plan: plan?.title,
              limit: GraceLimits[type],
              current: count,
            },
          );
        } else {
          const gracePeriodStartAt = ncMeta.now();

          const updateObject: Partial<Workspace> = {};

          if (type === PlanLimitTypes.LIMIT_API_CALL) {
            updateObject.api_grace_period_start_at = gracePeriodStartAt;
          } else if (type === PlanLimitTypes.LIMIT_AUTOMATION_RUN) {
            updateObject.automation_grace_period_start_at = gracePeriodStartAt;
          } else {
            updateObject.grace_period_start_at = gracePeriodStartAt;
          }

          await Workspace.update(workspace.id, updateObject, ncMeta);

          return;
        }
      } else {
        NcError.planLimitExceeded(
          message?.({
            limit,
            plan: plan?.title,
          }) ||
            `You have reached the limit of ${limit} (${type}) for your plan.`,
          {
            plan: plan?.title,
            limit,
            current: count,
          },
        );
      }
    }
  } catch (e) {
    if (throwError) {
      throw e;
    }
  }
}

async function checkSeatLimit(
  workspaceId: string,
  fkUserId: string | null,
  oldRole: WorkspaceUserRoles | ProjectRoles,
  newRole: WorkspaceUserRoles | ProjectRoles,
  ncMeta = Noco.ncMeta,
) {
  const { seatCount, nonSeatCount, seatUsersMap } =
    await Subscription.calculateWorkspaceSeatCount(workspaceId, ncMeta);

  /**
   * If user is already seatUser then no need to increase count to check
   */
  const increaseCount = fkUserId ? (seatUsersMap.has(fkUserId) ? 0 : 1) : 1;

  if (!NON_SEAT_ROLES.includes(newRole) && NON_SEAT_ROLES.includes(oldRole)) {
    const { limit: editorLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_EDITOR,
      workspaceId,
      ncMeta,
    );

    // check if user limit is reached or going to be exceeded
    if (seatCount + increaseCount > editorLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${editorLimitForWorkspace} editors are allowed for your plan, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: editorLimitForWorkspace,
          current: seatCount,
        },
      );
    }
  }

  if (NON_SEAT_ROLES.includes(newRole) && !NON_SEAT_ROLES.includes(oldRole)) {
    const { limit: commenterLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_COMMENTER,
      workspaceId,
      ncMeta,
    );

    // check if commenter limit is reached or going to be exceeded
    if (nonSeatCount + 1 > commenterLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${commenterLimitForWorkspace} commenters are allowed for your plan, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: commenterLimitForWorkspace,
          current: nonSeatCount,
        },
      );
    }
  }
}

async function getFeature(
  type: PlanFeatureTypes,
  workspaceOrOrgId: string | Workspace | Org,
  ncMeta = Noco.ncMeta,
) {
  const workspaceOrOrg =
    typeof workspaceOrOrgId === 'string'
      ? (await Workspace.get(workspaceOrOrgId, undefined, ncMeta)) ??
        (await Org.get(workspaceOrOrgId, ncMeta))
      : workspaceOrOrgId;

  if (!workspaceOrOrg) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  return workspaceOrOrg?.payment?.plan?.meta?.[type] || false;
}

async function checkForFeature(
  context: {
    workspace_id: string;
    api_version?: NcApiVersion;
    workspace?: Workspace | Org;
  },
  type: PlanFeatureTypes,
  ncMeta = Noco.ncMeta,
) {
  if (
    !(await getFeature(type, context.workspace ?? context.workspace_id, ncMeta))
  ) {
    NcError.get(context).featureNotSupported({
      feature: type,
      isOnPrem: isOnPrem,
    });
  }
  return true;
}

async function getWorkspaceOrOrg(
  workspaceOrOrgId: string,
  ncMeta = Noco.ncMeta,
): Promise<
  | (Workspace & {
      entity: 'workspace';
      loyal?: boolean;
      loyalty_discount_used?: boolean;
      segment_code?: number;
    })
  | (Org & {
      entity: 'org';
      loyal?: boolean;
      loyalty_discount_used?: boolean;
      segment_code?: number;
    })
> {
  const workspace = await Workspace.get(workspaceOrOrgId, null, ncMeta);

  if (workspace) {
    return { ...workspace, entity: 'workspace' };
  }

  const org = await Org.get(workspaceOrOrgId, ncMeta);

  if (org) {
    return { ...org, entity: 'org' };
  }
}

async function getActivePlanAndSubscription(
  workspaceOrOrgId: string,
  ncMeta = Noco.ncMeta,
) {
  const subscription = await Subscription.getByWorkspaceOrOrg(
    workspaceOrOrgId,
    ncMeta,
  );

  if (!subscription) {
    return { plan: FreePlan };
  }

  const plan = await Plan.get(subscription.fk_plan_id, ncMeta);

  // Resolve features/limits from code-bundled definitions (not DB)
  const codeMeta = resolvePlanMeta(plan.title);

  // Preserve non-gating metadata from DB (description_*, etc.)
  const descriptionMeta: Record<string, string> = {};
  if (plan.meta) {
    for (const [key, value] of Object.entries(plan.meta)) {
      if (!key.startsWith('limit_') && !key.startsWith('feature_')) {
        descriptionMeta[key] = value as string;
      }
    }
  }

  plan.meta = { ...codeMeta, ...descriptionMeta };

  // Per-subscription overrides (enterprise custom deals, addons, etc.)
  if (subscription.meta?.plan_meta) {
    Object.assign(plan.meta, subscription.meta.plan_meta);
  }

  // Add-on entitlements: expand active add-ons into plan meta (same expansion as on-prem).
  const activeAddons = await SubscriptionAddon.listActive(
    subscription.id,
    ncMeta,
  );
  applyAddons(
    plan.meta as Record<string, number | boolean>,
    activeAddons.map((a) => a.addon_key),
  );

  return {
    plan,
    subscription,
    addons: activeAddons.map((a) => ({
      addon_key: a.addon_key,
      status: a.status,
    })),
  };
}

// if Cloud, then check if sso is available for the workspace/org
async function checkIfWorkspaceSSOAvail(
  workspaceId: string,
  throwError = true,
) {
  if (!isCloud) {
    if (throwError)
      NcError.forbidden('This feature is not available in self-hosted version');
    else return false;
  }

  const isSSOEnabled = await getFeature(
    PlanFeatureTypes.FEATURE_SSO,
    workspaceId,
  );

  if (!isSSOEnabled) {
    if (throwError)
      NcError.forbidden('SSO is not available for this workspace');
    else return false;
  }

  return true;
}

// if Cloud, then check if sso is available for the org
async function checkIfOrgSSOAvail(orgId: string, throwError = true) {
  if (!isCloud) {
    if (throwError)
      NcError.forbidden('This feature is not available in self-hosted version');
    else return false;
  }

  const isSSOEnabled = await getFeature(PlanFeatureTypes.FEATURE_SSO, orgId);

  if (!isSSOEnabled) {
    if (throwError)
      NcError.forbidden('SSO is not available for this organization');
    else return false;
  }

  return true;
}

export function calculateUnitPrice(
  price: Stripe.Price,
  workspaceOrOrgSeatCount: number,
  mode: 'month' | 'year',
) {
  if (!price) return 0;

  if (price.billing_scheme === 'tiered' && price.tiers_mode === 'volume') {
    const tier = price.tiers.find(
      (tier: any) => workspaceOrOrgSeatCount <= (tier.up_to ?? Infinity),
    );

    if (!tier) return 0;

    return (
      (tier.unit_amount + tier.flat_amount) / 100 / (mode === 'year' ? 12 : 1)
    );
  } else if (
    price.billing_scheme === 'tiered' &&
    price.tiers_mode === 'graduated'
  ) {
    let remainingSeats = workspaceOrOrgSeatCount;
    let total = 0;
    let previousUpTo = 0;

    for (const tier of price.tiers) {
      const tierLimit = tier.up_to ?? Infinity;
      const tierSeats = Math.min(remainingSeats, tierLimit);
      const seatsInTier = tierSeats - (previousUpTo ?? 0);

      if (seatsInTier > 0) {
        total += tier.unit_amount + (tier.flat_amount || 0);
        remainingSeats -= seatsInTier;
      }

      if (tier.up_to === null || workspaceOrOrgSeatCount <= tierLimit) break;

      previousUpTo = tierLimit;
    }

    return total / 100 / (mode === 'year' ? 12 : 1);
  }

  return price.unit_amount / 100 / (mode === 'year' ? 12 : 1);
}

// check if email only allowed through sso LOGIN
const checkIfEmailAllowedNonSSO = async (
  workspaceId: string,
  email: string,
) => {
  const domains = await Domain.list({
    workspaceId,
  });

  return (
    !!email && domains?.some((d: Domain) => d.domain === email?.split('@')[1])
  );
};

// check if email only allowed through sso LOGIN for org
const checkIfEmailAllowedNonSSOForOrg = async (
  orgId: string,
  email: string,
) => {
  const domains = await Domain.list({
    orgId,
  });

  return (
    !!email && domains?.some((d: Domain) => d.domain === email?.split('@')[1])
  );
};

/**
 * Check if there is headroom for additional seat-consuming users.
 * Cloud: no-op (paid plans have unlimited seats, reseat handles billing).
 * On-prem: overridden to enforce limit_seat from license config.
 */

async function checkGlobalSeatHeadroom(_additionalSeats = 1) {
  // No-op on cloud — seat limits are handled by reseatSubscription
}

/**
 * Pick the base plan item from a Stripe subscription's items. Add-on grants
 * make subscriptions multi-item, and Stripe does not guarantee item ordering
 * (a scheduled phase change mints fresh ids for every item), so
 * `items.data[0]` is NOT necessarily the base plan item.
 *
 * Resolution order:
 *   1. Single item → that item.
 *   2. Exactly one item whose product is not a known add-on product.
 *   3. The item whose product is a known plan product.
 *   4. The item matching the locally stored base price id.
 *   5. `items[0]` (legacy fallback).
 */
export function pickBaseSubscriptionItem(
  items: Stripe.SubscriptionItem[],
  opts: {
    addonProductIds?: Set<string>;
    planProductIds?: Set<string>;
    localPriceId?: string | null;
  } = {},
): Stripe.SubscriptionItem | undefined {
  if (!items?.length) return undefined;
  if (items.length === 1) return items[0];

  const productOf = (item: Stripe.SubscriptionItem): string | undefined => {
    const product = item.price?.product;
    return typeof product === 'string' ? product : product?.id;
  };

  const { addonProductIds, planProductIds, localPriceId } = opts;

  const nonAddonItems = addonProductIds?.size
    ? items.filter((i) => !addonProductIds.has(productOf(i) ?? ''))
    : items;
  if (nonAddonItems.length === 1) return nonAddonItems[0];

  const candidates = nonAddonItems.length ? nonAddonItems : items;

  if (planProductIds?.size) {
    const byPlanProduct = candidates.find((i) =>
      planProductIds.has(productOf(i) ?? ''),
    );
    if (byPlanProduct) return byPlanProduct;
  }

  if (localPriceId) {
    const byPrice = candidates.find((i) => i.price?.id === localPriceId);
    if (byPrice) return byPrice;
  }

  return items[0];
}

/**
 * Resolve the base plan item of a live Stripe subscription. Add-on items are
 * identified by the add-on catalog's product ids and the base item by the
 * known plan product ids (see pickBaseSubscriptionItem for the full order).
 */
export async function getBaseSubscriptionItem(
  stripeSub: Stripe.Subscription,
  localPriceId?: string | null,
  ncMeta = Noco.ncMeta,
): Promise<Stripe.SubscriptionItem | undefined> {
  const items = stripeSub?.items?.data ?? [];
  if (items.length <= 1) return items[0];

  const [plans, addons] = await Promise.all([
    Plan.list(ncMeta),
    Addon.list(ncMeta),
  ]);

  return pickBaseSubscriptionItem(items, {
    addonProductIds: new Set(
      addons.map((a) => a.stripe_product_id).filter(Boolean),
    ),
    planProductIds: new Set(
      plans.map((p) => p.stripe_product_id).filter(Boolean),
    ),
    localPriceId,
  });
}

/**
 * Build the Stripe `items` payload for a seat change: the base subscription
 * item plus every active, Stripe-backed, per-seat add-on item — all at
 * `newSeatCount` (forced match). Flat add-ons keep their quantity; comped
 * add-ons (no Stripe item) carry nothing.
 */
export async function buildSeatSyncItems(
  subscription: Subscription,
  stripeSub: Stripe.Subscription,
  newSeatCount: number,
  ncMeta = Noco.ncMeta,
): Promise<{ id: string; price?: string; quantity: number }[]> {
  const baseItem = await getBaseSubscriptionItem(
    stripeSub,
    subscription.stripe_price_id,
    ncMeta,
  );
  const items: { id: string; price?: string; quantity: number }[] = [
    {
      id: baseItem.id,
      price: subscription.stripe_price_id,
      quantity: newSeatCount,
    },
  ];
  const addons = await SubscriptionAddon.listActive(subscription.id, ncMeta);
  for (const sa of addons) {
    if (!sa.stripe_subscription_item_id) continue; // comped → not billed
    const def = AddonDefinitions[sa.addon_key];
    if (def?.quantityBasis !== 'per_seat') continue; // flat → leave as-is
    items.push({
      id: sa.stripe_subscription_item_id,
      quantity: newSeatCount,
    });
  }
  return items;
}

/**
 * Overridden in `src/ee-on-prem/helpers/paymentHelpers.ts`.
 */
export function getOnPremPlan(): Plan | null {
  return null;
}

export {
  PlanLimitTypes,
  PlanFeatureTypes,
  checkLimit,
  getLimit,
  getFeature,
  getWorkspaceOrOrg,
  getActivePlanAndSubscription,
  checkSeatLimit,
  checkGlobalSeatHeadroom,
  checkForFeature,
  checkIfWorkspaceSSOAvail,
  checkIfOrgSSOAvail,
  checkIfEmailAllowedNonSSO,
  checkIfEmailAllowedNonSSOForOrg,
};
