import { Logger } from '@nestjs/common';
import NocoEE from 'src/ee/Noco';
import type { Express } from 'express';
import type http from 'http';
import { NC_LICENSE_KEY } from '~/constants';
import { getDbFingerprint } from '~/helpers/dbFingerprint';
import { verifyDefaultWorkspace } from '~/helpers/verifyDefaultWorkspace';
import NocoLicense from '~/NocoLicense';
import { Store } from '~/models';
import { LICENSE_ENV_VARS } from '~/utils/license/constants';
import { isLicenseClientEnabled } from '~/utils/license/env-validator';

const logger = new Logger('Noco');

export default class Noco extends NocoEE {
  public static domains: Set<string> = new Set();

  static async init(param: any, httpServer: http.Server, server: Express) {
    const res = await super.init(param, httpServer, server);

    if (isLicenseClientEnabled()) {
      try {
        await NocoLicense.init();

        this.ee = NocoLicense.isEE;

        logger.log(
          NocoLicense.isEE
            ? 'License system initialized — EE features active'
            : `License ${NocoLicense.licenseStatus} — running in CE mode`,
        );
      } catch (e) {
        logger.warn(
          `License activation failed: ${e.message} — falling back to CE mode`,
        );
        this.ee = false;
      }
    } else {
      this.ee = false;
      logger.log('No license key found — running in CE mode');
    }

    // Log installation ID for license activation (safe — it's a one-way hash)
    try {
      const installationId = await getDbFingerprint();
      logger.log(`Installation ID: ${installationId}`);
    } catch {
      logger.warn(
        'Installation ID unavailable — PostgreSQL is required for enterprise licensing',
      );
    }

    // Always ensure default workspace exists — on-prem needs it regardless of license state
    await verifyDefaultWorkspace();

    return res;
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
        this.ee = false;
        await verifyDefaultWorkspace();
        return false;
      }

      process.env[LICENSE_ENV_VARS.LICENSE_KEY] = licenseKey;
      NocoLicense.reset();
      await NocoLicense.init();

      this.ee = NocoLicense.isEE;

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
      this.ee = false;
      await verifyDefaultWorkspace();
      return false;
    }
  }
}
