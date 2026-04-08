import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

import GcpMarketplaceAccount from '~/models/GcpMarketplaceAccount';
import GcpMarketplaceEntitlement from '~/models/GcpMarketplaceEntitlement';
import Installation from '~/models/Installation';
import { User } from '~/models';
import { GcpProcurementClient } from '~/services/gcp-procurement.client';
import { TelemetryService } from '~/services/telemetry.service';
import {
  InstallationStatus,
  LICENSE_CONFIG,
  LicenseType,
} from '~/utils/license';
import Noco from '~/Noco';

/** Google's issuer for marketplace JWTs */
const GCP_JWT_ISSUER =
  'https://www.googleapis.com/robot/v1/metadata/x509/cloud-commerce-partner@system.gserviceaccount.com';

/** URL to fetch Google's public certs for JWT verification */
const GCP_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/cloud-commerce-partner@system.gserviceaccount.com';

/** GCP plan ID → NocoDB license type mapping */
const PLAN_TO_LICENSE_TYPE: Record<string, LicenseType> = {
  'enterprise-P1Y': LicenseType.SELF_HOSTED_ENTERPRISE,
  'enterprise-airgap-P1Y': LicenseType.SELF_HOSTED_ENTERPRISE,
};

/** GCP plan ID → Installation config */
function buildConfigForGcpPlan(gcpPlan: string): Record<string, any> {
  const config: Record<string, any> = {
    gcp_marketplace: true,
    gcp_plan: gcpPlan,
  };

  if (gcpPlan === 'enterprise-airgap-P1Y') {
    config.airgapped = true;
  }

  return config;
}

interface GcpJwtPayload {
  iss: string;
  iat: number;
  exp: number;
  aud: string;
  sub: string; // procurement_account_id
  google?: {
    roles?: string[];
    user_identity?: string;
  };
}

@Injectable()
export class GcpMarketplaceService {
  private logger = new Logger(GcpMarketplaceService.name);

  /** Cached Google public certs for JWT verification */
  private cachedCerts: Record<string, string> | null = null;
  private certsExpireAt = 0;

  constructor(
    private readonly gcpProcurementClient: GcpProcurementClient,
    private readonly telemetryService: TelemetryService,
  ) {}

  // ---------------------------------------------------------------------------
  // JWT Verification
  // ---------------------------------------------------------------------------

  private async fetchGoogleCerts(): Promise<Record<string, string>> {
    if (this.cachedCerts && Date.now() < this.certsExpireAt) {
      return this.cachedCerts;
    }

    const { data, headers } = await axios.get<Record<string, string>>(
      GCP_CERTS_URL,
    );

    // Parse cache-control max-age for cache duration
    const cacheControl = headers['cache-control'] || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    this.cachedCerts = data;
    this.certsExpireAt = Date.now() + maxAgeSec * 1000;

    return data;
  }

