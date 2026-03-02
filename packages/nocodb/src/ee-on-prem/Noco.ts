import { Logger } from '@nestjs/common';
import NocoEE from 'src/ee/Noco';
import type { Express } from 'express';
import type http from 'http';
import { NC_LICENSE_KEY } from '~/constants';
import { getInstanceId } from '~/helpers/instanceId';
import { verifyDefaultWorkspace } from '~/helpers/verifyDefaultWorkspace';
import NocoLicense from '~/NocoLicense';
import { Store } from '~/models';
import { LICENSE_ENV_VARS } from '~/utils/license/constants';
import { isLicenseClientEnabled } from '~/utils/license/env-validator';

const logger = new Logger('Noco');

export default class Noco extends NocoEE {
  public static domains: Set<string> = new Set();

  /**
   * On-prem override: dynamically checks NocoLicense.isEE so that
   * runtime state changes (grace period expiry, revocation) take
   * effect immediately without requiring a restart.
   */
  public static isEE(): boolean {
    return NocoLicense.isEE;
  }

  static async init(param: any, httpServer: http.Server, server: Express) {
    const res = await super.init(param, httpServer, server);

    if (isLicenseClientEnabled()) {
      try {
        await NocoLicense.init();

        logger.log(
          NocoLicense.isEE
            ? 'License system initialized — EE features active'
            : `License ${NocoLicense.licenseStatus} — running in CE mode`,
        );
      } catch (e) {
        logger.warn(
          `License activation failed: ${e.message} — falling back to CE mode`,
        );
      }
    } else {
      logger.log('No license key found — running in CE mode');
    }

    // Log instance ID for license activation (safe — it's a one-way hash)
    try {
      const instanceId = await getInstanceId();
      logger.log(`Instance ID: ${instanceId}`);
    } catch {
      logger.warn(
        'Instance ID unavailable — PostgreSQL is required for enterprise licensing',
      );
    }

    // Always ensure default workspace exists — on-prem needs it regardless of license state
    await verifyDefaultWorkspace();

    return res;
  }

  /**
   * Lightweight sync after refreshLicenseFromServer() has already
   * fetched a fresh JWT and updated NocoLicense internal state.
   * Only syncs the Noco.ee flag — no DB reads, no reset/init.
   */
  public static syncEEState(): void {
    this.ee = NocoLicense.isEE;
  }

  /**
   * Called when license key is set/updated via UI (POST /api/v1/license).
   * Re-validates with the license server and updates runtime EE state
   * without requiring a restart.
   */
  public static async loadEEState(): Promise<boolean> {
    try {
      const stored = await Store.get(NC_LICENSE_KEY);
      const licenseKey = stored?.value;

      if (!licenseKey) {
        NocoLicense.reset();
        await verifyDefaultWorkspace();
        return false;
      }

      process.env[LICENSE_ENV_VARS.LICENSE_KEY] = licenseKey;
      NocoLicense.reset();

      // Preserve DB cache — for standard licenses the heartbeat will
      // refresh the JWT, for airgapped the cache is the only fallback
      // if the server is unreachable.
      await NocoLicense.init();

      logger.log(
        NocoLicense.isEE
          ? 'License validated — EE features activated'
          : `License ${NocoLicense.licenseStatus} — running in CE mode`,
      );

      // Ensure default workspace exists (idempotent — no-op if already there)
      await verifyDefaultWorkspace();

      return NocoLicense.isEE;
    } catch (e) {
      logger.error(`Failed to load EE state: ${e.message}`);
      await verifyDefaultWorkspace();
      return false;
    }
  }
}
