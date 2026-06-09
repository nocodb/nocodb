import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import {
  AppEvents,
  CloudOrgUserRoles,
  EventType,
  getMinSeats,
  getUpgradeMessage,
  LOYALTY_GRACE_PERIOD_END_DATE,
  LoyaltyPriceReverseLookupKeyMap,
  NcBaseError,
  PlanAddonTypes,
  PlanOrder,
  ReturnToBillingPage,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ReseatSubscriptionJobData } from '~/interface/Jobs';
import { JobTypes } from '~/interface/Jobs';
import {
  Addon,
  DbServer,
  ModelStat,
  Org,
  OrgUser,
  Plan,
  Subscription,
  User,
  Workspace,
  WorkspaceUser,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import {
  calculateUnitPrice,
  getWorkspaceOrOrg,
} from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TelemetryService } from '~/services/telemetry.service';
import NocoSocket from '~/socket/NocoSocket';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { ncSiteUrl } from '~/utils/envs';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder', {
  apiVersion: '2025-05-28.basil',
});

const NOCODB_INTERNAL = 'nocodb';
const RESEAT_DELAY_MS = 10 * 60 * 1000; // 10 minutes
const RESEAT_MAX_DELAY_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class PaymentService {
  logger = new Logger('PaymentService');

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly telemetryService: TelemetryService,
    protected readonly mailService: MailService,
  ) {}

  /**
   * Resolve workspace + primary owner for a billing email. Returns null when
   * the entity isn't a workspace (orgs handled separately) or no owner found.
   */
  protected async resolveBillingMailRecipient(workspaceOrOrg: {
    entity: 'workspace' | 'org';
    id?: string;
    title?: string;
  }): Promise<{
    workspace: { id: string; title: string };
    owner: { id: string; email: string; display_name?: string };
    billingPortalUrl: string;
  } | null> {
    if (workspaceOrOrg.entity !== 'workspace') return null;
    if (!workspaceOrOrg.id) return null;

    let owners: any[] = [];
    try {
      owners = await WorkspaceUser.userList(
        {
          fk_workspace_id: workspaceOrOrg.id,
          roles: WorkspaceUserRoles.OWNER,
        },
        Noco.ncMeta,
      );
    } catch (e) {
      this.logger.warn(
        `Failed to load workspace owners for ${workspaceOrOrg.id}: ${
          (e as Error).message
        }`,
      );
      return null;
    }

    const owner = owners.find((o) => o?.email);
    if (!owner) return null;

    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';
    const billingPortalUrl = baseUrl
      ? `${baseUrl}/${workspaceOrOrg.id}/settings?tab=billing`
      : '';

    return {
      workspace: {
        id: workspaceOrOrg.id,
        title: workspaceOrOrg.title ?? '',
      },
      owner: {
        id: owner.id,
        email: owner.email,
        display_name: owner.display_name,
      },
      billingPortalUrl,
    };
  }

  /**
   * Resolve a human-readable plan title from a plan id. Falls back to the
   * provided `fallback` (never the raw id, which is a UUID and useless in
   * an email body).
   */
  protected async resolvePlanTitle(
    planId: string | undefined | null,
    fallback: string,
  ): Promise<string> {
    if (!planId) return fallback;
    try {
      const plan = await Plan.get(planId);
      return plan?.title ?? fallback;
    } catch (e) {
      this.logger.warn(
        `resolvePlanTitle: lookup failed for ${planId}: ${
          (e as Error).message
        }`,
      );
      return fallback;
    }
  }

  protected async safeSendBillingMail(
    mailEvent: MailEvent,
    paramsBuilder: () => any | Promise<any>,
  ): Promise<void> {
    try {
      const payload = await paramsBuilder();
      if (!payload) return;
      await this.mailService.sendMail({ mailEvent, payload } as any);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue ${mailEvent} mail`,
        (e as Error).stack,
      );
    }
  }

  private async fetchStripeProductDetails(stripeProductId: string) {
    const product = await stripe.products.retrieve(stripeProductId);

    if (!product) {
      NcError.genericNotFound('Product', stripeProductId);
    }

    const { name: title, description, metadata } = product;

    const prices = await stripe.prices.list({
      product: stripeProductId,
      active: true,
      expand: ['data.tiers'],
    });

    // Only store display metadata (description_*) from Stripe.
    // Features/limits are resolved from code via PlanDefinitions.
    const descriptionMeta: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key.startsWith('description_')) {
        descriptionMeta[key] = value;
      }
    }

    return {
      title,
      description,
      prices: prices.data.map((price) => price),
      meta: descriptionMeta,
    };
  }

  private clearBaseListCacheForEntity(
    workspaceOrOrg: NonNullable<Awaited<ReturnType<typeof getWorkspaceOrOrg>>>,
  ) {
    if (workspaceOrOrg.entity !== 'workspace') return;

    cleanCommandPaletteCache(workspaceOrOrg.id).catch(() => {});
  }

  async getPlans() {
    return await Plan.list();
  }

  async getPlan(planId: string) {
    const plan = await Plan.get(planId);

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    return plan;
  }

  async submitPlan(payload: {
    stripe_product_id: string;
    is_active?: boolean;
  }) {
    const existing = await Plan.getWithCondition({
      stripe_product_id: payload.stripe_product_id,
    });

    if (existing.length) {
      const existingPlan = existing[0];
      NcError._.planAlreadyExists(existingPlan.id);
    }

    const { title, description, prices, meta } =
      await this.fetchStripeProductDetails(payload.stripe_product_id);

    const plan = {
      title: title as PlanTitles,
      description,
      stripe_product_id: payload.stripe_product_id,
      is_active: payload.is_active ?? true,
      prices,
      meta,
    };

    return await Plan.insert(plan);
  }

  async syncPlan(planId: string, payload?: { is_active?: boolean }) {
    const plan =
      (await Plan.get(planId)) || (await Plan.getByStripeProductId(planId));

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    const productDetails = await this.fetchStripeProductDetails(
      plan.stripe_product_id,
    );

    Object.assign(plan, {
      ...productDetails,
      is_active: payload?.is_active,
    });

    return await Plan.update(plan.id, plan);
  }

  async syncAllPlans() {
    const plans = await Plan.getWithCondition({
      is_active: true,
    });

    for (const plan of plans) {
      await this.syncPlan(plan.id);
    }

    return { message: 'All plans synced' };
  }

  async disablePlan(planId: string) {
    const plan =
      (await Plan.get(planId)) || (await Plan.getByStripeProductId(planId));

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    return await Plan.update(plan.id, { is_active: false });
  }

  async getAddons() {
    return await Addon.list();
  }

  async submitAddon(payload: {
    stripe_product_id: string;
    addon_key: PlanAddonTypes;
    is_active?: boolean;
  }) {
    if (!Object.values(PlanAddonTypes).includes(payload.addon_key)) {
      NcError.badRequest('Invalid addon_key');
    }

    const existing = await Addon.getByKey(payload.addon_key);

    if (existing) {
      NcError.badRequest('Addon already exists');
    }

    const { title, description, prices, meta } =
      await this.fetchStripeProductDetails(payload.stripe_product_id);

    return await Addon.insert({
      addon_key: payload.addon_key,
      title,
      description,
      stripe_product_id: payload.stripe_product_id,
      prices,
      is_active: payload.is_active ?? true,
      meta,
    });
  }

  async syncAddon(addonId: string, payload?: { is_active?: boolean }) {
    const addon = await Addon.get(addonId);

    if (!addon) {
      NcError.genericNotFound('Addon', addonId);
    }

    const { title, description, prices, meta } =
      await this.fetchStripeProductDetails(addon.stripe_product_id);

    return await Addon.update(addon.id, {
      title,
      description,
      prices,
      meta,
      ...(payload?.is_active !== undefined
        ? { is_active: payload.is_active }
        : {}),
    });
  }

  async syncAllAddons() {
    const addons = await Addon.listActive();

    for (const addon of addons) {
      await this.syncAddon(addon.id!);
    }

    return { message: 'All addons synced' };
  }

  async disableAddon(addonId: string) {
    const addon = await Addon.get(addonId);

    if (!addon) {
      NcError.genericNotFound('Addon', addonId);
    }

    return await Addon.update(addon.id, { is_active: false });
  }

  async internalUpgrade(
    workspaceOrOrgId: string,
    planTitle: string,
    ncMeta = Noco.ncMeta,
  ) {
    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
    );

    if (existingSubscription) {
      NcError._.subscriptionAlreadyExists(workspaceOrOrgId);
    }

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const plans = await Plan.list(ncMeta);

    const plan = plans.find((p) => p.title === planTitle);

    if (!plan) {
      NcError.genericNotFound('Plan', planTitle);
    }

    const transaction = await ncMeta.startTransaction();

    let subscription: Subscription | null = null;

    try {
      subscription = await Subscription.insert(
        {
          fk_workspace_id:
            workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
          fk_org_id: workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
          fk_plan_id: plan.id,
          stripe_subscription_id: `internal_${nanoid()}`,
          stripe_price_id: `internal_${plan.id}`,
          seat_count: 1,
          last_paid_seat_count: 1,
          status: 'active',
          start_at: dayjs().utc().toISOString(),
          period: 'year',
          billing_cycle_anchor: dayjs().utc().toISOString(),
        },
        transaction,
      );

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: NOCODB_INTERNAL,
          },
          transaction,
        );
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: NOCODB_INTERNAL,
          },
          transaction,
        );
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      await NocoCache.del(
        'root',
        `${
          workspaceOrOrg.entity === 'workspace'
            ? CacheScope.WORKSPACE
            : CacheScope.ORG
        }:${workspaceOrOrg.id}`,
      );
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e);
      return NcError.internalServerError('Failed to create subscription');
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'subscription_created',
      message: `FREE Internal Subscription created for ${workspaceOrOrg.title} (${plan.title})`,
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        subscription_id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        plan_title: plan.title,
      },
    });

    // Use ncMeta, not the now-committed `transaction` — passing a closed
    // trx would break any DB write inside migrateDb.
    await this.migrateDb(workspaceOrOrg.id, ncMeta);
    await this.reseatSubscriptionImmediate(workspaceOrOrg.id, ncMeta);
    this.clearBaseListCacheForEntity(workspaceOrOrg);

    return subscription;
  }

  /**
   * Moves a workspace into a freshly created organization, transferring its
   * Stripe customer (and active subscription, if any) to the org. The Stripe
   * customer/subscription objects are preserved when present — only their
   * metadata and linked entity are rebound, so future invoices and webhooks
   * reference the org.
   *
   * Customer handling:
   *   - Workspace has a real Stripe customer  → copied to org, metadata rebound
   *   - Workspace has internal/no customer    → fresh Stripe customer created
   *                                              for the org so a subscription
   *                                              can be set up later
   *
   * Steps:
   *   1. Validate workspace (subscription + Stripe customer are both optional)
   *   2. Create new org (workspace OWNER(s) become org OWNER(s); other members → VIEWER)
   *   3. Attach workspace to org (fk_org_id), move stripe_customer_id workspace → org
   *   4. If active subscription exists: move subscription record (fk_workspace_id → fk_org_id)
   *   5. Stripe customer: rebind existing customer metadata, or mint a new one for the org
   *   6. Stripe subscription metadata + schedule phases (if a subscription was moved)
   */
  async moveWorkspaceToNewOrg(
    workspaceId: string,
    opts: { orgTitle?: string; dbServerId?: string } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<{ org: Org; subscription: Subscription | null }> {
    const workspace = await Workspace.get(workspaceId, false, ncMeta);
    if (!workspace) NcError.workspaceNotFound(workspaceId);

    if (workspace.fk_org_id) {
      NcError.badRequest('Workspace is already part of an organization');
    }

    // Subscription is optional — workspace may have a customer but no
    // active sub (e.g. trial expired, or customer pre-created for self-serve).
    const subscription = await Subscription.getByWorkspaceOrOrg(
      workspaceId,
      ncMeta,
    );

    if (subscription?.stripe_subscription_id?.startsWith('internal_')) {
      NcError.badRequest('Internal subscriptions cannot be moved to an org');
    }

    const wsUsers = await WorkspaceUser.userList(
      { fk_workspace_id: workspaceId },
      ncMeta,
    );

    const owners = wsUsers.filter(
      (u) => u.roles === WorkspaceUserRoles.OWNER && u.fk_user_id,
    );
    if (!owners.length) {
      NcError.badRequest('Workspace has no owner to assign as org owner');
    }

    // A "real" Stripe customer is one that exists and isn't the internal
    // sentinel. Internal customers (NOCODB_INTERNAL) are placeholders for
    // free/internal subs and should not be carried over — the org gets a
    // fresh Stripe customer instead.
    const hasRealCustomer =
      !!workspace.stripe_customer_id &&
      workspace.stripe_customer_id !== NOCODB_INTERNAL;

    // Resolve the db server for the new org. Order:
    //   1. Explicit override from caller
    //   2. The default-for-orgs bucket (set via DbServer.conditions)
    //   3. Workspace's existing server (avoids creating a broken state where
    //      the workspace is on its own server but the org has no server —
    //      cloudDb.ts would then look for `org.id` on the workspace's server
    //      while the data still lives in the `workspace.id` DB)
    //   4. null → both fall back to NC_DATA_DB; no migration needed
    let resolvedServerId: string | null = null;
    if (opts.dbServerId) {
      const explicit = await DbServer.get(opts.dbServerId, ncMeta);
      if (!explicit) NcError.genericNotFound('DbServer', opts.dbServerId);
      resolvedServerId = explicit.id;
    } else {
      const defaultServer = await DbServer.getDefaultForOrgs(ncMeta);
      resolvedServerId =
        defaultServer?.id ?? workspace.fk_db_instance_id ?? null;
    }

    const transaction = await ncMeta.startTransaction();

    let org: Org;
    try {
      org = await Org.insert(
        {
          title: opts.orgTitle ?? workspace.title,
          fk_user_id: owners[0].fk_user_id,
          // Carry over the workspace's Stripe customer if real; otherwise
          // leave null and create a fresh one after commit.
          stripe_customer_id: hasRealCustomer
            ? workspace.stripe_customer_id
            : null,
          fk_db_instance_id: resolvedServerId ?? undefined,
        },
        transaction,
      );

      // Workspace owners → org OWNERs; other members → org VIEWERs.
      const seen = new Set<string>();
      for (const u of wsUsers) {
        if (!u.fk_user_id || seen.has(u.fk_user_id)) continue;
        seen.add(u.fk_user_id);
        await OrgUser.insert(
          {
            fk_org_id: org.id,
            fk_user_id: u.fk_user_id,
            roles:
              u.roles === WorkspaceUserRoles.OWNER
                ? CloudOrgUserRoles.OWNER
                : CloudOrgUserRoles.VIEWER,
          },
          transaction,
        );
      }

      // Once the workspace is under an org, billing flows through the org —
      // the workspace itself should not carry a Stripe customer.
      await Workspace.update(
        workspaceId,
        {
          fk_org_id: org.id,
          stripe_customer_id: null,
        },
        transaction,
      );

      if (subscription) {
        await Subscription.move(
          subscription.id,
          { fk_workspace_id: null, fk_org_id: org.id },
          transaction,
        );
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      // Best-effort cache invalidation in case anything was partially primed
      await NocoCache.del('root', `${CacheScope.WORKSPACE}:${workspaceId}`);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e?.message ?? String(e), e?.stack);
      return NcError.internalServerError('Failed to move workspace to new org');
    }

    // Note: do NOT invalidate the cloudDb connection cache here. Until
    // the migrate job below moves data into the org's `org.id` DB, the
    // workspace's bases still live in the source location. The processor
    // sets `fk_db_instance_id` on the workspace at the end of migration,
    // which triggers `resetWorkspaceDbServer` via `Workspace.update`.

    // Stripe metadata rebind — best-effort. DB is already consistent; if Stripe
    // call fails, webhook handlers will self-correct on next event using
    // workspace.fk_org_id resolution.
    try {
      if (hasRealCustomer) {
        // 1a. Existing customer: rebind metadata + invoice custom fields
        //     workspace → org. Stripe customer object is otherwise preserved.
        await stripe.customers.update(workspace.stripe_customer_id, {
          metadata: {
            fk_workspace_id: '',
            fk_org_id: org.id,
            entity: `org_${org.id}`,
          },
          invoice_settings: {
            custom_fields: [
              { name: 'NocoDB Org ID', value: org.id },
              { name: 'NocoDB Org Title', value: org.title },
            ],
          },
        });
      } else {
        // 1b. No real customer existed — mint a fresh Stripe customer for
        //     the org so a subscription can be created against it later.
        await this.createStripeCustomer(org.id, owners[0].fk_user_id, ncMeta);
      }

      if (subscription) {
        // 2. Subscription metadata
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          metadata: {
            fk_workspace_id: '',
            fk_org_id: org.id,
          },
        });

        // 3. Schedule phase metadata (phase metadata propagates to the live
        //    subscription on phase activation, so it must reflect the new org)
        if (subscription.stripe_schedule_id) {
          const schedule = await stripe.subscriptionSchedules.retrieve(
            subscription.stripe_schedule_id,
          );
          const phases = schedule.phases.map((phase, idx) => ({
            items: phase.items.map((item) => ({
              price:
                typeof item.price === 'string' ? item.price : item.price.id,
              quantity: item.quantity ?? 1,
            })),
            ...(idx > 0 ? { start_date: phase.start_date } : {}),
            ...(phase.end_date ? { end_date: phase.end_date } : {}),
            metadata: {
              ...(phase.metadata ?? {}),
              fk_workspace_id: '',
              fk_org_id: org.id,
            },
          }));
          await stripe.subscriptionSchedules.update(
            subscription.stripe_schedule_id,
            { phases },
          );
        }
      }
    } catch (e) {
      this.logger.error(
        `Failed to set up Stripe state for org ${org.id}: ${e?.message}`,
        e?.stack,
      );
    }

    // Move workspace data from `workspace.id` DB on its current server
    // to `org.id` DB on the org's server. Skipped only when both sides
    // already resolve to the same NC_DATA_DB shared bucket (workspace had
    // no dedicated server AND the org also got no dedicated server).
    const sourceServerId = workspace.fk_db_instance_id ?? null;
    const targetServerId = resolvedServerId ?? null;
    const skipMigration = sourceServerId === null && targetServerId === null;

    if (!skipMigration) {
      try {
        await this.nocoJobsService.add(JobTypes.CloudDbMigrate, {
          workspaceOrOrgId: workspaceId,
          targetOrgId: org.id,
          // Pass workspace's existing server only if it had one. When
          // omitted, the processor uses NC_DATA_DB defaults for the source
          // URL (with the default DB name) — correct for workspaces whose
          // schemas live in the shared NC_DATA_DB bucket.
          ...(sourceServerId ? { oldDbServerId: sourceServerId } : {}),
          // Fresh org → its DB does not yet exist on the target server.
          // Tell the migrator to create it.
          createTargetDb: true,
        });
      } catch (e) {
        this.logger.error(
          `Failed to queue CloudDbMigrate for workspace ${workspaceId} → org ${org.id}: ${e?.message}`,
          e?.stack,
        );
      }
    }

    // Re-fetch org so the response reflects post-Stripe state (a freshly
    // minted stripe_customer_id, if one was created).
    const finalOrg = (await Org.get(org.id, ncMeta)) ?? org;
    const moved = subscription
      ? await Subscription.get(subscription.id, ncMeta)
      : null;

    return { org: finalOrg, subscription: moved };
  }

  async addTrial(
    workspaceOrOrgId: string,
    planTitle: string,
    days: number,
    period: 'month' | 'year' = 'year',
    ncMeta = Noco.ncMeta,
  ) {
    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
    );

    if (existingSubscription) {
      NcError._.subscriptionAlreadyExists(workspaceOrOrgId);
    }

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const plans = await Plan.list(ncMeta);

    const plan = plans.find((p) => p.title === planTitle);

    if (!plan) {
      NcError.genericNotFound('Plan', planTitle);
    }

    // Find price for the plan based on period - exclude loyalty prices
    const price = plan.prices.find(
      (p) =>
        p.recurring?.interval === period &&
        (!p.lookup_key || !p.lookup_key.includes('loyalty')),
    );

    if (!price) {
      NcError.genericNotFound(
        'Price',
        `non-loyalty ${period}ly price for plan ${planTitle}`,
      );
    }

    // Get workspace owner for customer creation and metadata
    const owners = await WorkspaceUser.userList({
      fk_workspace_id:
        workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : undefined,
      roles: WorkspaceUserRoles.OWNER,
    });

    const owner = owners[0];
    if (!owner) {
      NcError.genericNotFound('Owner', workspaceOrOrgId);
    }

    const user = await User.get(owner.id, ncMeta);

    // Get or create Stripe customer
    let customerId = workspaceOrOrg.stripe_customer_id;

    if (!customerId || customerId === NOCODB_INTERNAL) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
          entity: `${workspaceOrOrg.entity}_${workspaceOrOrg.id}`,
        },
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      });

      customerId = customer.id;

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(workspaceOrOrg.id, {
          stripe_customer_id: customerId,
        });
      } else {
        await Org.update(workspaceOrOrg.id, {
          stripe_customer_id: customerId,
        });
      }
    }

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
    const trialEnd = dayjs().utc().add(days, 'day').unix();

    // Create Stripe subscription with trial
    // Cancel subscription if no payment method added by trial end
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: price.id,
          quantity: this.billableSeatCount(plan.title, seatCount),
        },
      ],
      trial_end: trialEnd,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      metadata: {
        ...(workspaceOrOrg.entity === 'workspace'
          ? { fk_workspace_id: workspaceOrOrg.id }
          : { fk_org_id: workspaceOrOrg.id }),
        fk_user_id: user.id,
        fk_plan_id: plan.id,
        plan_title: plan.title,
        period: price.recurring.interval,
      },
    });

    const trialEndAt = dayjs.unix(trialEnd).utc().toISOString();

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'trial_created',
      message: `Stripe trial subscription created for ${workspaceOrOrg.title} (${plan.title}) - ${days} days`,
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        stripe_subscription_id: stripeSubscription.id,
        plan_title: plan.title,
        trial_days: days,
        trial_end_at: trialEndAt,
      },
    });

    return {
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id: customerId,
      plan: plan.title,
      period: price.recurring.interval,
      status: stripeSubscription.status,
      trial_end_at: trialEndAt,
      seat_count: this.billableSeatCount(plan.title, seatCount),
    };
  }

  async customerUpdate(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      NcError.genericNotFound('Customer', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const customer = await stripe.customers.update(
      workspaceOrOrg.stripe_customer_id,
      {
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      },
    );

    return customer;
  }

  async createStripeCustomer(
    workspaceOrOrgId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const user = await User.get(userId, ncMeta);

    if (!user) {
      NcError.genericNotFound('User', userId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
          entity: `${workspaceOrOrg.entity}_${workspaceOrOrg.id}`,
        },
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      });

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      }
    }

    return workspaceOrOrg.stripe_customer_id;
  }

  async createSubscriptionForm(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
      returnToPage?: boolean;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const {
      seat,
      plan_id,
      price_id,
      returnToPage = ReturnToBillingPage.ACCOUNT,
    } = payload;

    const { user } = req;

    if (!seat || !plan_id || !price_id) {
      NcError._.invalidPaymentPayload();
    }

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existingSubscription && existingSubscription.status !== 'incomplete') {
      NcError._.subscriptionAlreadyExists(workspaceOrOrgId);
    }

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);

    if (seatCount !== seat) {
      NcError._.seatCountMismatch();
    }

    const plan = await Plan.get(plan_id, ncMeta);

    if (!plan) {
      NcError.genericNotFound('Plan', plan_id);
    }

    if (!plan.is_active) {
      NcError._.planNotAvailable();
    }

    const price = plan.prices.find((p) => p.id === price_id);

    if (!price) {
      NcError.genericNotFound('Price', price_id);
    }

    if (
      price.lookup_key.includes('loyalty') &&
      (!workspaceOrOrg.loyal ||
        workspaceOrOrg.loyalty_discount_used ||
        dayjs().isAfter(dayjs(LOYALTY_GRACE_PERIOD_END_DATE)))
    ) {
      NcError._.planNotAvailable();
    }

    if (workspaceOrOrg.stripe_customer_id) {
      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        NcError._.internalCustomerNotSupported();
      }

      const stripe_customer = await stripe.customers.retrieve(
        workspaceOrOrg.stripe_customer_id,
      );

      if (!stripe_customer || stripe_customer.deleted) {
        this.logger.error(
          `Stripe customer not found for ${workspaceOrOrg.entity} ${workspaceOrOrg.id} with id ${workspaceOrOrg.stripe_customer_id}`,
        );

        // Clear the customer id & recreate
        workspaceOrOrg.stripe_customer_id = null;
      }

      const customerSubscription = await stripe.subscriptions.list({
        customer: workspaceOrOrg.stripe_customer_id,
      });

      if (customerSubscription.data.length) {
        const subscription = customerSubscription.data.find(
          (s) =>
            ((s.metadata.fk_org_id &&
              s.metadata.fk_org_id === workspaceOrOrg.id) ||
              (s.metadata.fk_workspace_id &&
                s.metadata.fk_workspace_id === workspaceOrOrg.id)) &&
            ['active', 'trialing', 'incomplete'].includes(s.status),
        );

        if (subscription) {
          await this.recoverSubscription(workspaceOrOrg.id, ncMeta);
          return {
            recover: true,
          };
        }
      }
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
          entity: `${workspaceOrOrg.entity}_${workspaceOrOrg.id}`,
        },
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      });

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: price.id,
          quantity: this.billableSeatCount(plan.title, seat),
        },
      ],
      ui_mode: 'embedded',
      return_url: `${req.ncSiteUrl}/?afterPayment=true&workspaceId=${workspaceOrOrg.id}&session_id={CHECKOUT_SESSION_ID}&returnToPage=${returnToPage}`,
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: 'required',
      customer: workspaceOrOrg.stripe_customer_id,
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      tax_id_collection: {
        enabled: true,
      },
      subscription_data: {
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : {
                fk_org_id: workspaceOrOrg.id,
              }),
          fk_user_id: user.id,
          fk_plan_id: plan_id,
          plan_title: plan.title,
          period: price.recurring.interval,
        },
      },
      ...(workspaceOrOrg.segment_code === 1
        ? {
            allow_promotion_codes: true,
          }
        : {}),
    });

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'payment_triggered',
      message: `Payment checkout initiated for ${workspaceOrOrg.title} (${plan.title})`,
      user: { id: user.id, email: user.email },
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        checkout_session_id: session.id,
        plan_id,
        plan_title: plan.title,
        price_id,
        seat_count: seat,
        period: price.recurring.interval,
      },
    });

    return session;
  }

  async updateSubscription(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError._.internalCustomerNotSupported();
    }

    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const oldPlan = await Plan.get(existingSub.fk_plan_id, ncMeta, true);
    if (!oldPlan) NcError.genericNotFound('Plan', existingSub.fk_plan_id);
    const oldPrice = oldPlan.prices.find(
      (p) => p.id === existingSub.stripe_price_id,
    )!;

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
    if (seatCount !== payload.seat) {
      NcError._.seatCountMismatch();
    }

    // if nothing changed → clear any schedule + undelete if canceled
    if (
      oldPlan.id === payload.plan_id &&
      oldPrice.id === payload.price_id &&
      seatCount === payload.seat
    ) {
      // resume if user had previously canceled
      if (existingSub.canceled_at) {
        await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
          cancel_at_period_end: false,
        });
        await Subscription.update(
          existingSub.id,
          { canceled_at: null },
          ncMeta,
        );
        await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, ncMeta);
      } else {
        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);
      }

      return { id: existingSub.stripe_subscription_id };
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError._.stripeSubscriptionNotFound(existingSub.stripe_subscription_id);
    if (
      workspaceOrOrg.entity === 'workspace' &&
      stripeSub.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      NcError._.subscriptionOwnershipMismatch('workspace');
    }
    if (
      workspaceOrOrg.entity === 'org' &&
      stripeSub.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      NcError._.subscriptionOwnershipMismatch('org');
    }

    // Void any unpaid proration invoices before changing plan
    // Otherwise billing_cycle_anchor: 'now' resets the cycle and stale invoices
    // swallow proration credits
    await this.voidUnpaidProrationInvoices(existingSub, workspaceOrOrg);

    const newPlan = await Plan.get(payload.plan_id, ncMeta);
    if (!newPlan) NcError.genericNotFound('Plan', payload.plan_id);
    if (!newPlan.is_active) NcError._.planNotAvailable();
    const newPrice = newPlan.prices.find((p) => p.id === payload.price_id)!;
    if (!newPrice) NcError.genericNotFound('Price', payload.price_id);

    // allow loyalty discount only if the user has not used it yet
    if (
      newPrice.lookup_key.includes('loyalty') &&
      (!workspaceOrOrg.loyal || workspaceOrOrg.loyalty_discount_used)
    ) {
      NcError._.planNotAvailable();
    }

    const item = stripeSub.items.data[0];

    let updatedSubscription;

    // CASE: monthly-to-yearly or yearly-to-monthly (same plan or lower plan)
    if (
      newPrice.recurring.interval !== oldPrice.recurring.interval &&
      PlanOrder[oldPlan.title] >= PlanOrder[newPlan.title]
    ) {
      // Monthly to Yearly: immediate change with proration (invoice immediately) + reset billing cycle
      if (
        newPrice.recurring.interval === 'year' &&
        oldPrice.recurring.interval === 'month'
      ) {
        updatedSubscription = await stripe.subscriptions.update(stripeSub.id, {
          items: [
            {
              id: item.id,
              price: newPrice.id,
              quantity: this.billableSeatCount(newPlan.title, seatCount),
            },
          ],
          metadata: {
            ...(workspaceOrOrg.entity === 'workspace'
              ? { fk_workspace_id: workspaceOrOrg.id }
              : { fk_org_id: workspaceOrOrg.id }),
            fk_user_id: req.user.id,
            fk_plan_id: newPlan.id,
            plan_title: newPlan.title,
            period: newPrice.recurring.interval,
          },
          proration_behavior: 'always_invoice',
          billing_cycle_anchor: 'now',
        });

        await Subscription.update(
          existingSub.id,
          {
            fk_plan_id: newPlan.id,
            stripe_price_id: newPrice.id,
            period: newPrice.recurring.interval,
          },
          ncMeta,
        );

        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );

        return { id: stripeSub.id };
      }
      // Yearly to Monthly: schedule change at period end (no prorate)
      if (
        newPrice.recurring.interval === 'month' &&
        oldPrice.recurring.interval === 'year'
      ) {
        await this.schedulePlanChange(
          workspaceOrOrgId,
          newPrice,
          newPlan,
          {
            scheduleType: 'next',
          },
          ncMeta,
        );

        return {
          id: stripeSub.id,
          message: 'Plan change scheduled at period end',
        };
      }
    } else {
      // Yearly plan
      if (newPrice.recurring.interval === 'year') {
        // If the new price or plan is higher upgrade immediately (invoice now with prorations) + reset billing cycle
        if (
          !oldPrice ||
          calculateUnitPrice(newPrice, seatCount, newPrice.recurring.interval) >
            calculateUnitPrice(
              oldPrice,
              seatCount,
              oldPrice.recurring.interval as 'month' | 'year',
            ) ||
          PlanOrder[newPlan.title] > PlanOrder[oldPlan.title]
        ) {
          updatedSubscription = await stripe.subscriptions.update(
            stripeSub.id,
            {
              items: [
                {
                  id: item.id,
                  price: newPrice.id,
                  quantity: this.billableSeatCount(newPlan.title, seatCount),
                },
              ],
              metadata: {
                ...(workspaceOrOrg.entity === 'workspace'
                  ? { fk_workspace_id: workspaceOrOrg.id }
                  : { fk_org_id: workspaceOrOrg.id }),
                fk_user_id: req.user.id,
                fk_plan_id: newPlan.id,
                plan_title: newPlan.title,
                period: newPrice.recurring.interval,
              },
              proration_behavior: 'always_invoice',
              billing_cycle_anchor: 'now',
            },
          );

          await Subscription.update(
            existingSub.id,
            {
              fk_plan_id: newPlan.id,
              stripe_price_id: newPrice.id,
              period: newPrice.recurring.interval,
            },
            ncMeta,
          );

          await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

          await this.updateNextInvoice(
            existingSub.id,
            await this.getNextInvoice(workspaceOrOrgId, ncMeta),
            ncMeta,
          );

          return { id: updatedSubscription.id };
        } else {
          await this.schedulePlanChange(
            workspaceOrOrgId,
            newPrice,
            newPlan,
            {
              scheduleType: 'next',
            },
            ncMeta,
          );

          return {
            id: stripeSub.id,
            message: 'Plan downgrade scheduled at period end',
          };
        }
      } else {
        // Monthly plan: change immediately with proration (invoice now) + reset billing cycle
        updatedSubscription = await stripe.subscriptions.update(stripeSub.id, {
          items: [
            {
              id: item.id,
              price: newPrice.id,
              quantity: this.billableSeatCount(newPlan.title, seatCount),
            },
          ],
          metadata: {
            ...(workspaceOrOrg.entity === 'workspace'
              ? { fk_workspace_id: workspaceOrOrg.id }
              : { fk_org_id: workspaceOrOrg.id }),
            fk_user_id: req.user.id,
            fk_plan_id: newPlan.id,
            plan_title: newPlan.title,
            period: newPrice.recurring.interval,
          },
          proration_behavior: 'always_invoice',
          billing_cycle_anchor: 'now',
        });

        await Subscription.update(
          existingSub.id,
          {
            fk_plan_id: newPlan.id,
            stripe_price_id: newPrice.id,
            period: newPrice.recurring.interval,
          },
          ncMeta,
        );

        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );

        return { id: updatedSubscription.id };
      }
    }
  }

  async recalculateUpcomingInvoice(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) return;

    // update the next invoice
    await this.updateNextInvoice(
      existingSub.id,
      await this.getNextInvoice(workspaceOrOrgId, ncMeta),
      ncMeta,
    );
  }

  /**
   * Voids any unpaid proration invoices on a subscription.
   * Used before plan changes to clean up stale invoices that would
   * otherwise swallow proration credits when the billing cycle resets.
   */
  private async voidUnpaidProrationInvoices(
    existingSub: Subscription,
    workspaceOrOrg: NonNullable<Awaited<ReturnType<typeof getWorkspaceOrOrg>>>,
  ) {
    const [openInvoices, uncollectibleInvoices] = await Promise.all([
      stripe.invoices.list({
        customer: workspaceOrOrg.stripe_customer_id,
        status: 'open',
        subscription: existingSub.stripe_subscription_id,
        limit: 100,
      }),
      stripe.invoices.list({
        customer: workspaceOrOrg.stripe_customer_id,
        status: 'uncollectible',
        subscription: existingSub.stripe_subscription_id,
        limit: 100,
      }),
    ]);

    const prorationInvoices = [
      ...openInvoices.data,
      ...uncollectibleInvoices.data,
    ].filter((inv) =>
      inv.lines.data.some(
        (line) =>
          line.parent?.invoice_item_details?.proration ||
          line.parent?.subscription_item_details?.proration,
      ),
    );

    if (prorationInvoices.length === 0) return;

    this.logger.warn(
      `Voiding ${prorationInvoices.length} unpaid proration invoices for ${workspaceOrOrg.id} before plan change`,
    );

    for (const inv of prorationInvoices) {
      try {
        await stripe.invoices.voidInvoice(inv.id);
      } catch (e: any) {
        this.logger.warn(`Failed to void invoice ${inv.id}: ${e.message}`);
      }
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'proration_voided_before_plan_change',
      message: `Voided ${prorationInvoices.length} unpaid proration invoices for ${workspaceOrOrg.title} before plan change`,
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        voided_invoice_ids: prorationInvoices.map((i) => i.id),
        voided_invoice_amounts: prorationInvoices.map((i) => i.amount_due),
        subscription_id: existingSub.id,
      },
    });
  }

  /**
   * Consolidates unpaid proration invoices before a seat change.
   *
   * When proration invoices (from prior seat changes) go uncollectible or remain open,
   * subsequent seat changes produce invoices that prorate against unpaid state rather
   * than the last actually-paid state. This method:
   *
   * 1. Detects open/uncollectible invoices on the subscription
   * 2. Voids them (removing both the charge and the stale credit)
   * 3. Resets the Stripe subscription quantity to `last_paid_seat_count` (no proration)
   * 4. Updates to the new desired seat count (with proration from the correct base)
   *
   * If there are no unpaid invoices, it falls through to a normal subscription update.
   */
  private async consolidateUnpaidProrationInvoices(
    stripeSub: Stripe.Subscription,
    existingSub: Subscription,
    workspaceOrOrg: NonNullable<Awaited<ReturnType<typeof getWorkspaceOrOrg>>>,
    newSeatCount: number,
    minSeats = 1,
    _ncMeta = Noco.ncMeta,
  ) {
    // Fetch open and uncollectible invoices for this subscription
    const [openInvoices, uncollectibleInvoices] = await Promise.all([
      stripe.invoices.list({
        customer: workspaceOrOrg.stripe_customer_id,
        status: 'open',
        subscription: existingSub.stripe_subscription_id,
        limit: 100,
      }),
      stripe.invoices.list({
        customer: workspaceOrOrg.stripe_customer_id,
        status: 'uncollectible',
        subscription: existingSub.stripe_subscription_id,
        limit: 100,
      }),
    ]);

    const problematicInvoices = [
      ...openInvoices.data,
      ...uncollectibleInvoices.data,
    ];

    if (problematicInvoices.length === 0) {
      // No unpaid invoices — proceed with normal subscription update
      await stripe.subscriptions.update(stripeSub.id, {
        items: [
          {
            id: stripeSub.items.data[0].id,
            price: existingSub.stripe_price_id,
            quantity: newSeatCount,
          },
        ],
        ...(existingSub.period === 'year' || existingSub.stripe_schedule_id
          ? { proration_behavior: 'always_invoice' }
          : {}),
      });
      return;
    }

    // Only void proration invoices — not renewal invoices.
    // Proration invoices have at least one line item with proration=true.
    const prorationInvoices = problematicInvoices.filter((inv) =>
      inv.lines.data.some(
        (line) =>
          line.parent?.invoice_item_details?.proration ||
          line.parent?.subscription_item_details?.proration,
      ),
    );

    if (prorationInvoices.length === 0) {
      // Only renewal invoices are unpaid — proceed with normal update
      // (don't void renewal invoices as that would erase legitimate charges)
      await stripe.subscriptions.update(stripeSub.id, {
        items: [
          {
            id: stripeSub.items.data[0].id,
            price: existingSub.stripe_price_id,
            quantity: newSeatCount,
          },
        ],
        ...(existingSub.period === 'year' || existingSub.stripe_schedule_id
          ? { proration_behavior: 'always_invoice' }
          : {}),
      });
      return;
    }

    // Determine the last paid seat count
    const lastPaidSeatCount =
      existingSub.last_paid_seat_count ?? existingSub.seat_count;

    this.logger.warn(
      `Consolidating ${prorationInvoices.length} unpaid proration invoices for ${workspaceOrOrg.id}. ` +
        `Resetting from ${stripeSub.items.data[0].quantity} seats to last paid state (${lastPaidSeatCount}), ` +
        `then updating to ${newSeatCount} seats.`,
    );

    // Step 1: Void all unpaid proration invoices
    for (const inv of prorationInvoices) {
      try {
        await stripe.invoices.voidInvoice(inv.id);
      } catch (e: any) {
        this.logger.warn(`Failed to void invoice ${inv.id}: ${e.message}`);
      }
    }

    // Step 2: Reset subscription to last paid seat count (no proration)
    // This aligns Stripe's internal state with what was actually paid for
    await stripe.subscriptions.update(stripeSub.id, {
      items: [
        {
          id: stripeSub.items.data[0].id,
          price: existingSub.stripe_price_id,
          quantity: Math.max(lastPaidSeatCount, minSeats),
        },
      ],
      proration_behavior: 'none',
    });

    // Step 3: Update to the new desired seat count (with proration)
    // Skip if the new count equals the last paid count — no proration needed
    if (newSeatCount !== lastPaidSeatCount) {
      await stripe.subscriptions.update(stripeSub.id, {
        items: [
          {
            id: stripeSub.items.data[0].id,
            price: existingSub.stripe_price_id,
            quantity: newSeatCount,
          },
        ],
        proration_behavior: 'always_invoice',
      });
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'proration_consolidated',
      message:
        `Consolidated ${prorationInvoices.length} unpaid proration invoices for ${workspaceOrOrg.title}. ` +
        `Reset from ${stripeSub.items.data[0].quantity} to ${lastPaidSeatCount} (last paid), ` +
        `then updated to ${newSeatCount} seats.`,
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        voided_invoice_ids: prorationInvoices.map((i) => i.id),
        voided_invoice_amounts: prorationInvoices.map((i) => i.amount_due),
        last_paid_seat_count: lastPaidSeatCount,
        new_seat_count: newSeatCount,
        subscription_id: existingSub.id,
      },
    });
  }

  // The minimum-seat floor is applied at every Stripe quantity WRITE site
  // (create/checkout/update/reseat/schedule/invoice-preview), so any
  // subscription that ever changes seats is corrected to its plan minimum.
  // DB `seat_count` stays the raw member count; the floor lives only in the
  // values sent to Stripe. No retroactive backfill is needed — Scale (the only
  // plan with a >1 minimum) launches fresh and all creation paths already floor.
  async reseatSubscriptionAwaited(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    const lockId = nanoid();
    const lockKey = `reseatSubscription:${workspaceOrOrgId}`;
    let lockAcquired = false;

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg) return;

    // if the workspace is a child of an org, we need to use the org id
    if (workspaceOrOrg.entity === 'workspace') {
      if (workspaceOrOrg?.fk_org_id) {
        workspaceOrOrgId = workspaceOrOrg.fk_org_id;
      }
    }

    try {
      // Acquire lock with retry logic
      lockAcquired = await acquireLock(lockKey, lockId);

      if (!lockAcquired) {
        // we use soft lock, so we proceed even if not acquired
        this.logger.warn(
          `Failed to acquire lock for workspace ${workspaceOrOrgId} after maximum wait time`,
        );
      }

      const existingSub = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );
      if (!existingSub) return;

      const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
      if (existingSub.seat_count === seatCount) return;

      const billingPlan = await Plan.get(existingSub.fk_plan_id, ncMeta, true);
      const billableSeats = this.billableSeatCount(
        billingPlan?.title,
        seatCount,
      );

      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        await Subscription.update(
          existingSub.id,
          { seat_count: seatCount, last_paid_seat_count: seatCount },
          ncMeta,
        );
      } else {
        const stripeSub = await stripe.subscriptions.retrieve(
          existingSub.stripe_subscription_id,
        );
        if (!stripeSub)
          NcError._.stripeSubscriptionNotFound(
            existingSub.stripe_subscription_id,
          );
        if (
          stripeSub.metadata.fk_workspace_id &&
          stripeSub.metadata.fk_workspace_id !== existingSub.fk_workspace_id
        ) {
          NcError._.subscriptionOwnershipMismatch('workspace');
        }
        if (
          stripeSub.metadata.fk_org_id &&
          stripeSub.metadata.fk_org_id !== existingSub.fk_org_id
        ) {
          NcError._.subscriptionOwnershipMismatch('org');
        }

        // Consolidate unpaid proration invoices before updating subscription
        // This prevents the proration chain from breaking when invoices go uncollectible
        await this.consolidateUnpaidProrationInvoices(
          stripeSub,
          existingSub,
          workspaceOrOrg,
          billableSeats,
          getMinSeats(billingPlan?.title),
          ncMeta,
        );

        await Subscription.update(
          existingSub.id,
          { seat_count: seatCount },
          ncMeta,
        );

        // if there is a schedule, update it too
        if (existingSub.stripe_schedule_id) {
          const stripePrice = await stripe.prices.retrieve(
            existingSub.schedule_stripe_price_id,
          );

          // update the schedule
          await this.schedulePlanChange(
            workspaceOrOrgId,
            stripePrice,
            await Plan.get(existingSub.schedule_fk_plan_id, ncMeta, true),
            {
              scheduleType: existingSub.schedule_type,
            },
            ncMeta,
          );
        }

        // update the next invoice
        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );
      }
    } catch (err) {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
      await this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'reseatSubscription',
        error_type: err?.name,
        message: err?.message,
        error_details: err?.stack,
        affected_resources: [
          workspaceOrOrgId,
          workspaceOrOrg?.title,
          initiator,
        ],
      });
      throw err; // Re-throw to ensure proper error handling
    } finally {
      // Always release the lock if we acquired it
      if (lockAcquired) {
        await releaseLock(lockKey, lockId);
      }
    }
  }

  async reseatSubscription(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    if (!process.env.NC_STRIPE_SECRET_KEY) return;

    try {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
      if (!workspaceOrOrg) return;

      // if the workspace is a child of an org, we need to use the org id
      if (workspaceOrOrg.entity === 'workspace') {
        if (workspaceOrOrg?.fk_org_id) {
          workspaceOrOrgId = workspaceOrOrg.fk_org_id;
        }
      }

      const existingSub = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );
      if (!existingSub) return;

      const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);

      // No change in seat count
      if (existingSub.seat_count === seatCount) return;

      // If reducing seats, do it immediately
      if (existingSub.seat_count > seatCount) {
        return this.reseatSubscriptionImmediate(
          workspaceOrOrgId,
          ncMeta,
          initiator,
        );
      }
    } catch (e) {
      // Fall back to immediate reseat on error
      return this.reseatSubscriptionImmediate(
        workspaceOrOrgId,
        ncMeta,
        initiator,
      );
    }

    // If increasing seats, schedule a delayed job to batch multiple requests

    // Remove any existing delayed jobs for this workspace/org
    // Bull will deduplicate jobs with the same jobId
    const jobId = `reseat-${workspaceOrOrgId}`;
    let timestamp = Date.now();

    try {
      // Check if there's an existing delayed job and remove it
      const existingJob = await this.nocoJobsService.getJob(jobId);
      if (existingJob) {
        const jobState = await existingJob.getState();

        // If the existing job is still waiting or delayed, check if we are within the max delay window
        if (['waiting', 'delayed'].includes(jobState)) {
          const data = existingJob.data as ReseatSubscriptionJobData;

          this.logger.log(
            `Time passed since last reseat request for workspace/org ${workspaceOrOrgId}: ${
              timestamp - data.timestamp
            } ms (jobId: ${jobId})`,
          );

          timestamp = data.timestamp;
        }

        await existingJob.remove();
      }
    } catch (e) {
      // Job doesn't exist, continue
    }

    if (Date.now() - timestamp > RESEAT_MAX_DELAY_MS) {
      // If the last request was more than the max delay ago, do an immediate reseat
      this.logger.log(
        `Max delay exceeded for workspace/org ${workspaceOrOrgId}, performing immediate reseat (jobId: ${jobId})`,
      );
      return this.reseatSubscriptionImmediate(
        workspaceOrOrgId,
        ncMeta,
        initiator,
      );
    }

    // Schedule a new delayed job
    // Bull's jobId ensures that only one job with this ID exists at a time
    await this.nocoJobsService.add(
      JobTypes.ReseatSubscription,
      {
        workspaceOrOrgId,
        initiator,
        jobName: JobTypes.ReseatSubscription,
        timestamp,
      } as ReseatSubscriptionJobData,
      {
        jobId,
        delay: RESEAT_DELAY_MS,
      },
    );

    this.logger.log(
      `Scheduled reseat for workspace/org ${workspaceOrOrgId} in ${
        RESEAT_DELAY_MS / 1000
      } seconds (jobId: ${jobId})`,
    );
  }

  async reseatSubscriptionImmediate(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    if (!process.env.NC_STRIPE_SECRET_KEY) return;

    // we don't want to block the request
    this.reseatSubscriptionAwaited(workspaceOrOrgId, ncMeta, initiator).catch(
      () => {
        // we handle the error in the promise
      },
    );
  }

  async cancelSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError._.internalCustomerNotSupported();
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError._.stripeSubscriptionNotFound(existingSub.stripe_subscription_id);

    if (
      workspaceOrOrg.entity === 'workspace' &&
      stripeSub.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      NcError._.subscriptionOwnershipMismatch('workspace');
    }
    if (
      workspaceOrOrg.entity === 'org' &&
      stripeSub.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      NcError._.subscriptionOwnershipMismatch('org');
    }

    // release the schedule if it exists
    if (existingSub.stripe_schedule_id) {
      await stripe.subscriptionSchedules.release(
        existingSub.stripe_schedule_id,
      );
    }

    const canceled = await stripe.subscriptions.update(stripeSub.id, {
      cancel_at_period_end: true,
    });

    await Subscription.update(
      existingSub.id,
      {
        status: canceled.status,
        canceled_at: canceled.cancel_at
          ? dayjs.unix(canceled.cancel_at).utc().toISOString()
          : null,
        stripe_schedule_id: null,
        schedule_phase_start: null,
        schedule_stripe_price_id: null,
        schedule_fk_plan_id: null,
        schedule_period: null,
        schedule_type: null,
      },
      ncMeta,
    );

    return canceled.id;
  }

  async getCheckoutSession(workspaceOrOrgId: string, sessionId: string) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError._.internalCustomerNotSupported();
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      NcError.genericNotFound('Checkout session', sessionId);
    }

    if (session.invoice) {
      const invoice = await stripe.invoices.retrieve(session.invoice as string);

      Object.assign(session, {
        invoice,
      });
    }

    return session;
  }

  async getCustomerPortal(
    workspaceOrOrgId: string,
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError._.internalCustomerNotSupported();
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: workspaceOrOrg.stripe_customer_id,
      return_url: `${req.ncSiteUrl}?afterManage=true&workspaceId=${
        workspaceOrOrg.id
      }&returnToPage=${req.query.returnToPage ?? ReturnToBillingPage.ACCOUNT}`,
    });

    return session;
  }

  /**
   * Seats to actually bill Stripe for: the raw member count floored at the
   * plan's minimum. Cap is NOT applied here — Plus/Business caps are enforced
   * by their Stripe tiered prices; Scale/Enterprise are per-unit (uncapped).
   */
  private billableSeatCount(
    planTitle: PlanTitles | string | undefined,
    rawSeats: number | undefined,
  ): number {
    return Math.max(rawSeats ?? 0, getMinSeats(planTitle));
  }

  async getSeatCount(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.entity === 'workspace') {
      return (
        await Subscription.calculateWorkspaceSeatCount(
          workspaceOrOrg.id,
          ncMeta,
        )
      ).seatCount;
    }

    return Subscription.calculateOrgSeatCount(workspaceOrOrg.id, ncMeta);
  }

  async getNextInvoice(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    try {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

      if (!workspaceOrOrg) {
        NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
      }

      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        return;
      }

      const subscription = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrg.id,
        ncMeta,
      );

      if (!subscription) {
        NcError.genericNotFound('Subscription', workspaceOrOrgId);
      }

      const previewPlan = await Plan.get(
        subscription.schedule_fk_plan_id ?? subscription.fk_plan_id,
        ncMeta,
        true,
      );
      const previewSeats = this.billableSeatCount(
        previewPlan?.title,
        subscription.seat_count,
      );

      let invoice;

      if (subscription.period === 'year') {
        if (subscription.schedule_stripe_price_id) {
          invoice = await stripe.invoices.createPreview({
            subscription_details: {
              items: [
                {
                  price: subscription.schedule_stripe_price_id,
                  quantity: previewSeats,
                },
              ],
              start_date: dayjs(subscription.schedule_phase_start).unix(),
            },
          });
        } else {
          invoice = await stripe.invoices.createPreview({
            customer: workspaceOrOrg.stripe_customer_id,
            subscription: subscription.stripe_subscription_id,
          });
        }
      } else {
        if (subscription.schedule_stripe_price_id) {
          // Calculate the start of the month for the scheduled phase start month
          const scheduleStart = dayjs(subscription.schedule_phase_start)
            .startOf('month')
            .unix();

          // Check if the schedule start is within the next month
          // This ensures that the schedule is relevant for the upcoming invoice
          if (
            scheduleStart <= dayjs().add(1, 'month').startOf('month').unix()
          ) {
            invoice = await stripe.invoices.createPreview({
              subscription_details: {
                items: [
                  {
                    price: subscription.schedule_stripe_price_id,
                    quantity: previewSeats,
                  },
                ],
                start_date: scheduleStart,
              },
            });
          }
        }

        // If no invoice was created for the schedule, fall back to the current subscription
        if (!invoice) {
          invoice = await stripe.invoices.createPreview({
            customer: workspaceOrOrg.stripe_customer_id,
            subscription: subscription.stripe_subscription_id,
          });
        }
      }

      return invoice;
    } catch (err) {
      // invoice_upcoming_none is expected for trialing subscriptions with missing_payment_method: 'cancel'
      if (err?.code === 'invoice_upcoming_none') {
        this.logger.log(
          `No upcoming invoice for workspace or org ${workspaceOrOrgId} (likely trialing with cancel behavior)`,
        );
        return null;
      }
      this.logger.error(
        `Error getting next invoice for workspace or org ${workspaceOrOrgId}:`,
      );
      this.logger.error(err);
    }
  }

  async listInvoice(
    workspaceOrOrgId: string,
    options: {
      starting_after?: string;
      ending_before?: string;
    } = {},
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return { data: [] };
    }

    const invoices = await stripe.invoices.list({
      customer: workspaceOrOrg.stripe_customer_id,
      limit: 10,
      starting_after: options.starting_after,
      ending_before: options.ending_before,
    });

    if (!invoices) {
      NcError.genericNotFound('Invoices', workspaceOrOrgId);
    }

    return invoices;
  }

  async updateNextInvoice(
    subscriptionId: string,
    invoice: Stripe.Response<Stripe.UpcomingInvoice>,
    ncMeta = Noco.ncMeta,
  ) {
    try {
      if (invoice) {
        await Subscription.update(
          subscriptionId,
          {
            upcoming_invoice_at: dayjs
              .unix(invoice.period_end)
              .utc()
              .toISOString(),
            upcoming_invoice_due_at:
              invoice.next_payment_attempt || invoice.due_date
                ? dayjs
                    .unix(invoice.next_payment_attempt || invoice.due_date)
                    .utc()
                    .toISOString()
                : null,
            upcoming_invoice_amount: invoice.amount_due,
            upcoming_invoice_currency: invoice.currency,
          },
          ncMeta,
        );
      } else {
        await Subscription.update(
          subscriptionId,
          {
            upcoming_invoice_at: null,
            upcoming_invoice_due_at: null,
            upcoming_invoice_amount: null,
            upcoming_invoice_currency: null,
          },
          ncMeta,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error updating next invoice for subscription ${subscriptionId}:`,
      );
      this.logger.error(err);
    }
  }

  async recoverSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError._.internalCustomerNotSupported();
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existingSubscription) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        existingSubscription.stripe_subscription_id,
      );

      if (!stripeSubscription) {
        NcError._.stripeSubscriptionNotFound(
          existingSubscription.stripe_subscription_id,
        );
      }

      if (
        workspaceOrOrg.entity === 'workspace' &&
        stripeSubscription.metadata.fk_workspace_id !== workspaceOrOrgId
      ) {
        NcError._.subscriptionOwnershipMismatch('workspace');
      }

      if (
        workspaceOrOrg.entity === 'org' &&
        stripeSubscription.metadata.fk_org_id !== workspaceOrOrgId
      ) {
        NcError._.subscriptionOwnershipMismatch('org');
      }

      await Subscription.update(existingSubscription.id, {
        stripe_price_id: stripeSubscription.items.data[0].price.id,
        seat_count: stripeSubscription.items.data[0].quantity,
        fk_plan_id: stripeSubscription.metadata.fk_plan_id,
        stripe_subscription_id: stripeSubscription.id,
        fk_workspace_id: stripeSubscription.metadata.fk_workspace_id || null,
        fk_org_id: stripeSubscription.metadata.fk_org_id || null,
        status: stripeSubscription.status,
        canceled_at: stripeSubscription.canceled_at
          ? dayjs.unix(stripeSubscription.canceled_at).utc().toISOString()
          : null,
        start_at: dayjs.unix(stripeSubscription.start_date).utc().toISOString(),
        period: stripeSubscription.items.data[0].price.recurring.interval,
        billing_cycle_anchor: dayjs
          .unix(stripeSubscription.billing_cycle_anchor)
          .utc()
          .toISOString(),
      });

      if (stripeSubscription.status === 'active') {
        await this.updateNextInvoice(
          existingSubscription.id,
          await this.getNextInvoice(workspaceOrOrg.id),
          ncMeta,
        );
      }

      this.clearBaseListCacheForEntity(workspaceOrOrg);

      return existingSubscription;
    }

    const stripeCustomer = await stripe.customers.retrieve(
      workspaceOrOrg.stripe_customer_id,
    );

    if (!stripeCustomer) {
      NcError._.stripeCustomerNotFound(workspaceOrOrg.stripe_customer_id);
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
    });

    if (!subscriptions.data.length) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const subscriptionData = subscriptions.data.find(
      (s) =>
        ((s.metadata.fk_org_id && s.metadata.fk_org_id === workspaceOrOrg.id) ||
          (s.metadata.fk_workspace_id &&
            s.metadata.fk_workspace_id === workspaceOrOrg.id)) &&
        ['active', 'trialing', 'incomplete'].includes(s.status),
    );

    if (!subscriptionData) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const plan = await Plan.get(
      subscriptionData.metadata.fk_plan_id,
      ncMeta,
      true,
    );

    if (!plan) {
      NcError.genericNotFound('Plan', subscriptionData.metadata.fk_plan_id);
    }

    const price = plan.prices.find(
      (p) => p.id === subscriptionData.items.data[0].price.id,
    );

    if (!price) {
      NcError.genericNotFound('Price', subscriptionData.items.data[0].price.id);
    }

    const subscription = await Subscription.insert({
      fk_workspace_id:
        workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
      fk_org_id: workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
      fk_plan_id: plan.id,
      stripe_subscription_id: subscriptionData.id,
      stripe_price_id: price.id,
      seat_count: subscriptionData.items.data[0].quantity,
      last_paid_seat_count: subscriptionData.items.data[0].quantity,
      status: subscriptionData.status,
      start_at: dayjs.unix(subscriptionData.start_date).utc().toISOString(),
      period: price.recurring.interval,
      billing_cycle_anchor: dayjs
        .unix(subscriptionData.billing_cycle_anchor)
        .utc()
        .toISOString(),
    });

    await this.migrateDb(workspaceOrOrg.id, ncMeta);

    if (subscriptionData.status === 'active') {
      await this.updateNextInvoice(
        subscription.id,
        await this.getNextInvoice(workspaceOrOrg.id),
        ncMeta,
      );
    }

    this.logger.log(
      `Subscription recovered for workspace or org ${workspaceOrOrg.id}`,
    );

    return subscription;
  }

  async recountWorkspace(workspaceId: string) {
    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      NcError.genericNotFound('Workspace', workspaceId);
    }

    await ModelStat.deleteByWorkspaceId(workspaceId);

    await this.nocoJobsService.add(
      JobTypes.UpdateWsStat,
      {
        fk_workspace_id: workspaceId,
        force: true,
      },
      {
        jobId: `update-ws-stat:${workspaceId}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    return { queued: true };
  }

  async schedulePlanChange(
    workspaceOrOrgId: string,
    newPrice: Stripe.Price,
    newPlan: Plan,
    options: {
      scheduleType: 'year' | 'next';
    } = {
      scheduleType: 'next',
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { scheduleType } = options;

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existing) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const stripeSub = await stripe.subscriptions.retrieve(
      existing.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError._.stripeSubscriptionNotFound(existing.stripe_subscription_id);

    let scheduleId = existing.stripe_schedule_id;
    let sched: Stripe.SubscriptionSchedule | null = null;
    if (!scheduleId) {
      sched = await stripe.subscriptionSchedules.create({
        from_subscription: stripeSub.id,
      });
      scheduleId = sched.id;
    } else {
      sched = await stripe.subscriptionSchedules.retrieve(scheduleId);

      // if the schedule is not active, we need to create a new one
      if (!['not_started', 'active'].includes(sched.status)) {
        sched = await stripe.subscriptionSchedules.create({
          from_subscription: stripeSub.id,
        });
        scheduleId = sched.id;
      }
    }

    const firstPhase = sched.phases[0];
    const currentPlan = await Plan.get(existing.fk_plan_id, ncMeta, true);
    const existingPeriod = existing.period;

    const iterationsObject: { iterations?: number } = { iterations: 1 };
    if (scheduleType === 'year') {
      iterationsObject.iterations = existingPeriod === 'year' ? 1 : 12;
    }

    const preservedPhase = {
      start_date: firstPhase.start_date,
      items: firstPhase.items.map((item) => ({
        price: typeof item.price === 'string' ? item.price : item.price.id,
        quantity: this.billableSeatCount(
          currentPlan?.title,
          existing.seat_count,
        ),
      })),
      ...iterationsObject,
    };

    const changePhase = {
      items: [
        {
          price: newPrice.id,
          quantity: this.billableSeatCount(newPlan.title, existing.seat_count),
        },
      ],
      metadata: {
        ...(stripeSub.metadata.fk_workspace_id && {
          fk_workspace_id: stripeSub.metadata.fk_workspace_id,
        }),
        ...(stripeSub.metadata.fk_org_id && {
          fk_org_id: stripeSub.metadata.fk_org_id,
        }),
        fk_user_id: stripeSub.metadata.fk_user_id,
        fk_plan_id: newPlan.id,
        plan_title: newPlan.title,
        period: newPrice.recurring.interval,
      },
    };

    const newSchedule = await stripe.subscriptionSchedules.update(scheduleId, {
      phases: [preservedPhase, changePhase],
      end_behavior: 'release',
      metadata: {
        schedule_type: scheduleType,
      },
    });

    const lastPhase = newSchedule.phases[newSchedule.phases.length - 1];

    await Subscription.update(
      existing.id,
      {
        stripe_schedule_id: scheduleId,
        schedule_phase_start: dayjs
          .unix(lastPhase.start_date)
          .utc()
          .toISOString(),
        schedule_stripe_price_id: newPrice.id,
        schedule_fk_plan_id: newPlan.id,
        schedule_period: newPrice.recurring.interval,
        schedule_type: scheduleType,
      },
      ncMeta,
    );

    await this.updateNextInvoice(
      existing.id,
      await this.getNextInvoice(workspaceOrOrgId, ncMeta),
      ncMeta,
    );
  }

  async scheduleLoyaltyDowngrade(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existing) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const plan = await Plan.get(existing.fk_plan_id, ncMeta, true);
    if (!plan) NcError.genericNotFound('Plan', existing.fk_plan_id);

    // find the loyalty vs. normal pair
    const loyaltyPrice = plan.prices.find(
      (p) => p.id === existing.stripe_price_id,
    );
    const normalPrice = plan.prices.find(
      (p) =>
        p.lookup_key ===
        LoyaltyPriceReverseLookupKeyMap[loyaltyPrice.lookup_key],
    );

    if (!loyaltyPrice || !normalPrice) {
      this.logger.log(`No loyalty/normal pair found for plan ${plan.id}`);
      return;
    }

    await this.schedulePlanChange(
      workspaceOrOrgId,
      normalPrice,
      plan,
      {
        scheduleType: 'year',
      },
      ncMeta,
    );
  }

  async clearScheduledDowngrade(
    workspaceOrOrgId: string,
    release = true,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    try {
      if (existing?.stripe_schedule_id && release) {
        await stripe.subscriptionSchedules.release(existing.stripe_schedule_id);
      }
    } catch (err) {
      this.logger.error(
        `Error clearing scheduled downgrade for workspace or org ${workspaceOrOrgId}: ${err.message}`,
      );
    }

    const existingPlan = await Plan.get(existing.fk_plan_id, ncMeta, true);

    const existingPrice = existingPlan.prices.find(
      (p) => p.id === existing.stripe_price_id,
    );

    if (existingPrice?.lookup_key.includes('loyalty')) {
      await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, ncMeta);
    } else {
      await Subscription.update(
        existing.id,
        {
          stripe_schedule_id: null,
          schedule_phase_start: null,
          schedule_stripe_price_id: null,
          schedule_fk_plan_id: null,
          schedule_period: null,
          schedule_type: null,
        },
        ncMeta,
      );
    }
  }

  async migrateDb(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    try {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);
      if (!workspaceOrOrg)
        NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

      // Already on a dedicated db server — skip (prevents re-migration on recurring payments)
      if (workspaceOrOrg.fk_db_instance_id) {
        return;
      }

      const subRec = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );
      if (!subRec) NcError.genericNotFound('Subscription', workspaceOrOrgId);

      const plan = await Plan.get(subRec.fk_plan_id, ncMeta);
      if (!plan) NcError.genericNotFound('Plan', subRec.fk_plan_id);

      await this.nocoJobsService.add(JobTypes.CloudDbMigrate, {
        workspaceOrOrgId,
        conditions:
          workspaceOrOrg.entity === 'org'
            ? {
                fk_org_id: workspaceOrOrg.id,
              }
            : {
                plan: plan.title,
              },
        oldDbServerId: workspaceOrOrg.fk_db_instance_id,
      });
    } catch (err) {
      this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'migrateDb',
        error_type: err?.name,
        message: err?.message,
        error_details: err?.stack,
        affected_resources: [workspaceOrOrgId],
      });
    }
  }

  async requestUpgrade(
    workspaceOrOrgId: string,
    payload: {
      limitOrFeature: PlanLimitTypes | PlanFeatureTypes;
    },
    req: NcRequest,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const requester = req.user?.id
      ? req.user
      : {
          display_name: 'Anonymous',
        };

    if (!req.user?.id) {
      const requestedAt = await NocoCache.get(
        'root',
        `requestUpgrade:${workspaceOrOrgId}`,
        CacheGetType.TYPE_STRING,
      );

      if (requestedAt) {
        const requestedAtTime = dayjs(requestedAt);
        const now = dayjs();

        if (requestedAtTime.isAfter(now.subtract(1, 'hour'))) {
          return true;
        }
      } else {
        await NocoCache.set(
          'root',
          `requestUpgrade:${workspaceOrOrgId}`,
          dayjs().toISOString(),
        );
      }
    } else {
      // check if the user part of the workspace or org
      const user = await WorkspaceUser.get(workspaceOrOrgId, req.user.id);

      if (!user) {
        NcError.workspaceNotFound(workspaceOrOrgId);
      }
    }

    if (workspaceOrOrg.entity === 'workspace') {
      const workspace = workspaceOrOrg as Workspace;

      const owners = await WorkspaceUser.userList({
        fk_workspace_id: workspace.id,
        roles: WorkspaceUserRoles.OWNER,
      });

      if (!owners.length) {
        NcError.genericNotFound('Owners', workspace.id);
      }

      for (const owner of owners) {
        this.appHooksService.emit(AppEvents.WORKSPACE_UPGRADE_REQUEST, {
          context: {
            workspace_id: workspace.id,
            base_id: undefined,
          },
          workspace,
          requester,
          user: owner,
          limitOrFeature: payload.limitOrFeature,
          req,
        });
      }

      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'upgrade_requested',
        message: `Upgrade requested for ${workspace.title} ${getUpgradeMessage(
          payload.limitOrFeature,
        )}`,
        user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
        workspace: { id: workspace.id, title: workspace.title },
        extra: {
          limit_or_feature: payload.limitOrFeature,
          requester_type: req.user?.id ? 'authenticated' : 'anonymous',
          requester_name: requester.display_name || 'Unknown',
          owner_count: owners.length,
        },
      });
    }

    return true;
  }

  async handleWebhook(req: NcRequest): Promise<void> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.NC_STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      this.logger.error('⚠️  Webhook signature verification failed:', err);
      return;
    }

    const obj = event.data.object as Stripe.Invoice | Stripe.Subscription;

    try {
      switch (event.type) {
        case 'invoice.paid': {
          const invoiceObj = obj as Stripe.Invoice;

          const subscriptionId =
            typeof invoiceObj.parent.subscription_details.subscription ===
            'string'
              ? invoiceObj.parent.subscription_details.subscription
              : invoiceObj.parent.subscription_details.subscription?.id || '';

          let subRec: Subscription;
          let attempt = 0;

          // Retry as subscription sometimes takes a while to be created
          while (attempt < 10) {
            subRec = await Subscription.getByStripeSubscriptionId(
              subscriptionId,
            );
            if (subRec) break;
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }

          if (!subRec) NcError.genericNotFound('Subscription', subscriptionId);

          // Update last_paid_seat_count to current subscription quantity
          // This anchors the proration chain so consolidation knows the last paid state
          // Must run before the on-prem early return so on-prem subs also get updated
          const paidStripeSub = await stripe.subscriptions.retrieve(
            subRec.stripe_subscription_id,
          );
          if (paidStripeSub) {
            const paidSeatCount = paidStripeSub.items.data[0].quantity;
            await Subscription.update(subRec.id, {
              last_paid_seat_count: paidSeatCount,
            });
          }

          // On-prem subscriptions: emit alert and stop (no workspace/org logic)
          if (!subRec.fk_org_id && !subRec.fk_workspace_id) {
            this.logger.log(
              `Invoice paid for on-prem subscription ${subRec.id} — dispatching on-prem handler`,
            );
            await this.handleOnPremInvoicePaid(invoiceObj);
            break;
          }

          const workspaceOrOrgId = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );

          this.migrateDb(workspaceOrOrgId).catch(() => {});

          await this.updateNextInvoice(
            subRec.id,
            await this.getNextInvoice(workspaceOrOrgId),
          );

          if (workspaceOrOrg) {
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'payment_succeeded',
              message: `Payment successful for ${workspaceOrOrg.title}`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
              extra: {
                subscription_id: subRec.id,
                stripe_subscription_id: subRec.stripe_subscription_id,
                invoice_id: (obj as Stripe.Invoice).id,
                amount_paid: (obj as Stripe.Invoice).amount_paid,
              },
            });
          }

          this.logger.log(
            `Invoice paid; next invoice scheduled for subscription ${subRec.id}`,
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoiceObj = obj as Stripe.Invoice;

          const subscriptionId =
            typeof invoiceObj.parent.subscription_details.subscription ===
            'string'
              ? invoiceObj.parent.subscription_details.subscription
              : invoiceObj.parent.subscription_details.subscription?.id || '';

          const subRec = await Subscription.getByStripeSubscriptionId(
            subscriptionId,
          );
          if (!subRec) NcError.genericNotFound('Subscription', subscriptionId);

          // On-prem subscriptions: emit alert and stop (no workspace/org logic)
          if (!subRec.fk_org_id && !subRec.fk_workspace_id) {
            this.logger.log(
              `Invoice payment failed for on-prem subscription ${subRec.id} — dispatching on-prem handler`,
            );
            await this.handleOnPremInvoicePaymentFailed(invoiceObj);
            break;
          }

          const wid = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(wid, Noco.ncMeta);

          // Send upgrade_failed notification for payment failure
          if (workspaceOrOrg) {
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'payment_failed',
              message: `Payment failed for ${workspaceOrOrg.title}. No plan applied.`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
              extra: {
                subscription_id: subRec.id,
                stripe_subscription_id: subRec.stripe_subscription_id,
                invoice_id: (obj as Stripe.Invoice).id,
                failure_reason:
                  (obj as Stripe.Invoice).last_finalization_error?.message ||
                  'Payment failed',
              },
            });
          }

          this.logger.log(`Payment failed for ${wid}. No plan applied.`);

          if (workspaceOrOrg) {
            await this.safeSendBillingMail(
              MailEvent.PAYMENT_FAILED,
              async () => {
                const recipient = await this.resolveBillingMailRecipient(
                  workspaceOrOrg,
                );
                if (!recipient) return null;
                return {
                  user: recipient.owner,
                  workspace: recipient.workspace,
                  invoiceId: invoiceObj.id,
                  attemptCount: invoiceObj.attempt_count ?? 1,
                  amountDue: invoiceObj.amount_due ?? 0,
                  currency: invoiceObj.currency ?? 'usd',
                  nextAttemptAt: invoiceObj.next_payment_attempt
                    ? dayjs
                        .unix(invoiceObj.next_payment_attempt)
                        .utc()
                        .toISOString()
                    : undefined,
                  failureMessage:
                    invoiceObj.last_finalization_error?.message ?? undefined,
                  billingPortalUrl: recipient.billingPortalUrl,
                };
              },
            );
          }
          break;
        }

        case 'customer.subscription.created': {
          const stripeSub = obj as Stripe.Subscription;

          // Delegate on-prem subscriptions to the cloud handler
          if (stripeSub.metadata.on_prem === 'true') {
            await this.handleOnPremSubscriptionCreated(stripeSub);
            break;
          }

          const planId = stripeSub.metadata.fk_plan_id;

          const workspaceOrOrgId =
            stripeSub.metadata.fk_org_id || stripeSub.metadata.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );
          if (!workspaceOrOrg)
            NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

          const price = stripeSub.items.data[0].price;
          const period = price.recurring.interval;
          const seatCount = stripeSub.items.data[0].quantity;

          // Insert new subscription record
          const subRec = await Subscription.insert({
            fk_user_id: stripeSub.metadata.fk_user_id,
            fk_workspace_id:
              workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
            fk_org_id:
              workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
            fk_plan_id: planId,
            stripe_subscription_id: stripeSub.id,
            stripe_price_id: price.id,
            seat_count: seatCount,
            last_paid_seat_count: seatCount,
            status: stripeSub.status,
            start_at: dayjs.unix(stripeSub.start_date).utc().toISOString(),
            trial_end_at: stripeSub.trial_end
              ? dayjs.unix(stripeSub.trial_end).utc().toISOString()
              : null,
            period,
            billing_cycle_anchor: dayjs
              .unix(stripeSub.billing_cycle_anchor)
              .utc()
              .toISOString(),
          });

          await this.telemetryService.sendSystemEvent({
            event_type: 'payment_alert',
            payment_type: 'subscription_created',
            message: `Subscription created for ${workspaceOrOrg.title} (${stripeSub.metadata.plan_title})`,
            workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
            extra: {
              subscription_id: subRec.id,
              stripe_subscription_id: stripeSub.id,
              plan_title: stripeSub.metadata.plan_title,
              seat_count: seatCount,
              period,
              price_id: price.id,
            },
          });

          // mark loyalty used if applicable
          if (
            workspaceOrOrg.entity === 'workspace' &&
            workspaceOrOrg.loyal &&
            !workspaceOrOrg.loyalty_discount_used
          ) {
            await Workspace.update(workspaceOrOrg.id, {
              loyalty_discount_used: true,
            });
          }

          // schedule loyalty downgrade if this was a loyalty price
          if (price.lookup_key?.includes('loyalty')) {
            await this.scheduleLoyaltyDowngrade(workspaceOrOrgId);
          } else if (stripeSub.status !== 'trialing') {
            // Only fetch next invoice for non-trialing subscriptions
            // Trialing subscriptions with missing_payment_method: 'cancel' won't have upcoming invoices
            await this.updateNextInvoice(
              subRec.id,
              await this.getNextInvoice(workspaceOrOrgId),
            );
          }

          if (workspaceOrOrg.entity === 'workspace') {
            const workspace = await Workspace.get(workspaceOrOrg.id);

            NocoSocket.broadcastEventToWorkspaceUsers(
              { workspace_id: workspaceOrOrg.id, base_id: null },
              {
                event: EventType.USER_EVENT,
                payload: {
                  action: 'workspace_update',
                  payload: workspace,
                },
              },
            );
          }

          this.clearBaseListCacheForEntity(workspaceOrOrg);

          await this.safeSendBillingMail(
            MailEvent.SUBSCRIPTION_CREATED,
            async () => {
              const recipient = await this.resolveBillingMailRecipient(
                workspaceOrOrg,
              );
              if (!recipient) return null;
              return {
                user: recipient.owner,
                workspace: recipient.workspace,
                subscriptionId: subRec.id,
                planTitle:
                  stripeSub.metadata.plan_title ??
                  (await this.resolvePlanTitle(
                    stripeSub.metadata.fk_plan_id,
                    'Paid',
                  )),
                seatCount,
                periodEnd: (() => {
                  const itemEnd = (stripeSub.items.data[0] as any)
                    ?.current_period_end;
                  return itemEnd
                    ? dayjs.unix(itemEnd).utc().toISOString()
                    : undefined;
                })(),
                isTrial: stripeSub.status === 'trialing',
                billingPortalUrl: recipient.billingPortalUrl,
              };
            },
          );
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const stripeSub = obj as Stripe.Subscription;

          // Delegate on-prem subscriptions to the cloud handler
          if (stripeSub.metadata.on_prem === 'true') {
            await this.handleOnPremSubscriptionUpdated(stripeSub);
            break;
          }

          const subRec = await Subscription.getByStripeSubscriptionId(
            stripeSub.id,
          );
          if (!subRec) NcError.genericNotFound('Subscription', stripeSub.id);

          const workspaceOrOrgId = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );
          if (!workspaceOrOrg)
            NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

          const price = stripeSub.items.data[0].price;
          const period = price.recurring?.interval || subRec.period;
          const seatCount = stripeSub.items.data[0].quantity;

          // update core subscription fields
          await Subscription.update(
            subRec.id,
            {
              stripe_price_id: price.id,
              seat_count: seatCount,
              status: stripeSub.status,
              start_at: dayjs.unix(stripeSub.start_date).utc().toISOString(),
              trial_end_at: stripeSub.trial_end
                ? dayjs.unix(stripeSub.trial_end).utc().toISOString()
                : null,
              canceled_at: stripeSub.cancel_at
                ? dayjs.unix(stripeSub.cancel_at).utc().toISOString()
                : null,
              fk_plan_id: stripeSub.metadata.fk_plan_id,
              billing_cycle_anchor: dayjs
                .unix(stripeSub.billing_cycle_anchor)
                .utc()
                .toISOString(),
              period,
            },
            Noco.ncMeta,
          );

          // if they just moved onto a loyalty price again
          if (
            workspaceOrOrg.entity === 'workspace' &&
            workspaceOrOrg.loyal &&
            price.lookup_key?.includes('loyalty') &&
            !workspaceOrOrg.loyalty_discount_used
          ) {
            await Workspace.update(workspaceOrOrg.id, {
              loyalty_discount_used: true,
            });
            await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, Noco.ncMeta);
          }

          // refresh next invoice (skip for trialing subscriptions with cancel behavior)
          if (!stripeSub.cancel_at && stripeSub.status !== 'trialing') {
            await this.updateNextInvoice(
              subRec.id,
              await this.getNextInvoice(workspaceOrOrgId),
            );
          }

          if (workspaceOrOrg.entity === 'workspace') {
            const workspace = await Workspace.get(workspaceOrOrg.id);

            NocoSocket.broadcastEventToWorkspaceUsers(
              { workspace_id: workspaceOrOrg.id, base_id: null },
              {
                event: EventType.USER_EVENT,
                payload: {
                  action: 'workspace_update',
                  payload: workspace,
                },
              },
            );
          }

          this.clearBaseListCacheForEntity(workspaceOrOrg);

          this.logger.log(
            `Subscription ${event.type} processed for ${workspaceOrOrgId}.`,
          );

          const newPriceId = price.id;
          const prevPlanId = subRec.fk_plan_id;
          const newPlanId = stripeSub.metadata.fk_plan_id;
          const planChanged =
            !!newPlanId && !!prevPlanId && newPlanId !== prevPlanId;

          // Only notify when the trial ended WITHOUT converting to a paid
          // plan. Successful conversion is already covered by Stripe's
          // invoice/receipt email + our earlier SUBSCRIPTION_CREATED with
          // isTrial=true; re-mailing on conversion would be noise.
          const trialEndedUnconverted =
            subRec.status === 'trialing' &&
            stripeSub.status !== 'trialing' &&
            stripeSub.status !== 'active';

          if (event.type === 'customer.subscription.deleted') {
            await this.safeSendBillingMail(
              MailEvent.SUBSCRIPTION_CANCELED,
              async () => {
                const recipient = await this.resolveBillingMailRecipient(
                  workspaceOrOrg,
                );
                if (!recipient) return null;
                return {
                  user: recipient.owner,
                  workspace: recipient.workspace,
                  subscriptionId: subRec.id,
                  planTitle:
                    stripeSub.metadata.plan_title ??
                    (await this.resolvePlanTitle(subRec.fk_plan_id, 'Paid')),
                  cancelAt: stripeSub.cancel_at
                    ? dayjs.unix(stripeSub.cancel_at).utc().toISOString()
                    : undefined,
                  periodEnd: (() => {
                    const itemEnd = (stripeSub.items.data[0] as any)
                      ?.current_period_end;
                    return itemEnd
                      ? dayjs.unix(itemEnd).utc().toISOString()
                      : undefined;
                  })(),
                  billingPortalUrl: recipient.billingPortalUrl,
                };
              },
            );
          } else if (
            event.type === 'customer.subscription.updated' &&
            planChanged
          ) {
            await this.safeSendBillingMail(MailEvent.PLAN_CHANGED, async () => {
              const recipient = await this.resolveBillingMailRecipient(
                workspaceOrOrg,
              );
              if (!recipient) return null;
              return {
                user: recipient.owner,
                workspace: recipient.workspace,
                subscriptionId: subRec.id,
                oldPlanTitle: await this.resolvePlanTitle(
                  prevPlanId,
                  'Previous plan',
                ),
                newPlanTitle:
                  stripeSub.metadata.plan_title ??
                  (await this.resolvePlanTitle(newPlanId, 'New plan')),
                newPriceId,
                effectiveAt: (() => {
                  const itemStart = (stripeSub.items.data[0] as any)
                    ?.current_period_start;
                  return itemStart
                    ? dayjs.unix(itemStart).utc().toISOString()
                    : undefined;
                })(),
                billingPortalUrl: recipient.billingPortalUrl,
              };
            });
          }

          if (trialEndedUnconverted) {
            await this.safeSendBillingMail(MailEvent.TRIAL_ENDED, async () => {
              const recipient = await this.resolveBillingMailRecipient(
                workspaceOrOrg,
              );
              if (!recipient) return null;
              return {
                user: recipient.owner,
                workspace: recipient.workspace,
                subscriptionId: subRec.id,
                planTitle:
                  stripeSub.metadata.plan_title ??
                  (await this.resolvePlanTitle(subRec.fk_plan_id, 'Plan')),
                billingPortalUrl: recipient.billingPortalUrl,
              };
            });
          }

          break;
        }

        case 'subscription_schedule.updated': {
          const sched = event.data.object as Stripe.SubscriptionSchedule;
          const subRec = await Subscription.getByStripeSubscriptionId(
            sched.subscription as string,
          );
          if (!subRec) {
            this.logger.warn(`No subscription found for schedule ${sched.id}`);
            break;
          }

          // Skip for on-prem subscriptions (no workspace/org)
          if (!subRec.fk_org_id && !subRec.fk_workspace_id) break;

          const now = dayjs().unix();
          const nextPhase =
            sched.phases.find((p) => p.start_date > now) ||
            sched.phases[sched.phases.length - 1];

          if (nextPhase) {
            const item = nextPhase.items[0] as any;
            await Subscription.update(
              subRec.id,
              {
                schedule_phase_start: dayjs
                  .unix(nextPhase.start_date)
                  .utc()
                  .toISOString(),

                schedule_stripe_price_id: item.price,
                schedule_period: nextPhase.metadata.period,
                schedule_fk_plan_id: nextPhase.metadata.fk_plan_id,
                schedule_type: sched.metadata.schedule_type as 'year' | 'next',
              },
              Noco.ncMeta,
            );
          }
          break;
        }

        case 'subscription_schedule.canceled':
        case 'subscription_schedule.released':
        case 'subscription_schedule.completed': {
          const sched = event.data.object as Stripe.SubscriptionSchedule;
          const subRec = await Subscription.getByStripeSubscriptionId(
            sched.subscription as string,
          );
          if (!subRec) {
            this.logger.warn(`No Subscription found for schedule ${sched.id}`);
            break;
          }
          // Skip for on-prem subscriptions (no workspace/org)
          if (!subRec.fk_org_id && !subRec.fk_workspace_id) break;

          await this.clearScheduledDowngrade(
            subRec.fk_org_id || subRec.fk_workspace_id,
            false,
          );
          break;
        }

        default:
          this.logger.warn(`Unhandled event type ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling webhook ${event.type}`);
      console.error(err);
      throw err;
    }
  }

  /**
   * Handle on-prem subscription creation from webhook.
   * No-op in base EE — overridden in ee-cloud to create Installation records.
   */
  protected async handleOnPremSubscriptionCreated(
    _stripeSub: Stripe.Subscription,
  ): Promise<void> {
    this.logger.warn(
      'On-prem subscription webhook received but handler not available (not running in cloud mode)',
    );
  }

  /**
   * Handle on-prem subscription update/deletion from webhook.
   * No-op in base EE — overridden in ee-cloud to update Installation status.
   */
  protected async handleOnPremSubscriptionUpdated(
    _stripeSub: Stripe.Subscription,
  ): Promise<void> {
    this.logger.warn(
      'On-prem subscription update webhook received but handler not available (not running in cloud mode)',
    );
  }

  /**
   * Handle invoice.paid for an on-prem subscription.
   * No-op in base EE — overridden in ee-cloud to emit the on-prem alert.
   */
  protected async handleOnPremInvoicePaid(
    _invoice: Stripe.Invoice,
  ): Promise<void> {}

  /**
   * Handle invoice.payment_failed for an on-prem subscription.
   * No-op in base EE — overridden in ee-cloud to emit the on-prem alert.
   */
  protected async handleOnPremInvoicePaymentFailed(
    _invoice: Stripe.Invoice,
  ): Promise<void> {}
}