  async verifyMarketplaceToken(token: string): Promise<GcpJwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid marketplace token format');
    }

    const kid = decoded.header.kid;
    if (!kid) {
      throw new Error('Token missing key ID (kid)');
    }

    const certs = await this.fetchGoogleCerts();
    const cert = certs[kid];
    if (!cert) {
      // Refresh certs once in case of key rotation
      this.cachedCerts = null;
      const freshCerts = await this.fetchGoogleCerts();
      const freshCert = freshCerts[kid];
      if (!freshCert) {
        throw new Error('Unknown signing key');
      }
      return this.verifyWithCert(token, freshCert);
    }

    return this.verifyWithCert(token, cert);
  }

  private verifyWithCert(token: string, cert: string): GcpJwtPayload {
    // First decode without verification to log the actual audience
    const decoded = jwt.decode(token, { json: true });
    this.logger.log(`GCP JWT audience: ${decoded?.aud}, sub: ${decoded?.sub}`);

    const audience = process.env.NC_GCP_MARKETPLACE_SERVICE_DOMAIN;

    return jwt.verify(token, cert, {
      algorithms: ['RS256'],
      issuer: GCP_JWT_ISSUER,
      ...(audience ? { audience } : {}),
    }) as GcpJwtPayload;
  }

  // ---------------------------------------------------------------------------
  // Sign-up flow
  // ---------------------------------------------------------------------------

  /**
   * Handle the initial signup POST from GCP Marketplace.
   * Verifies JWT, creates a pending GcpMarketplaceAccount, returns a
   * short-lived link token so the frontend can link after login.
   */
  async handleSignup(
    token: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    alreadyLinked: boolean;
    linkToken?: string;
    googleUserIdentity?: string;
  }> {
    const payload = await this.verifyMarketplaceToken(token);

    const procAccountId = payload.sub;
    if (!procAccountId) {
      throw new Error('Token missing procurement account ID (sub)');
    }

    // Check if account already exists and is linked
    const account = await GcpMarketplaceAccount.getByProcurementAccountId(
      procAccountId,
      ncMeta,
    );

    // Already linked — skip link token, redirect to license page
    if (account?.fk_user_id && account.state === 'active') {
      return { alreadyLinked: true };
    }

    // Generate a single-use link token (15 min TTL)
    const linkToken = nanoid(32);
    const linkTokenExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString();

    if (!account) {
      const newAccount = await GcpMarketplaceAccount.insert(
        {
          procurement_account_id: procAccountId,
          state: 'pending',
          link_token: linkToken,
          link_token_expires_at: linkTokenExpiresAt,
          meta: {
            google_user_identity: payload.google?.user_identity,
            google_roles: payload.google?.roles,
          },
        },
        ncMeta,
      );

      this.logger.log(
        `GCP Marketplace account created: ${newAccount.id} (proc: ${procAccountId})`,
      );
    } else {
      // Refresh link token on re-signup, also reset state if previously deleted
      await GcpMarketplaceAccount.update(
        account.id,
        {
          link_token: linkToken,
          link_token_expires_at: linkTokenExpiresAt,
          ...(account.state === 'deleted' ? { state: 'pending' } : {}),
        },
        ncMeta,
      );
    }

    return {
      linkToken,
      googleUserIdentity: payload.google?.user_identity,
      alreadyLinked: false,
    };
  }

  /**
   * Link a pending GCP Marketplace account to a NocoDB user and approve it.
   * Validates a short-lived link token generated during signup.
   */
  async linkAccount(
    linkToken: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const account = await GcpMarketplaceAccount.getByLinkToken(
      linkToken,
      ncMeta,
    );

    if (!account) {
      throw new Error('Invalid or expired link token');
    }

    // Validate token expiry
    if (
      account.link_token_expires_at &&
      new Date(account.link_token_expires_at) < new Date()
    ) {
      throw new Error('Link token has expired');
    }

    // Already linked to this user
    if (account.fk_user_id === userId && account.state === 'active') {
      return;
    }

    // Reject if already linked to a different user
    if (account.fk_user_id && account.fk_user_id !== userId) {
      throw new Error(
        'GCP Marketplace account is already linked to another user',
      );
    }

    // Reject if account was deleted
    if (account.state === 'deleted') {
      throw new Error('GCP Marketplace account has been deleted');
    }

    // Consume the link token and link user
    await GcpMarketplaceAccount.update(
      account.id,
      {
        fk_user_id: userId,
        state: 'active',
        link_token: null,
        link_token_expires_at: null,
      },
      ncMeta,
    );

    // Approve the account in GCP
    const procurementAccountId = account.procurement_account_id;
    try {
      await this.gcpProcurementClient.approveAccount(procurementAccountId);
    } catch (e) {
      this.logger.error(
        `Failed to approve GCP account ${procurementAccountId}: ${e.message}`,
        e.stack,
      );
      // Don't throw — the account is linked locally, GCP approval can be retried
    }

    this.logger.log(
      `GCP Marketplace account ${procurementAccountId} linked to user ${userId}`,
    );

    // Proactively approve any pending entitlements that arrived before the account was approved
    const pendingEntitlements = await GcpMarketplaceEntitlement.listByAccountId(
      account.id,
      ncMeta,
    );

    for (const ent of pendingEntitlements) {
      if (ent.state === 'pending' && !ent.fk_installation_id) {
        // Approve entitlements that arrived before account was approved
        try {
          await this.gcpProcurementClient.approveEntitlement(
            ent.entitlement_id,
          );
          this.logger.log(
            `Approved pending entitlement ${ent.entitlement_id} after account link`,
          );
        } catch (e) {
          this.logger.warn(
            `Failed to approve pending entitlement ${ent.entitlement_id}: ${e.message}`,
          );
        }
      }

      // Fix up installations that were created before the user was linked
      if (ent.fk_installation_id) {
        const inst = await Installation.get(ent.fk_installation_id, ncMeta);
        if (inst && !inst.fk_user_id) {
          const user = await User.get(userId, ncMeta);
          await Installation.update(
            ent.fk_installation_id,
            {
              fk_user_id: userId,
              licensed_to: user?.email || inst.licensed_to,
            },
            ncMeta,
          );
          this.logger.log(
            `Linked installation ${ent.fk_installation_id} to user ${userId}`,
          );
        }
      }
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'gcp_marketplace_account_linked',
      message: `GCP Marketplace account linked to user`,
      user: { id: userId },
      extra: {
        gcp_account_id: account.id,
        procurement_account_id: procurementAccountId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Entitlement event handlers
  // ---------------------------------------------------------------------------

  async handleEntitlementCreationRequested(
    entitlementId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ENTITLEMENT_CREATION_REQUESTED: ${entitlementId}`);

    // Fetch entitlement details from GCP
    const gcpEnt = await this.gcpProcurementClient.getEntitlement(
      entitlementId,
    );

    // Extract account ID from the entitlement's account field
    const accountId = this.extractAccountId(gcpEnt.account);

    // Find or create local entitlement record
    let entRecord = await GcpMarketplaceEntitlement.getByEntitlementId(
      entitlementId,
      ncMeta,
    );

    if (!entRecord) {
      // Find the GCP account record
      let gcpAccount = await GcpMarketplaceAccount.getByProcurementAccountId(
        accountId,
        ncMeta,
      );

      // Create the account if it doesn't exist yet (message ordering)
      if (!gcpAccount) {
        gcpAccount = await GcpMarketplaceAccount.insert(
          {
            procurement_account_id: accountId,
            state: 'pending',
          },
          ncMeta,
        );
      }

      entRecord = await GcpMarketplaceEntitlement.insert(
        {
          entitlement_id: entitlementId,
          fk_gcp_account_id: gcpAccount.id,
          plan: gcpEnt.plan,
          state: 'pending',
          meta: {
            product: gcpEnt.productExternalName || gcpEnt.product,
            consumers: gcpEnt.consumers,
          },
        },
        ncMeta,
      );
    }

    // Approve the entitlement in GCP
    // This may fail if the account hasn't been approved yet (user hasn't
    // completed signup). In that case, throw so Pub/Sub retries later.
    try {
      await this.gcpProcurementClient.approveEntitlement(entitlementId);
      this.logger.log(`Approved entitlement: ${entitlementId}`);
    } catch (e) {
      const status = e?.response?.status;
      const errorBody = e?.response?.data;

      if (status === 400) {
        // Check if this is because the account isn't approved yet
        const gcpAccount =
          await GcpMarketplaceAccount.getByProcurementAccountId(
            accountId,
            ncMeta,
          );

        if (!gcpAccount || gcpAccount.state !== 'active') {
          this.logger.warn(
            `Entitlement ${entitlementId} waiting for account ${accountId} to be approved — will retry`,
          );
          throw new Error('Account not yet approved');
        }
      }

      this.logger.error(
        `Failed to approve entitlement ${entitlementId}: ${
          e.message
        } ${JSON.stringify(errorBody || '')}`,
        e.stack,
      );
      throw e;
    }
  }

  async handleEntitlementActive(
    entitlementId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ENTITLEMENT_ACTIVE: ${entitlementId}`);

    const gcpEnt = await this.gcpProcurementClient.getEntitlement(
      entitlementId,
    );
    const accountId = this.extractAccountId(gcpEnt.account);

    // Find or create local entitlement record
    let entRecord = await GcpMarketplaceEntitlement.getByEntitlementId(
      entitlementId,
      ncMeta,
    );

    if (!entRecord) {
      let gcpAccount = await GcpMarketplaceAccount.getByProcurementAccountId(
        accountId,
        ncMeta,
      );

      if (!gcpAccount) {
        gcpAccount = await GcpMarketplaceAccount.insert(
          { procurement_account_id: accountId, state: 'pending' },
          ncMeta,
        );
      }

      entRecord = await GcpMarketplaceEntitlement.insert(
        {
          entitlement_id: entitlementId,
          fk_gcp_account_id: gcpAccount.id,
          plan: gcpEnt.plan,
          state: 'active',
        },
        ncMeta,
      );
    }

    // Idempotency: skip if already provisioned
    if (entRecord.fk_installation_id) {
      this.logger.log(
        `Entitlement ${entitlementId} already provisioned (installation: ${entRecord.fk_installation_id})`,
      );
      return;
    }

    // Provision license — read account fresh from DB to get the latest fk_user_id
    const gcpAccount = await GcpMarketplaceAccount.getByProcurementAccountId(
      accountId,
      ncMeta,
    );

    const licenseType = PLAN_TO_LICENSE_TYPE[gcpEnt.plan];
    if (!licenseType) {
      this.logger.error(`Unknown GCP plan: ${gcpEnt.plan}`);
      return;
    }

    const config = buildConfigForGcpPlan(gcpEnt.plan);
    let licensedTo = 'GCP Marketplace';
    let userId: string | undefined;

    if (gcpAccount?.fk_user_id) {
      userId = gcpAccount.fk_user_id;
      const user = await User.get(userId, ncMeta);
      if (user?.email) licensedTo = user.email;
    }

    const isAirgapped = gcpEnt.plan === 'enterprise-airgap-P1Y';
    const prefix = isAirgapped
      ? LICENSE_CONFIG.AIRGAPPED_KEY_PREFIX
      : LICENSE_CONFIG.LICENSE_KEY_PREFIX;
    const licenseKey = `${prefix}${nanoid(32)}`;

    const installation = await Installation.insert(
      {
        fk_user_id: userId,
        licensed_to: licensedTo,
        license_key: licenseKey,
        license_type: licenseType,
        status: InstallationStatus.PENDING,
        seat_count: 0,
        min_seats: 1,
        config,
        meta: {
          gcp_entitlement_id: entitlementId,
          gcp_plan: gcpEnt.plan,
        },
      },
      ncMeta,
    );

    // Link entitlement to installation
    await GcpMarketplaceEntitlement.update(
      entRecord.id,
      {
        fk_installation_id: installation.id,
        state: 'active',
        plan: gcpEnt.plan,
      },
      ncMeta,
    );

    this.logger.log(
      `License provisioned for GCP entitlement ${entitlementId}: installation=${installation.id}`,
    );

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'gcp_marketplace_license_created',
      message: `GCP Marketplace license created (${gcpEnt.plan}) for ${licensedTo}`,
      extra: {
        installation_id: installation.id,
        entitlement_id: entitlementId,
        gcp_plan: gcpEnt.plan,
        license_type: licenseType,
      },
    });
  }

  async handleEntitlementPlanChangeRequested(
    entitlementId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ENTITLEMENT_PLAN_CHANGE_REQUESTED: ${entitlementId}`);

    const gcpEnt = await this.gcpProcurementClient.getEntitlement(
      entitlementId,
    );

    if (!gcpEnt.newPendingPlan) {
      this.logger.warn(`No pendingPlanName for entitlement ${entitlementId}`);
      return;
    }

    // Auto-approve plan changes
    try {
      await this.gcpProcurementClient.approveEntitlementPlanChange(
        entitlementId,
        gcpEnt.newPendingPlan,
      );
    } catch (e) {
      this.logger.error(
        `Failed to approve plan change for ${entitlementId}: ${e.message}`,
        e.stack,
      );
      throw e;
    }
  }

  async handleEntitlementPlanChanged(
    entitlementId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ENTITLEMENT_PLAN_CHANGED: ${entitlementId}`);

    const gcpEnt = await this.gcpProcurementClient.getEntitlement(
      entitlementId,
    );

    const entRecord = await GcpMarketplaceEntitlement.getByEntitlementId(
      entitlementId,
      ncMeta,
    );

    if (!entRecord?.fk_installation_id) {
      this.logger.warn(
        `No installation found for entitlement ${entitlementId}`,
      );
      return;
    }

    // Update installation config for new plan
    const newLicenseType = PLAN_TO_LICENSE_TYPE[gcpEnt.plan];
    const newConfig = buildConfigForGcpPlan(gcpEnt.plan);

    await Installation.update(
      entRecord.fk_installation_id,
      {
        config: newConfig,
        ...(newLicenseType ? { license_type: newLicenseType } : {}),
      },
      ncMeta,
    );

    await GcpMarketplaceEntitlement.update(
      entRecord.id,
      { plan: gcpEnt.plan },
      ncMeta,
    );

    this.logger.log(
      `Installation ${entRecord.fk_installation_id} updated for plan change to ${gcpEnt.plan}`,
    );
  }

  async handleEntitlementCancelled(
    entitlementId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ENTITLEMENT_CANCELLED: ${entitlementId}`);

    const entRecord = await GcpMarketplaceEntitlement.getByEntitlementId(
      entitlementId,
      ncMeta,
    );

    if (!entRecord) {
      this.logger.warn(
        `No local record for cancelled entitlement ${entitlementId}`,
      );
      return;
    }

    // Update entitlement state
    await GcpMarketplaceEntitlement.update(
      entRecord.id,
      { state: 'cancelled' },
      ncMeta,
    );

    // Suspend the installation if linked
    if (entRecord.fk_installation_id) {
      const installation = await Installation.get(
        entRecord.fk_installation_id,
        ncMeta,
      );

      if (
        installation &&
        installation.status !== InstallationStatus.SUSPENDED &&
        installation.status !== InstallationStatus.REVOKED
      ) {
        await Installation.updateStatus(
          entRecord.fk_installation_id,
          InstallationStatus.SUSPENDED,
          ncMeta,
        );

        this.logger.log(
          `Installation ${entRecord.fk_installation_id} suspended (entitlement cancelled)`,
        );
      }
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'gcp_marketplace_entitlement_cancelled',
      message: `GCP Marketplace entitlement cancelled: ${entitlementId}`,
      extra: {
        entitlement_id: entitlementId,
        installation_id: entRecord.fk_installation_id,
      },
    });
  }

  async handleAccountDeleted(
    procAccountId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.log(`ACCOUNT_DELETED: ${procAccountId}`);

    const account = await GcpMarketplaceAccount.getByProcurementAccountId(
      procAccountId,
      ncMeta,
    );

    if (!account) {
      this.logger.warn(`No local record for deleted account ${procAccountId}`);
      return;
    }

    if (account.state === 'deleted') return;

    // Suspend all linked installations
    const entitlements = await GcpMarketplaceEntitlement.listByAccountId(
      account.id,
      ncMeta,
    );

    for (const ent of entitlements) {
      if (ent.fk_installation_id) {
        await Installation.updateStatus(
          ent.fk_installation_id,
          InstallationStatus.REVOKED,
          ncMeta,
        );
      }
      await GcpMarketplaceEntitlement.update(
        ent.id,
        { state: 'deleted' },
        ncMeta,
      );
    }

    await GcpMarketplaceAccount.update(
      account.id,
      { state: 'deleted' },
      ncMeta,
    );

    this.logger.log(
      `GCP Marketplace account ${procAccountId} deleted, ${entitlements.length} entitlements revoked`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the account ID from a GCP account resource name.
   * Input: "providers/nocodb-public/accounts/ABC123" → "ABC123"
   */
  private extractAccountId(accountName: string): string {
    const parts = accountName.split('/');
    return parts[parts.length - 1];
  }
}
