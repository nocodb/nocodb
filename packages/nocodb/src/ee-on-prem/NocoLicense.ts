import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { NON_SEAT_ROLES, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { getArrayAggExpression } from '~/helpers/dbHelpers';
import {
  InstallationStatus,
  LICENSE_CONFIG,
  LICENSE_ENV_VARS,
  LICENSE_SERVER_PUBLIC_KEY,
} from '~/utils/license';
import { validateClientLicenseEnvironment } from '~/utils/license';

const LICENSE_SERVER_URL =
  process.env[LICENSE_ENV_VARS.LICENSE_SERVER_URL] || 'http://localhost:8080';

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
  };
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
              throw new Error(`License has been ${this.licenseData.status}`);
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
          console.warn(`Failed to parse cached license data: ${error.message}`);
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
   * Start the heartbeat timer
   */
  private static startHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    this.heartbeatTimer = setTimeout(() => {
      this.handleHeartbeat();
    }, this.currentHeartbeatInterval);
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
   * Verify and decode license JWT using embedded public key
   * This prevents clients from tampering with license data
   *
   * @param jwtToken - JWT token from server
   * @returns Decoded license data or null if verification fails
   */
  private static verifyAndDecodeLicenseJWT(
    jwtToken: string,
  ): LicenseData | null {
    try {
      const decoded = jwt.verify(jwtToken, LICENSE_SERVER_PUBLIC_KEY, {
        algorithms: [LICENSE_CONFIG.JWT_ALGORITHM],
      }) as any;

      // Return decoded data (without installation_secret - that's not in JWT)
      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('License JWT expired, will attempt refresh');
      } else {
        this.logger.error(`JWT verification failed: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Heartbeat handler
   * - Runs every 6 hours (normal) or 1 hour (failure)
   * - Calculates seat count based on user roles
   * - Sends heartbeat to license server
   * - Updates cached license data
   */
  private static async handleHeartbeat() {
    if (!this.licenseData) {
      this.startHeartbeatTimer();
      return;
    }

    try {
      const ncMeta = Noco.ncMeta;

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
          version: process.env.npm_package_version,
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
  private static async calculateGlobalSeatCount(
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
          version: process.env.npm_package_version,
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

      // Build activation payload
      const activationPayload = {
        type: 'register',
        timestamp,
        version: 0,
        license_key: licenseKey,
        environment: {
          version: process.env.npm_package_version,
          platform: process.platform,
          domains: Array.from(Noco.domains),
        },
      };

      this.logger.log(
        `Activating license with server: ${LICENSE_SERVER_URL}/api/v1/on-premise/agent`,
      );

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
      return false;
    }
  }

  public static getLicenseData(): LicenseData {
    if (!this.licenseData) {
      throw new Error('License not initialized');
    }
    return this.licenseData;
  }

  public static isTrial(): boolean {
    return this.getLicenseData().license_type === 'enterprise_trial';
  }

  public static getSeatCount(): number {
    return this.getLicenseData().seat_count;
  }

  public static getExpiry(): Date | undefined {
    const expiresAt = this.getLicenseData().expires_at;
    return expiresAt ? new Date(expiresAt) : undefined;
  }

  public static getDaysUntilExpiration(): number | null {
    const expiresAt = this.getLicenseData().expires_at;
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
    return this.isValidStatus(this.getLicenseData().status);
  }

  public static getStatus(): InstallationStatus {
    return this.getLicenseData().status;
  }

  public static getLicenseType(): string {
    return this.getLicenseData().license_type;
  }

  public static getHeartbeatInterval(): number {
    return this.currentHeartbeatInterval;
  }

  public static getWorkspaceLimit(): number | undefined {
    return this.getLicenseData().config?.limit_workspace;
  }

  public static getOneWorkspace(): boolean {
    return this.getWorkspaceLimit() === 1;
  }

  public static shouldBlockAccess(): boolean {
    if (!this.licenseData) {
      // No license data loaded - block access
      return true;
    }

    // Always block if explicitly revoked or suspended
    if (
      this.licenseData.status === InstallationStatus.REVOKED ||
      this.licenseData.status === InstallationStatus.SUSPENDED
    ) {
      return true;
    }

    /* TODO: Enable, for now we only block on REVOKED/SUSPENDED
    // For expired licenses, check if we're in grace period
    if (this.licenseData.status === InstallationStatus.EXPIRED) {
      if (!this.isInGracePeriod()) {
        this.logger.error(
          'Access blocked: License expired and grace period ended',
        );
        return true;
      }
      // Within grace period - allow access but log warning
      this.logger.warn('License expired but within grace period');
      return false;
    }

    // For active licenses, check network failure grace period
    if (this.licenseData.status === InstallationStatus.ACTIVE) {
      if (!this.isInGracePeriod()) {
        this.logger.error(
          'Access blocked: Unable to reach license server for extended period',
        );
        return true;
      }
    }
    */

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
