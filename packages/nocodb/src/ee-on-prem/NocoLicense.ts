import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import {
  CloudOrgUserRoles,
  NON_SEAT_ROLES,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { getArrayAggExpression } from '~/helpers/dbHelpers';
import {
  getLicenseServerPublicKeys,
  InstallationStatus,
  LICENSE_CONFIG,
  LICENSE_ENV_VARS,
  LICENSE_SERVER_OLD_PUBLIC_KEY,
  LicenseType,
  validateClientLicenseEnvironment,
} from '~/utils/license';
import { getInstanceId } from '~/helpers/instanceId';
import { packageVersion } from '~/utils/packageVersion';

const LICENSE_SERVER_URL =
  process.env[LICENSE_ENV_VARS.LICENSE_SERVER_URL] || 'https://app.nocodb.com';

interface LicenseData {
  installation_id: string;
  installation_secret: string;
  license_key: string;
  license_type: string;
  status: InstallationStatus;
  seat_count: number;
  expires_at?: string;
  last_heartbeat_at?: string;
  config?: {
    limit_workspace?: number;
    limit_seat?: number;
  };
  instance_id?: string;
  db_fingerprint?: string;
  airgapped?: boolean;
  iat?: number; // JWT issued-at timestamp (seconds)
}

// Cached license data stored in database
interface CachedLicenseData {
  license_jwt: string; // RSA-signed JWT from server containing license state
  installation_secret: string; // HMAC secret for client authentication
  license_key: string;
  heartbeat_state?: HeartbeatState; // Track heartbeat history
}

// Heartbeat state tracking
interface HeartbeatState {
  last_success_at: string; // ISO timestamp of last successful heartbeat
  last_attempt_at: string; // ISO timestamp of last heartbeat attempt
  consecutive_failures: number; // Count of consecutive failed heartbeats
  grace_period_expires_at: string; // When grace period expires (last_success + grace period)
}

export default class NocoLicense {
  private static logger = new Logger('NocoLicense');
  private static licenseData: LicenseData | null = null;
  private static _isExpired: boolean = false;
  private static heartbeatState: HeartbeatState | null = null;
  private static _isAirgapped: boolean = false;
  private static _graceExpiredLogged: boolean = false;

  // Heartbeat intervals from shared constants
  private static readonly HEARTBEAT_INTERVAL_NORMAL_MS =
    LICENSE_CONFIG.HEARTBEAT_INTERVAL_NORMAL_MS;
  private static readonly HEARTBEAT_INTERVAL_FAILURE_MS =
    LICENSE_CONFIG.HEARTBEAT_INTERVAL_FAILURE_MS;
  private static readonly HEARTBEAT_GRACE_PERIOD_MS =
    LICENSE_CONFIG.HEARTBEAT_GRACE_PERIOD_MS;
  private static currentHeartbeatInterval =
    NocoLicense.HEARTBEAT_INTERVAL_NORMAL_MS;
  private static heartbeatTimer: NodeJS.Timeout | null = null;

  public static get isExpired() {
    return this._isExpired;
  }

  /** EE is active when license is initialized, not expired, not suspended,
   *  and (for non-airgapped) still within the heartbeat grace period. */
  public static get isEE(): boolean {
    if (!this.licenseData) return false;
    if (this._isExpired || this.isSuspended) return false;

    // For non-airgapped licenses, enforce grace period —
    // if heartbeats haven't succeeded within the window, fall to CE mode
    if (!this._isAirgapped && !this.isInGracePeriod()) {
      if (!this._graceExpiredLogged) {
        this._graceExpiredLogged = true;
        this.logger.warn(
          'License grace period expired — falling back to CE mode. ' +
            'Ensure the license server is reachable to restore EE features.',
        );
      }
      return false;
    }

    // Reset the flag once we're back in grace period (heartbeat recovered)
    this._graceExpiredLogged = false;

    return true;
  }

  /** License is suspended or revoked */
  public static get isSuspended(): boolean {
    if (!this.licenseData) return false;
    return (
      this.licenseData.status === InstallationStatus.SUSPENDED ||
      this.licenseData.status === InstallationStatus.REVOKED
    );
  }

  /** Whether this is an airgapped license (no heartbeats, offline operation) */
  public static get isAirgapped(): boolean {
    return this._isAirgapped;
  }

  /** Maximum allowed seats from license config, or null if unlimited */
  public static getSeatLimit(): number | null {
    return this.licenseData?.config?.limit_seat ?? null;
  }

  /** Human-readable license status for API responses */
  public static get licenseStatus(): string {
    if (!this.licenseData) return 'none';
    if (this.isSuspended) return 'suspended';
    if (this._isExpired) return 'expired';
    return 'active';
  }

  /**
   * Reset license state so init() can be called again with a new key.
   * Stops heartbeat timer and clears all in-memory cached data.
   */
  public static reset(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.licenseData = null;
    this._isExpired = false;
    this._isAirgapped = false;
    this._graceExpiredLogged = false;

    this.heartbeatState = null;
    this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_NORMAL_MS;
  }

  /**
   * Refresh an airgapped (nc_ag_) license from the server.
   * Contacts the license server to get a fresh JWT with updated expires_at.
   * On failure the existing cached license is preserved — no data is lost.
   * @returns true if refresh succeeded, false if server was unreachable
   */
  public static async refreshAirgappedFromServer(
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const licenseKey = process.env[LICENSE_ENV_VARS.LICENSE_KEY];

    if (!licenseKey?.startsWith(LICENSE_CONFIG.AIRGAPPED_KEY_PREFIX)) {
      return false;
    }

    // Attempt online activation — gets a fresh JWT with latest expires_at
    const activated = await this.activateAirgappedLicense(licenseKey, ncMeta);

    if (!activated) {
      this.logger.warn(
        'Airgapped license refresh failed — server unreachable. Existing license preserved.',
      );
      return false;
    }

    this._isAirgapped = true;
    this._isExpired = this.licenseData
      ? !this.isValidStatus(this.licenseData.status)
      : false;
    this.startHeartbeatTimer();
    this.logger.log('Airgapped license refreshed from server successfully');
    return true;
  }

  /**
   * Initialize license system on startup
   * - Loads cached license data from nc_store
   * - Validates license status
   * - Sends initial heartbeat to license server if needed
   * @throws {LicenseEnvironmentError} If required environment variables are missing
   */
  public static async init(): Promise<void> {
    // Validate environment variables
    validateClientLicenseEnvironment();

    const licenseKey = process.env[LICENSE_ENV_VARS.LICENSE_KEY];

    try {
      const ncMeta = Noco.ncMeta;

      // Airgapped license key (nc_ag_ prefix) — one-time online activation
      if (licenseKey?.startsWith(LICENSE_CONFIG.AIRGAPPED_KEY_PREFIX)) {
        await this.initAirgapped(licenseKey, ncMeta);
        return;
      }

      // Pre-signed license JWT (pure airgapped — no network ever)
      // Distinguish from legacy JWT keys by checking for the airgapped claim
      if (licenseKey?.startsWith('eyJ')) {
        const decoded = jwt.decode(licenseKey, { json: true }) as any;
        if (decoded?.airgapped) {
          await this.initFromSignedJWT(licenseKey, ncMeta);
          return;
        }
        // Not airgapped — fall through to standard flow (handles legacy JWT keys)
      }

      // Load cached license data from nc_store
      const storedData = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: `NC_LICENSE_DATA`,
        },
      );

      if (storedData?.value) {
        try {
          const cached: CachedLicenseData = JSON.parse(storedData.value);

          // Verify JWT
          const licenseData = this.verifyAndDecodeLicenseJWT(
            cached.license_jwt,
          );

          if (licenseData) {
            // Verify instance ID if this is an instance-bound installation
            if (
              cached.installation_secret?.startsWith(
                LICENSE_CONFIG.INSTANCE_BOUND_SECRET_PREFIX,
              )
            ) {
              const currentInstanceId = await getInstanceId(ncMeta);
              if (
                licenseData.instance_id &&
                licenseData.instance_id !== currentInstanceId
              ) {
                throw new Error(
                  'This license is bound to a different installation. Please ensure you are using the correct license for this instance.',
                );
              }
            }

            // JWT valid - use it
            this.licenseData = {
              ...licenseData,
              installation_secret: cached.installation_secret,
              license_key: cached.license_key,
            };
            this._isExpired = !this.isValidStatus(this.licenseData.status);

            // Load heartbeat state
            this.heartbeatState = cached.heartbeat_state || null;

            // Validate cached license
            if (
              this.licenseData.status === InstallationStatus.REVOKED ||
              this.licenseData.status === InstallationStatus.SUSPENDED
            ) {
              throw new Error(
                `Your license is currently ${this.licenseData.status}. Please contact support for assistance.`,
              );
            }
          } else {
            // JWT invalid/expired - refresh from server
            this.logger.warn('Cached JWT invalid, refreshing from server');

            // Decode JWT without verification to get installation_secret for refresh
            const tempData = jwt.decode(cached.license_jwt) as any;
            if (tempData) {
              this.licenseData = {
                ...tempData,
                installation_secret: cached.installation_secret,
                license_key: cached.license_key,
              };

              const refreshed = await this.refreshLicenseFromServer(ncMeta);
              if (!refreshed) {
                throw new Error(
                  'Failed to refresh license from server. Please check your license key and network connectivity.',
                );
              }
            } else {
              this.logger.warn('Could not decode JWT, will re-activate');
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse cached license data: ${error.message}`,
          );
        }
      }

      if (!this.licenseData) {
        this.logger.log(
          'License not found in cache. Attempting to activate with license server...',
        );

        // Attempt activation with license server
        const activated = await this.activateLicense(licenseKey, ncMeta);

        if (!activated) {
          throw new Error(
            'License activation failed. Please check your license key and ensure the license server is accessible.',
          );
        }

        this.logger.log('License activated successfully');
      }

      // Initial heartbeat
      await this.handleHeartbeat();

      // Start heartbeat timer
      this.startHeartbeatTimer();
    } catch (error) {
      this.logger.error(`License validation failed: ${error.message}`);
      // Re-throw to let the caller handle the error
      throw error;
    }
  }

  /**
   * Start the heartbeat timer.
   * If the license has an expiry sooner than the normal interval,
   * schedule at expiry + 5s so the next heartbeat catches it precisely.
   */
  private static startHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    let interval = this.currentHeartbeatInterval;

    // If license expires before the next scheduled heartbeat,
    // tighten the interval so we fire just after expiry
    if (this.licenseData?.expires_at) {
      const msUntilExpiry =
        new Date(this.licenseData.expires_at).getTime() - Date.now();
      if (msUntilExpiry > 0 && msUntilExpiry < interval) {
        interval = msUntilExpiry + 5_000;
      }
    }

    this.heartbeatTimer = setTimeout(() => {
      this.handleHeartbeat();
    }, interval);
  }

  /**
   * Store license data in nc_store with HMAC signature
   * This is called ONLY by the activation/heartbeat process when receiving data from the license server
   * The signature prevents local tampering - any modification to the data will be detected
   */
  private static async storeLicenseData(
    jwtToken: string,
    installationSecret: string,
    licenseKey: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const key = `NC_LICENSE_DATA`;

    const cachedData: CachedLicenseData = {
      license_jwt: jwtToken,
      installation_secret: installationSecret,
      license_key: licenseKey,
      heartbeat_state: this.heartbeatState || undefined,
    };

    // Check if entry exists
    const existing = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      { key },
    );

    if (existing) {
      // Update existing entry
      await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          value: JSON.stringify(cachedData),
        },
        {
          key,
        },
      );
    } else {
      // Insert new entry
      await ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key,
          value: JSON.stringify(cachedData),
        },
        true,
      );
    }
  }

  /**
   * Verify and decode license JWT by trying all known public keys.
   * Supports key rotation — iterates embedded keys + env extras until
   * one succeeds. Stops early on TokenExpiredError (signature matched).
   */
  private static verifyAndDecodeLicenseJWT(
    jwtToken: string,
  ): LicenseData | null {
    const publicKeys = getLicenseServerPublicKeys();
    let lastError: any = null;

    for (const key of publicKeys) {
      try {
        const decoded = jwt.verify(jwtToken, key, {
          algorithms: [LICENSE_CONFIG.JWT_ALGORITHM],
        }) as any;

        return decoded;
      } catch (error: any) {
        lastError = error;
        // TokenExpiredError means the signature matched but the token is expired —
        // no point trying other keys
        if (error.name === 'TokenExpiredError') break;
      }
    }

    if (lastError?.name === 'TokenExpiredError') {
      this.logger.warn('License JWT expired, will attempt refresh');
    } else {
      this.logger.error(`JWT verification failed: ${lastError?.message}`);
    }
    return null;
  }

  /**
   * Heartbeat handler
   * - Runs every 6 hours (normal) or 1 hour (failure)
   * - Calculates seat count based on user roles
   * - Sends heartbeat to license server
   * - Updates cached license data
   */
  private static async handleHeartbeat() {
    // For airgapped: no server call — just check expiry locally
    if (this._isAirgapped) {
      if (
        this.licenseData?.expires_at &&
        new Date(this.licenseData.expires_at) < new Date()
      ) {
        this._isExpired = true;
        this.logger.warn(
          'Airgapped license has expired — falling back to CE mode. ' +
            'Please renew your license to restore EE features.',
        );
        return;
      }
      // Not expired yet — reschedule to check again
      this.startHeartbeatTimer();
      return;
    }

    if (!this.licenseData) {
      this.startHeartbeatTimer();
      return;
    }

    try {
      const ncMeta = Noco.ncMeta;

      // If using old license (no installation_id), attempt activation instead of heartbeat
      if (!this.licenseData.installation_id) {
        this.logger.log(
          'Legacy license detected, attempting activation with license server...',
        );

        const activated = await this.activateLicense(
          this.licenseData.license_key,
          ncMeta,
        );

        if (activated) {
          // Update heartbeat state for successful upgrade
          this.updateHeartbeatState(true);
        } else {
          // Update heartbeat state for failed attempt
          this.updateHeartbeatState(false);
          this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_FAILURE_MS;
        }

        this.startHeartbeatTimer();
        return;
      }

      // Calculate seat count based on user roles across all workspaces
      const seatCount = await this.calculateGlobalSeatCount(ncMeta);

      // Send heartbeat to license server with current domains
      const timestamp = Date.now();

      const heartbeatPayload = {
        type: 'heartbeat',
        timestamp,
        version: 0,
        installation_id: this.licenseData.installation_id,
        seat_count: seatCount,
        environment: {
          domains: Array.from(Noco.domains), // Track accessed domains
          version: packageVersion,
          platform: process.platform,
        },
      };

      // Sign the heartbeat payload with installation_secret
      const signature = crypto
        .createHmac('sha256', this.licenseData.installation_secret)
        .update(JSON.stringify(heartbeatPayload))
        .digest('hex');

      const requestBody = {
        ...heartbeatPayload,
        signature,
      };

      const response = await fetch(
        `${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `License server returned error: ${JSON.stringify(
            await response.json(),
          )}`,
        );
        // Update heartbeat state for failed attempt
        this.updateHeartbeatState(false);
        this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_FAILURE_MS;
        this.startHeartbeatTimer();
        return;
      }

      const data = (await response.json()) as {
        license_jwt: string;
        heartbeat_interval_ms: number;
      };

      // Verify and update license data from JWT
      const licenseData = this.verifyAndDecodeLicenseJWT(data.license_jwt);
      if (!licenseData) {
        this.logger.error('Received invalid JWT from server');
        // Update heartbeat state for failed attempt
        this.updateHeartbeatState(false);
        this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_FAILURE_MS;
        this.startHeartbeatTimer();
        return;
      }

      // Update local license data
      this.licenseData = {
        ...licenseData,
        installation_secret: this.licenseData.installation_secret,
        license_key: this.licenseData.license_key,
        last_heartbeat_at: new Date().toISOString(),
      };

      // Update heartbeat state for successful attempt
      this.updateHeartbeatState(true);

      // Store updated JWT
      await this.storeLicenseData(
        data.license_jwt,
        this.licenseData.installation_secret,
        this.licenseData.license_key,
        ncMeta,
      );

      this.currentHeartbeatInterval = data.heartbeat_interval_ms;

      // Check license validity
      const isInvalid = !this.isValidStatus(this.licenseData.status);
      this._isExpired = isInvalid;

      if (isInvalid) {
        this.logger.warn(`License is invalid: ${this.licenseData.status}`);
      } else {
        this.logger.log('License acquired and verified successfully');
      }
    } catch (error) {
      // Update heartbeat state for failed attempt
      this.updateHeartbeatState(false);
      this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_FAILURE_MS;
    }

    // Schedule next heartbeat
    this.startHeartbeatTimer();
  }

  /**
   * Calculate global seat count across the entire instance
   * For on-premise, we charge per instance (not per workspace)
   * A user is counted once if they have any seat-consuming role anywhere in the instance
   */
  public static async calculateGlobalSeatCount(
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const seatUsersMap = new Map<string, true>();
    const nonSeatUsersMap = new Map<string, true>();

    // Subquery for workspace team roles (teams → workspace roles per user)
    const workspaceTeamRolesSubquery = ncMeta.knexConnection
      .select('pa.principal_ref_id as user_id')
      .select(
        getArrayAggExpression(
          ncMeta.knex,
          ncMeta.knexConnection,
          'wta.roles',
          'workspace_team_roles',
        ),
      )
      .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
      .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as wta`, function () {
        this.on('wta.principal_ref_id', '=', 'pa.resource_id')
          .andOn('wta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
          .andOn('wta.resource_type', '=', ncMeta.knex.raw('?', ['workspace']))
          .andOn(
            ncMeta.knex.raw('COALESCE(wta.deleted, FALSE)'),
            '=',
            ncMeta.knex.raw('?', [false]),
          );
      })
      .where('pa.principal_type', '=', 'user')
      .where('pa.resource_type', '=', 'team')
      .where(
        ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
        '=',
        ncMeta.knex.raw('?', [false]),
      )
      .groupBy('pa.principal_ref_id')
      .as('wtr');

    // Subquery for base team roles (teams → base roles per user)
    const baseTeamRolesSubquery = ncMeta.knexConnection
      .select('pa.principal_ref_id as user_id')
      .select(
        getArrayAggExpression(
          ncMeta.knex,
          ncMeta.knexConnection,
          'bta.roles',
          'base_team_roles',
        ),
      )
      .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
      .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as bta`, function () {
        this.on('bta.principal_ref_id', '=', 'pa.resource_id')
          .andOn('bta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
          .andOn('bta.resource_type', '=', ncMeta.knex.raw('?', ['base']))
          .andOn(
            ncMeta.knex.raw('COALESCE(bta.deleted, FALSE)'),
            '=',
            ncMeta.knex.raw('?', [false]),
          );
      })
      .where('pa.principal_type', '=', 'user')
      .where('pa.resource_type', '=', 'team')
      .where(
        ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
        '=',
        ncMeta.knex.raw('?', [false]),
      )
      .groupBy('pa.principal_ref_id')
      .as('btr');

    // Single comprehensive query to get all user roles across the entire instance
    const allUserRoles = await ncMeta.knexConnection
      .select(
        `${MetaTable.USERS}.id as user_id`,
        'wu.roles as workspace_role',
        'bu.roles as base_role',
        'wtr.workspace_team_roles as workspace_team_roles',
        'btr.base_team_roles as base_team_roles',
      )
      .from(MetaTable.USERS)
      // Left join with direct workspace users (all workspaces)
      .leftJoin(`${MetaTable.WORKSPACE_USER} as wu`, function () {
        this.on(`${MetaTable.USERS}.id`, '=', 'wu.fk_user_id').andOn(
          ncMeta.knex.raw('COALESCE(wu.deleted, FALSE)'),
          '=',
          ncMeta.knex.raw('?', [false]),
        );
      })
      // Left join with direct base users (all bases)
      .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
        this.on(`${MetaTable.USERS}.id`, '=', 'bu.fk_user_id');
      })
      // Left join with workspace team roles subquery
      .leftJoin(
        workspaceTeamRolesSubquery,
        'wtr.user_id',
        `${MetaTable.USERS}.id`,
      )
      // Left join with base team roles subquery
      .leftJoin(baseTeamRolesSubquery, 'btr.user_id', `${MetaTable.USERS}.id`)
      // Filter: only users who have at least one role assignment
      .where(function () {
        this.whereNotNull('wu.fk_user_id')
          .orWhereNotNull('bu.fk_user_id')
          .orWhereNotNull('wtr.user_id')
          .orWhereNotNull('btr.user_id');
      });

    for (const userRole of allUserRoles) {
      const userId = userRole.user_id;

      // Collect all roles that the user has
      const effectiveRoles = [];

      // Extract base level role
      if (userRole.base_role && userRole.base_role !== ProjectRoles.INHERIT) {
        effectiveRoles.push(userRole.base_role);
      } else if (userRole.base_team_roles) {
        let baseTeamRoles = userRole.base_team_roles;
        if (typeof baseTeamRoles === 'string') {
          try {
            baseTeamRoles = JSON.parse(baseTeamRoles);
          } catch {
            baseTeamRoles = [baseTeamRoles];
          }
        }
        if (Array.isArray(baseTeamRoles)) {
          effectiveRoles.push(...baseTeamRoles);
        } else if (baseTeamRoles) {
          effectiveRoles.push(baseTeamRoles);
        }
      }

      // Extract workspace role
      if (
        userRole.workspace_role &&
        userRole.workspace_role !== WorkspaceUserRoles.INHERIT
      ) {
        effectiveRoles.push(userRole.workspace_role);
      } else if (userRole.workspace_team_roles) {
        let workspaceTeamRoles = userRole.workspace_team_roles;
        if (typeof workspaceTeamRoles === 'string') {
          try {
            workspaceTeamRoles = JSON.parse(workspaceTeamRoles);
          } catch {
            workspaceTeamRoles = [workspaceTeamRoles];
          }
        }
        if (Array.isArray(workspaceTeamRoles)) {
          effectiveRoles.push(...workspaceTeamRoles);
        } else if (workspaceTeamRoles) {
          effectiveRoles.push(workspaceTeamRoles);
        }
      }

      // Check if user has any seat-consuming role among all their roles
      const hasSeatConsumingRole = effectiveRoles.some(
        (role) => !NON_SEAT_ROLES.includes(role),
      );

      if (hasSeatConsumingRole) {
        if (!seatUsersMap.has(userId)) {
          seatUsersMap.set(userId, true);
        }
        if (nonSeatUsersMap.has(userId)) {
          nonSeatUsersMap.delete(userId);
        }
      } else {
        if (!seatUsersMap.has(userId) && !nonSeatUsersMap.has(userId)) {
          nonSeatUsersMap.set(userId, true);
        }
      }
    }

    // Org admins/owners are always billable seats
    const orgAdmins = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .whereIn('roles', [
        CloudOrgUserRoles.OWNER,
        CloudOrgUserRoles.ADMIN,
      ])
      .select('fk_user_id');

    for (const orgAdmin of orgAdmins) {
      if (!seatUsersMap.has(orgAdmin.fk_user_id)) {
        seatUsersMap.set(orgAdmin.fk_user_id, true);
        nonSeatUsersMap.delete(orgAdmin.fk_user_id);
      }
    }

    return seatUsersMap.size;
  }

  /**
   * Refresh license data from the license server
   * Called when local signature verification fails
   * Returns true if refresh succeeded, false otherwise
   */
  public static async refreshLicenseFromServer(
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    // Airgapped licenses must never phone home
    if (this._isAirgapped) return false;

    const licenseKey = process.env[LICENSE_ENV_VARS.LICENSE_KEY];

    try {
      // If we don't have installation data, we can't refresh
      if (!this.licenseData) {
        this.logger.warn(
          'Cannot refresh license: No installation data available. Please re-activate your license.',
        );
        return false;
      }

      const installationId = this.licenseData.installation_id;
      const installationSecret = this.licenseData.installation_secret;

      if (!installationId || !installationSecret) {
        this.logger.warn(
          'Cannot refresh license: Missing installation credentials. Please re-activate your license.',
        );
        return false;
      }

      // Calculate current seat count
      const seatCount = await this.calculateGlobalSeatCount(ncMeta);
      const timestamp = Date.now();

      // Build heartbeat payload with current domains
      const heartbeatPayload = {
        type: 'heartbeat',
        timestamp,
        version: 0,
        installation_id: installationId,
        seat_count: seatCount,
        environment: {
          domains: Array.from(Noco.domains), // Track accessed domains
          version: packageVersion,
          platform: process.platform,
        },
      };

      // Sign the heartbeat payload with installation_secret
      const signature = crypto
        .createHmac('sha256', installationSecret)
        .update(JSON.stringify(heartbeatPayload))
        .digest('hex');

      // Send heartbeat request to license server
      const requestBody = {
        ...heartbeatPayload,
        signature,
      };

      this.logger.log(
        `Refreshing license from server: ${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
      );

      const response = await fetch(
        `${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `License server returned error: ${JSON.stringify(
            await response.json(),
          )}`,
        );
        return false;
      }

      const data = (await response.json()) as {
        license_jwt: string;
        heartbeat_interval_ms: number;
      };

      // Verify JWT
      const licenseData = this.verifyAndDecodeLicenseJWT(data.license_jwt);
      if (!licenseData) {
        this.logger.error('Received invalid JWT from server');
        return false;
      }

      // Store updated license data
      await this.storeLicenseData(
        data.license_jwt,
        installationSecret,
        licenseKey,
        ncMeta,
      );

      this.licenseData = {
        ...licenseData,
        installation_secret: installationSecret,
        license_key: licenseKey,
        last_heartbeat_at: new Date().toISOString(),
      };

      this.currentHeartbeatInterval = data.heartbeat_interval_ms;
      this._isExpired = !this.isValidStatus(licenseData.status);

      this.logger.log('License data refreshed successfully from server');
      return true;
    } catch (error) {
      this.logger.error(`Failed to refresh license: ${error.message}`);
      return false;
    }
  }

  /**
   * Activate license with the license server
   * Called when no license data is found in nc_store
   * Returns true if activation succeeded, false otherwise
   */
  private static async activateLicense(
    licenseKey: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    try {
      const timestamp = Date.now();

      // Compute instance ID for license binding
      const instanceId = await getInstanceId(ncMeta);

      // Build activation payload
      const activationPayload = {
        type: 'register',
        timestamp,
        version: 0,
        license_key: licenseKey,
        instance_id: instanceId,
        environment: {
          version: packageVersion,
          platform: process.platform,
          domains: Array.from(Noco.domains),
        },
      };

      this.logger.log(`Activating license with server.`);

      const response = await fetch(
        `${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activationPayload),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `License server returned error: ${JSON.stringify(
            await response.json(),
          )}`,
        );
        return false;
      }

      const data = (await response.json()) as {
        installation_id: string;
        installation_secret: string;
        license_jwt: string;
        heartbeat_interval_ms: number;
      };

      // Verify JWT
      const licenseData = this.verifyAndDecodeLicenseJWT(data.license_jwt);
      if (!licenseData) {
        this.logger.error('Received invalid JWT from server');
        return false;
      }

      // Store license data
      await this.storeLicenseData(
        data.license_jwt,
        data.installation_secret,
        licenseKey,
        ncMeta,
      );

      this.licenseData = {
        ...licenseData,
        installation_secret: data.installation_secret,
        license_key: licenseKey,
        last_heartbeat_at: new Date().toISOString(),
      };

      this.currentHeartbeatInterval = data.heartbeat_interval_ms;
      this._isExpired = !this.isValidStatus(licenseData.status);

      this.logger.log(
        `License activated: ${licenseData.license_type} (${licenseData.status})`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to activate license: ${error.message}`);

      // Fallback: Try to validate as old-format license key
      const fallbackResult = await this.tryActivateWithOldLicense(
        licenseKey,
        ncMeta,
      );

      if (fallbackResult) {
        this.logger.log('Successfully validated legacy license key');
        return true;
      }

      return false;
    }
  }

  /**
   * Fallback activation using old license key format (pre-license-server)
   * This allows customers with old license keys to continue using NocoDB
   * even if they can't connect to the license server yet
   *
   * Unlike new licenses, old licenses are NOT stored in the database.
   * They are only loaded into memory and will trigger activation attempts
   * on every heartbeat until successfully upgraded.
   */
  private static async tryActivateWithOldLicense(
    licenseKey: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    try {
      // Try to verify the license key using the old public key
      const decoded = jwt.verify(licenseKey, LICENSE_SERVER_OLD_PUBLIC_KEY, {
        algorithms: ['RS256'],
      }) as any;

      if (!decoded || !decoded.siteUrl) {
        this.logger.warn('Invalid old license key format');
        return false;
      }

      // Map old license format to new license data structure (in-memory only)
      const licenseType =
        decoded.type === 'ENTERPRISE_TRIAL'
          ? LicenseType.ENTERPRISE_TRIAL
          : LicenseType.ENTERPRISE;

      this.licenseData = {
        installation_id: '', // Will be set when successfully activated with server
        installation_secret: '', // Will be set when successfully activated with server
        license_key: licenseKey,
        license_type: licenseType,
        status: InstallationStatus.ACTIVE,
        seat_count: decoded.maxUsers || 0,
        config: {
          limit_workspace: decoded.maxWorkspaces || undefined,
        },
        last_heartbeat_at: new Date().toISOString(),
      };

      // Use normal heartbeat interval
      this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_NORMAL_MS;
      this._isExpired = false;

      this.logger.log(
        `Legacy license loaded. System will attempt to activate with license server soon, please make sure to allow egress to https://app.nocodb.com/api/v1/on-premise/agent`,
      );

      return true;
    } catch (error) {
      // If verification fails due to expiration, still allow it (for old licenses)
      if (error instanceof jwt.TokenExpiredError) {
        this.logger.warn(
          'Old license key is expired, but allowing temporary operation',
        );

        try {
          // Decode without verification to get the data
          const decoded = jwt.decode(licenseKey, { json: true }) as any;

          if (!decoded || !decoded.siteUrl) {
            return false;
          }

          const licenseType =
            decoded.type === 'ENTERPRISE_TRIAL'
              ? LicenseType.ENTERPRISE_TRIAL
              : LicenseType.ENTERPRISE;

          this.licenseData = {
            installation_id: '',
            installation_secret: '',
            license_key: licenseKey,
            license_type: licenseType,
            status: InstallationStatus.ACTIVE,
            seat_count: decoded.maxUsers || 0,
            config: {
              limit_workspace: decoded.maxWorkspaces || undefined,
            },
            last_heartbeat_at: new Date().toISOString(),
          };

          this.currentHeartbeatInterval = this.HEARTBEAT_INTERVAL_NORMAL_MS;
          this._isExpired = false;

          this.logger.log(
            `Legacy license loaded. System will attempt to activate with license server soon, please make sure to allow egress to https://app.nocodb.com/api/v1/on-premise/agent`,
          );

          return true;
        } catch (decodeError) {
          this.logger.error(
            `Failed to decode expired license: ${decodeError.message}`,
          );
          return false;
        }
      }

      this.logger.error(`Failed to validate as old license: ${error.message}`);
      return false;
    }
  }

  // ───── Pre-Signed JWT License (Pure Airgapped) ─────

  /**
   * Initialize from a pre-signed license JWT (pure airgapped).
   * The JWT was generated offline by NocoDB from the customer's instance ID.
   * No network required — ever. The JWT is the license key itself.
   */
  private static async initFromSignedJWT(
    jwtToken: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Verify RSA signature
    const licenseData = this.verifyAndDecodeLicenseJWT(jwtToken);
    if (!licenseData) {
      throw new Error(
        'Invalid or expired license. Please contact NocoDB to obtain a renewed license.',
      );
    }

    // Airgapped licenses must have an expiration date
    if (!licenseData.expires_at) {
      throw new Error(
        'Airgapped licenses must have an expiration date. Please contact NocoDB to obtain a valid license.',
      );
    }

    // Verify instance ID
    const currentInstanceId = await getInstanceId(ncMeta);
    if (
      licenseData.instance_id &&
      licenseData.instance_id !== currentInstanceId
    ) {
      throw new Error(
        'This license is bound to a different installation. Please ensure you are using the correct license for this instance.',
      );
    }

    // Verify iat — clock not before issue date
    if (licenseData.iat) {
      const iatMs = licenseData.iat * 1000;
      const tolerance = LICENSE_CONFIG.CLOCK_TOLERANCE_MS;
      if (Date.now() < iatMs - tolerance) {
        throw new Error(
          'System clock appears to be incorrect. Please verify the system time is accurate and try again.',
        );
      }
    }

    // Check license expiry from claims
    if (
      licenseData.expires_at &&
      new Date(licenseData.expires_at) < new Date()
    ) {
      this._isExpired = true;
      this.logger.warn('License has expired');
    }

    this.licenseData = {
      ...licenseData,
      installation_secret: '',
      license_key: jwtToken,
    };
    this._isExpired =
      this._isExpired || !this.isValidStatus(this.licenseData.status);
    this._isAirgapped = true;

    this.logger.log(
      'Pre-signed license JWT loaded successfully (pure airgapped)',
    );

    this.startHeartbeatTimer();
  }

  // ───── Airgapped License Methods ─────

  /**
   * Initialize an airgapped license.
   * Loads from cache if available (verifying instance ID + clock),
   * otherwise performs a one-time online activation.
   */
  private static async initAirgapped(
    licenseKey: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Try loading from cache
    const storedData = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      { key: 'NC_LICENSE_DATA' },
    );

    if (storedData?.value) {
      try {
        const cached: CachedLicenseData = JSON.parse(storedData.value);

        // Verify instance ID BEFORE checking JWT validity.
        // An instance ID mismatch is a hard block — never fall through to re-activation.
        const decodedForInstanceCheck = jwt.decode(cached.license_jwt) as any;
        if (decodedForInstanceCheck?.instance_id) {
          const currentInstanceId = await getInstanceId(ncMeta);
          if (decodedForInstanceCheck.instance_id !== currentInstanceId) {
            throw new Error(
              'This license is bound to a different installation. Please ensure you are using the correct license for this instance.',
            );
          }
        }

        const licenseData = this.verifyAndDecodeLicenseJWT(cached.license_jwt);

        if (licenseData) {
          // Verify iat (issued-at) from the signed JWT — tamper-proof clock check.
          // If current time is before iat, the clock was rolled back after activation.
          if (licenseData.iat) {
            const iatMs = licenseData.iat * 1000; // JWT iat is in seconds
            const tolerance = LICENSE_CONFIG.CLOCK_TOLERANCE_MS;
            if (Date.now() < iatMs - tolerance) {
              throw new Error(
                'System clock appears to be incorrect. Please verify the system time is accurate and try again.',
              );
            }
          }

          // Check license expiry from claims
          if (
            licenseData.expires_at &&
            new Date(licenseData.expires_at) < new Date()
          ) {
            this._isExpired = true;
            this.logger.warn('Airgapped license has expired');
          }

          this.licenseData = {
            ...licenseData,
            installation_secret: cached.installation_secret,
            license_key: cached.license_key,
          };
          this._isExpired =
            this._isExpired || !this.isValidStatus(this.licenseData.status);
          this._isAirgapped = true;

          this.logger.log('Airgapped license loaded from cache successfully');
          this.startHeartbeatTimer();
          return;
        }

        // JWT expired (TokenExpiredError) — need to go online to renew
        this.logger.warn(
          'Airgapped license JWT has expired. Online renewal required.',
        );
      } catch (error) {
        // Installation binding and clock errors are fatal — re-throw, don't fall through to re-activation
        if (
          error.message.includes('bound to a different installation') ||
          error.message.includes('clock appears to be incorrect') ||
          error.message.includes('currently suspended') ||
          error.message.includes('currently revoked')
        ) {
          throw error;
        }
        this.logger.warn(
          `Failed to load cached airgapped license: ${error.message}`,
        );
      }
    }

    // No valid cache — perform one-time activation
    this.logger.log(
      'Airgapped license: performing one-time online activation...',
    );

    const activated = await this.activateAirgappedLicense(licenseKey, ncMeta);
    if (!activated) {
      throw new Error(
        'Airgapped license activation failed. Ensure network connectivity for one-time activation and that the license key is valid.',
      );
    }

    this._isAirgapped = true;
    this.logger.log('Airgapped license activated successfully');
    this.startHeartbeatTimer();
  }

  /**
   * One-time online activation for airgapped licenses.
   * Sends instance ID to the server for binding.
   */
  private static async activateAirgappedLicense(
    licenseKey: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    try {
      const instanceId = await getInstanceId(ncMeta);
      const timestamp = Date.now();

      const activationPayload = {
        type: 'register',
        timestamp,
        version: 0,
        license_key: licenseKey,
        instance_id: instanceId,
        airgapped: true,
        environment: {
          version: packageVersion,
          platform: process.platform,
          domains: Array.from(Noco.domains),
        },
      };

      const response = await fetch(
        `${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activationPayload),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Airgapped activation failed: ${JSON.stringify(
            await response.json(),
          )}`,
        );
        return false;
      }

      const data = (await response.json()) as {
        installation_id: string;
        installation_secret: string;
        license_jwt: string;
      };

      const licenseData = this.verifyAndDecodeLicenseJWT(data.license_jwt);
      if (!licenseData) {
        this.logger.error(
          'Received invalid JWT from server during airgapped activation',
        );
        return false;
      }

      // Verify instance ID in JWT matches what we sent
      if (licenseData.instance_id !== instanceId) {
        this.logger.error('License activation rejected — instance ID mismatch');
        return false;
      }

      // Store license data
      await this.storeLicenseData(
        data.license_jwt,
        data.installation_secret,
        licenseKey,
        ncMeta,
      );

      this.licenseData = {
        ...licenseData,
        installation_secret: data.installation_secret,
        license_key: licenseKey,
      };
      this._isExpired = !this.isValidStatus(licenseData.status);

      return true;
    } catch (error) {
      this.logger.error(`Airgapped activation error: ${error.message}`);
      return false;
    }
  }

  // ───── Clock Rollback Protection ─────

  // ───── Utility Methods ─────

  public static isInitialized(): boolean {
    return this.licenseData !== null;
  }

  public static getLicenseData(): LicenseData {
    if (!this.licenseData) {
      throw new Error('License not initialized');
    }
    return this.licenseData;
  }

  public static isTrial(): boolean {
    if (!this.licenseData) return false;
    return this.licenseData.license_type === LicenseType.ENTERPRISE_TRIAL;
  }

  public static getSeatCount(): number {
    if (!this.licenseData) return 0;
    return this.licenseData.seat_count;
  }

  public static getExpiry(): Date | undefined {
    if (!this.licenseData) return undefined;
    const expiresAt = this.licenseData.expires_at;
    return expiresAt ? new Date(expiresAt) : undefined;
  }

  public static getDaysUntilExpiration(): number | null {
    if (!this.licenseData) return null;
    const expiresAt = this.licenseData.expires_at;
    if (!expiresAt) return null;

    const now = new Date();
    const expirationDate = new Date(expiresAt);
    const diffMs = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  private static isValidStatus(status: InstallationStatus): boolean {
    return status === InstallationStatus.ACTIVE;
  }

  public static isValid(): boolean {
    if (!this.licenseData) return false;
    return this.isValidStatus(this.licenseData.status);
  }

  public static getStatus(): InstallationStatus | undefined {
    if (!this.licenseData) return undefined;
    return this.licenseData.status;
  }

  public static getLicenseType(): string | undefined {
    if (!this.licenseData) return undefined;
    return this.licenseData.license_type;
  }

  public static getHeartbeatInterval(): number {
    return this.currentHeartbeatInterval;
  }

  public static getWorkspaceLimit(): number | undefined {
    if (!this.licenseData) return undefined;
    return this.licenseData.config?.limit_workspace;
  }

  public static getConfig(): Record<string, any> | undefined {
    return this.licenseData?.config;
  }

  public static getOneWorkspace(): boolean {
    return this.getWorkspaceLimit() === 1;
  }

  public static shouldBlockAccess(): boolean {
    // Never hard-block access — the instance falls back to CE mode instead.
    // isEE returns false when the license is invalid, suspended, or grace
    // period has expired, which makes LicenseGuard reject EE-only endpoints
    // while still allowing CE functionality.
    return false;
  }

  public static isInGracePeriod(): boolean {
    if (!this.heartbeatState?.last_success_at) {
      // No successful heartbeat recorded - within grace period
      return true;
    }

    const lastSuccess = new Date(this.heartbeatState.last_success_at);
    const gracePeriodEnd = new Date(
      lastSuccess.getTime() + this.HEARTBEAT_GRACE_PERIOD_MS,
    );

    return Date.now() < gracePeriodEnd.getTime();
  }

  private static updateHeartbeatState(success: boolean): void {
    const now = new Date().toISOString();

    if (!this.heartbeatState) {
      // Initialize heartbeat state on first attempt
      this.heartbeatState = {
        last_attempt_at: now,
        last_success_at: success ? now : now, // On first attempt, set both
        consecutive_failures: success ? 0 : 1,
        grace_period_expires_at: new Date(
          Date.now() + this.HEARTBEAT_GRACE_PERIOD_MS,
        ).toISOString(),
      };
    } else {
      // Update existing state
      this.heartbeatState.last_attempt_at = now;

      if (success) {
        this.heartbeatState.last_success_at = now;
        this.heartbeatState.consecutive_failures = 0;
        this.heartbeatState.grace_period_expires_at = new Date(
          Date.now() + this.HEARTBEAT_GRACE_PERIOD_MS,
        ).toISOString();
      } else {
        this.heartbeatState.consecutive_failures += 1;
      }
    }

    // Log heartbeat state for monitoring
    if (!success) {
      this.logger.warn(
        `License verification failed (${
          this.heartbeatState.consecutive_failures
        } consecutive failures). Grace period: ${this.getDaysInGracePeriod()} days remaining`,
      );
    }
  }

  public static getHeartbeatState(): HeartbeatState | null {
    return this.heartbeatState;
  }

  public static getDaysInGracePeriod(): number | null {
    if (!this.heartbeatState?.grace_period_expires_at) {
      return null;
    }

    const expiresAt = new Date(this.heartbeatState.grace_period_expires_at);
    const diffMs = expiresAt.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }
}
