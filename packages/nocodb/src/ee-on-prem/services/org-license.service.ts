import { Injectable, Logger } from '@nestjs/common';
import { OrgLicenseService as OrgLicenseServiceEE } from 'src/ee/services/org-license.service';
import { NC_LICENSE_KEY } from '~/constants';
import { NcError } from '~/helpers/catchError';
import { getInstanceId } from '~/helpers/instanceId';
import { validatePayload } from '~/helpers';
import { Store } from '~/models';
import Noco from '~/Noco';
import NocoLicense from '~/NocoLicense';
import { MetaTable, RootScopes } from '~/utils/globals';
import { LICENSE_CONFIG, LICENSE_ENV_VARS } from '~/utils/license/constants';

@Injectable()
export class OrgLicenseService extends OrgLicenseServiceEE {
  private readonly onPremLogger = new Logger(OrgLicenseService.name);

  async licenseSet(param: { key: string }) {
    validatePayload('swagger.json#/components/schemas/LicenseReq', param);

    // Removing a license key — clear the env-stored key AND wipe the
    // cached server-issued JWT/installation.
    if (!param.key) {
      await Store.saveOrUpdate({ value: '', key: NC_LICENSE_KEY });
      await Noco.ncMeta.metaDelete(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        { key: 'NC_LICENSE_DATA' },
      );
      NocoLicense.reset();
      await Noco.syncEEState();
      return true;
    }

    // Validate PostgreSQL requirement
    try {
      await getInstanceId();
    } catch {
      NcError.badRequest(
        'License activation requires PostgreSQL. SQLite and MySQL are not supported for on-premise licensing.',
      );
    }

    // Validate the key by attempting activation BEFORE saving.
    // For airgapped keys, init() loads from cache as a fallback when the
    // server is unreachable, and refreshAirgappedFromServer() (called
    // after a successful activation below) handles the online refresh.
    // For standard keys, init() now requires the cached license_key to
    // match the new env key — otherwise it falls through to a fresh
    // server activation, so EE only re-engages with server approval.
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
      await Noco.syncEEState();
      this.onPremLogger.error(e.message, e.stack);
      NcError.badRequest(
        'License activation failed. Please verify your license key and try again.',
      );
    }

    // Activation succeeded — save first, then attempt best-effort refresh
    await Store.saveOrUpdate({ value: param.key, key: NC_LICENSE_KEY });
    await Noco.syncEEState();

    // For airgapped nc_ag_ keys: attempt online refresh to pull the
    // latest expires_at from the server (covers the case where the
    // admin renewed the license remotely and the customer is refreshing).
    // init() already handles first-time activation and expired JWTs —
    // this call is only needed when the cache is still valid but the
    // user explicitly wants to sync with the server.
    // Best-effort — failure must not affect the saved key or rollback.
    if (param.key.startsWith(LICENSE_CONFIG.AIRGAPPED_KEY_PREFIX)) {
      await NocoLicense.refreshAirgappedFromServer();
    }

    return true;
  }

  async licenseRefresh(): Promise<{ success: boolean; status?: string }> {
    if (!NocoLicense.isInitialized()) {
      return { success: false, status: 'not_initialized' };
    }

    try {
      const refreshed = await NocoLicense.refreshLicenseFromServer(Noco.ncMeta);

      if (!refreshed) {
        this.onPremLogger.warn('License refresh failed via API');
        return { success: false, status: NocoLicense.licenseStatus };
      }

      // Sync Noco.ee flag without the heavy reset/init cycle of loadEEState()
      await Noco.syncEEState();

      this.onPremLogger.log('License refreshed successfully via API');
      return { success: true, status: NocoLicense.licenseStatus };
    } catch (e) {
      this.onPremLogger.error(`License refresh error: ${e.message}`, e.stack);
      return { success: false, status: NocoLicense.licenseStatus };
    }
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

    // Count seat-consuming users (editor+, excludes viewer/commenter) so the
    // self-serve checkout can pre-fill seats matching how billing reseats.
    let seatCount: number | undefined;
    try {
      seatCount = await NocoLicense.calculateGlobalSeatCount();
    } catch (e) {
      this.onPremLogger.warn(`Failed to calculate seat count: ${e.message}`);
    }

    // Stable instance ID — used to bind a self-serve license to this
    // specific instance at purchase time.
    let instanceId: string | undefined;
    try {
      instanceId = await getInstanceId();
    } catch {
      // Non-PG instance — binding is unsupported, leave undefined
    }

    return {
      ...base,
      isAirgapped: NocoLicense.isAirgapped,
      seatLimit: NocoLicense.getSeatLimit(),
      seatCount,
      instanceId,
      isPostgres,
    };
  }
}
