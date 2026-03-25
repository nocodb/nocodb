import { Injectable, Logger } from '@nestjs/common';
import { NC_LICENSE_KEY } from '~/constants';
import { OrgLcenseService as OrgLcenseServiceEE } from 'src/ee/services/org-lcense.service';
import { NcError } from '~/helpers/catchError';
import { getDbFingerprint } from '~/helpers/dbFingerprint';
import { validatePayload } from '~/helpers';
import { Store } from '~/models';
import Noco from '~/Noco';
import NocoLicense from '~/NocoLicense';
import { LICENSE_ENV_VARS } from '~/utils/license/constants';

@Injectable()
export class OrgLcenseService extends OrgLcenseServiceEE {
  private readonly logger = new Logger(OrgLcenseService.name);
  async licenseSet(param: { key: string }) {
    validatePayload('swagger.json#/components/schemas/LicenseReq', param);

    // Removing a license key — just clear and reset
    if (!param.key) {
      await Store.saveOrUpdate({ value: '', key: NC_LICENSE_KEY });
      NocoLicense.reset();
      Noco.ee = false;
      return true;
    }

    // Validate PostgreSQL requirement
    try {
      await getDbFingerprint();
    } catch {
      NcError.badRequest(
        'License activation requires PostgreSQL. SQLite and MySQL are not supported for on-premise licensing.',
      );
    }

    // Validate the key by attempting activation BEFORE saving
    process.env[LICENSE_ENV_VARS.LICENSE_KEY] = param.key;
    NocoLicense.reset();

    try {
      await NocoLicense.init();
    } catch (e) {
      // Activation failed — restore previous state
      const stored = await Store.get(NC_LICENSE_KEY);
      process.env[LICENSE_ENV_VARS.LICENSE_KEY] = stored?.value || '';
      NocoLicense.reset();
      if (stored?.value) {
        try {
          await NocoLicense.init();
        } catch {
          // Previous key also failed — stay in CE mode
        }
      }
      Noco.ee = NocoLicense.isEE;
      this.logger.error(e.message, e.stack);
      NcError.badRequest(
        'License activation failed. Please verify your license key and try again.',
      );
    }

    // Activation succeeded — now save
    await Store.saveOrUpdate({ value: param.key, key: NC_LICENSE_KEY });
    Noco.ee = NocoLicense.isEE;

    return true;
  }

  async licenseStatus() {
    const base = await super.licenseStatus();

    // Expose whether PG is available (for frontend to hide license panel)
    let isPostgres = false;
    try {
      const client = Noco.getConfig()?.meta?.db?.client;
      isPostgres = client === 'pg';
    } catch {
      // ignore
    }

    return {
      ...base,
      isAirgapped: NocoLicense.isAirgapped,
      seatLimit: NocoLicense.getSeatLimit(),
      isPostgres,
    };
  }
}
