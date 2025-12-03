import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { LICENSE_CONFIG } from '~/utils/license';
import {
  type InstallationMeta,
  InstallationStatus,
  type LicenseType,
  type MetaFieldConfig,
  MetaUpdateStrategy,
} from '~/utils/license';

/**
 * Default metadata field configurations
 */
const META_CONFIG: Record<string, MetaFieldConfig> = {
  'environment.domains': {
    strategy: MetaUpdateStrategy.APPEND,
    arrayMergeDedup: true,
  },
  'environment.version': {
    strategy: MetaUpdateStrategy.OVERWRITE,
  },
  'environment.platform': {
    strategy: MetaUpdateStrategy.OVERWRITE,
  },
};

/**
 * Installation model for on-premise licensing system
 *
 * This model manages the lifecycle of on-premise installations including:
 * - License activation and validation
 * - Heartbeat tracking
 * - Seat usage monitoring
 * - Server-controlled license state
 */
export default class Installation {
  id: string;

  // Subscription relationship (optional for Stripe-based billing)
  fk_subscription_id?: string;

  // License information
  licensed_to: string; // Organization/company name
  license_key: string; // Unique license key provided to customer

  // Authentication using HMAC signatures
  // Server uses NC_ON_PREMISE_SECRET env variable
  // Client receives a derived secret during activation
  installation_secret: string; // Client-specific HMAC secret (derived from master + installation_id)

  // Timestamps
  installed_at: Date;
  last_seen_at: Date;
  expires_at?: Date; // Optional expiration date

  // License configuration
  license_type: LicenseType;
  status: InstallationStatus;

  // Seat management
  seat_count: number; // Current active users

  // License configuration
  config?: Record<string, any>; // JSON string representing limits, features, etc.

  // Additional metadata as JSON
  meta?: InstallationMeta;

  // Audit timestamps
  created_at: Date;
  updated_at: Date;

  constructor(installation: Partial<Installation>) {
    Object.assign(this, installation);
  }

  public static async get(
    installationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Installation | null> {
    const cacheKey = `${CacheScope.INSTALLATION}:${installationId}`;

    let installation = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (!installation) {
      installation = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.INSTALLATIONS,
        { id: installationId },
      );

      if (!installation) return null;

      installation = prepareForResponse(installation, ['meta', 'config']);
      await NocoCache.set('root', cacheKey, installation);

      // Set alias cache keys for lookups
      await NocoCache.set(
        'root',
        `${CacheScope.INSTALLATION_ALIAS}:license_key:${installation.license_key}`,
        cacheKey,
      );
    }

    return new Installation(installation);
  }

  public static async getByLicenseKey(
    licenseKey: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Installation | null> {
    const aliasKey = `${CacheScope.INSTALLATION_ALIAS}:license_key:${licenseKey}`;
    const cacheKey = await NocoCache.get(
      'root',
      aliasKey,
      CacheGetType.TYPE_STRING,
    );

    let installation = cacheKey
      ? await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT)
      : null;

    if (!installation) {
      installation = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.INSTALLATIONS,
        {},
        null,
        {
          license_key: {
            eq: licenseKey,
          },
        },
      );

      if (!installation) return null;

      installation = prepareForResponse(installation, ['meta', 'config']);

      const key = `${CacheScope.INSTALLATION}:${installation.id}`;
      await NocoCache.set('root', key, installation);
      await NocoCache.set('root', aliasKey, key);
    }

    return new Installation(installation);
  }

  public static async getBySubscriptionId(
    subscriptionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Installation | null> {
    const aliasKey = `${CacheScope.INSTALLATION_ALIAS}:subscription:${subscriptionId}`;
    const cacheKey = await NocoCache.get(
      'root',
      aliasKey,
      CacheGetType.TYPE_STRING,
    );

    let installation = cacheKey
      ? await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT)
      : null;

    if (!installation) {
      installation = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.INSTALLATIONS,
        {},
        null,
        {
          fk_subscription_id: {
            eq: subscriptionId,
          },
        },
      );

      if (!installation) return null;

      installation = prepareForResponse(installation, ['meta', 'config']);

      const key = `${CacheScope.INSTALLATION}:${installation.id}`;
      await NocoCache.set('root', key, installation);
      await NocoCache.set('root', aliasKey, key);
    }

    return new Installation(installation);
  }

  public static async insert(
    installation: Partial<Installation>,
    ncMeta = Noco.ncMeta,
  ): Promise<Installation> {
    const insertObj: Record<string, any> = extractProps(installation, [
      'fk_subscription_id',
      'licensed_to',
      'license_key',
      'installed_at',
      'last_seen_at',
      'expires_at',
      'license_type',
      'status',
      'seat_count',
      'meta',
      'config',
    ]);

    // Set defaults for new installation
    insertObj.status = insertObj.status || InstallationStatus.PENDING;
    insertObj.seat_count = insertObj.seat_count || 0;

    // Only set timestamps for non-PENDING installations
    if (insertObj.status !== InstallationStatus.PENDING) {
      insertObj.installed_at = insertObj.installed_at || new Date();
      insertObj.last_seen_at = insertObj.last_seen_at || new Date();
    }

    // Validate required fields
    if (!insertObj.license_key) {
      throw new Error('License key is required');
    }
    if (!insertObj.licensed_to) {
      throw new Error('Licensed to field is required');
    }
    if (!insertObj.license_type) {
      throw new Error('License type is required');
    }

    // First insert to get installation ID
    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INSTALLATIONS,
      prepareForDb(insertObj, ['meta', 'config']),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    installationId: string,
    installation: Partial<Installation>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateObj: Record<string, any> = extractProps(installation, [
      'fk_subscription_id',
      'installation_secret',
      'last_seen_at',
      'expires_at',
      'status',
      'seat_count',
      'license_type',
      'meta',
      'config',
    ]);

    // Prevent updating sensitive fields
    delete updateObj.license_key;
    delete updateObj.licensed_to;

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INSTALLATIONS,
      prepareForDb(updateObj, ['meta', 'config']),
      installationId,
    );

    // Update cache
    const cacheKey = `${CacheScope.INSTALLATION}:${installationId}`;
    await NocoCache.update(
      'root',
      cacheKey,
      prepareForResponse(updateObj, ['meta', 'config']),
    );

    return true;
  }

  public static async updateStatus(
    installationId: string,
    status: InstallationStatus,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    return this.update(installationId, { status }, ncMeta);
  }

  public static async updateSeatCount(
    installationId: string,
    seatCount: number,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const installation = await this.get(installationId, ncMeta);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    const meta = installation.meta || {};

    return this.update(
      installationId,
      {
        seat_count: seatCount,
        last_seen_at: new Date(),
        meta,
      },
      ncMeta,
    );
  }

  public static async recordHeartbeat(
    installationId: string,
    seatCount?: number,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateData: Partial<Installation> = {
      last_seen_at: new Date(),
    };

    if (seatCount !== undefined) {
      const installation = await this.get(installationId, ncMeta);
      if (!installation) {
        throw new Error(`Installation ${installationId} not found`);
      }

      const meta = installation.meta || {};

      updateData.seat_count = seatCount;
      updateData.meta = meta;
    }

    return this.update(installationId, updateData, ncMeta);
  }

  /**
   * Merge metadata with the current installation metadata using configured update strategies
   * @param installationId - Installation ID to update
   * @param newMeta - New metadata to merge
   * @param config - Optional custom configuration for field update strategies
   * @returns Promise<boolean> - True if update succeeded
   */
  public static async mergeMeta(
    installationId: string,
    newMeta: Partial<InstallationMeta>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const installation = await this.get(installationId, ncMeta);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    const currentMeta = installation.meta || {};
    const mergedMeta = this.mergeMetaFields(currentMeta, newMeta, META_CONFIG);

    // if currentMeta is changed, then update
    try {
      if (JSON.stringify(currentMeta) === JSON.stringify(mergedMeta)) {
        return true;
      }
    } catch (error) {
      // Log error if needed
      console.error('Error comparing metadata:', error);
    }

    // add last_environment_update timestamp if environment is updated
    if (newMeta.environment) {
      mergedMeta['last_environment_update'] = new Date().toISOString();
    }

    return this.update(
      installationId,
      {
        meta: mergedMeta,
      },
      ncMeta,
    );
  }

  /**
   * Recursively merge metadata fields based on configured strategies
   * @param current - Current metadata object
   * @param incoming - Incoming metadata to merge
   * @param config - Field update strategy configuration
   * @param path - Current path in the object tree (for nested field lookups)
   * @returns Merged metadata object
   */
  private static mergeMetaFields(
    current: any,
    incoming: any,
    config: Record<string, MetaFieldConfig>,
    path: string = '',
  ): any {
    if (incoming === undefined || incoming === null) {
      return current;
    }

    // Handle non-object primitives
    if (typeof incoming !== 'object' || incoming === null) {
      const fieldConfig = config[path];
      if (fieldConfig?.strategy === MetaUpdateStrategy.PRESERVE) {
        return current;
      }
      return incoming;
    }

    // Handle arrays
    if (Array.isArray(incoming)) {
      const fieldConfig = config[path];

      if (fieldConfig?.strategy === MetaUpdateStrategy.PRESERVE) {
        return current;
      }

      if (fieldConfig?.strategy === MetaUpdateStrategy.APPEND) {
        const currentArray = Array.isArray(current) ? current : [];
        const merged = [...currentArray, ...incoming];

        // Deduplicate if configured
        if (fieldConfig.arrayMergeDedup) {
          return [...new Set(merged)];
        }

        return merged;
      }

      // Default to OVERWRITE for arrays
      return incoming;
    }

    // Handle objects - recursively merge
    const result = { ...current };

    for (const key of Object.keys(incoming)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const fieldConfig = config[fieldPath];

      if (fieldConfig?.strategy === MetaUpdateStrategy.PRESERVE) {
        // Keep existing value, skip incoming
        continue;
      }

      if (fieldConfig?.strategy === MetaUpdateStrategy.OVERWRITE) {
        // Replace with incoming value
        result[key] = incoming[key];
        continue;
      }

      // For APPEND or unspecified, recursively merge if both are objects
      if (
        typeof incoming[key] === 'object' &&
        incoming[key] !== null &&
        !Array.isArray(incoming[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.mergeMetaFields(
          result[key],
          incoming[key],
          config,
          fieldPath,
        );
      } else {
        // Otherwise, use the specific merge logic
        result[key] = this.mergeMetaFields(
          result[key],
          incoming[key],
          config,
          fieldPath,
        );
      }
    }

    return result;
  }

  public static async delete(
    installationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const installation = await this.get(installationId, ncMeta);

    if (!installation) return false;

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INSTALLATIONS,
      installationId,
    );

    // Clear all cache entries
    const cacheKey = `${CacheScope.INSTALLATION}:${installationId}`;
    await NocoCache.del('root', cacheKey);
    await NocoCache.del(
      'root',
      `${CacheScope.INSTALLATION_ALIAS}:license_key:${installation.license_key}`,
    );

    if (installation.fk_subscription_id) {
      await NocoCache.del(
        'root',
        `${CacheScope.INSTALLATION_ALIAS}:subscription:${installation.fk_subscription_id}`,
      );
    }

    return true;
  }

  /**
   * Verify HMAC signature from client
   * Used for authenticating heartbeat requests
   *
   * @param data - The data that was signed (typically JSON payload)
   * @param signature - The HMAC signature from the client (hex encoded)
   * @returns true if signature is valid
   */
  public verifyClientSignature(data: string, signature: string): boolean {
    if (!this.installation_secret || !signature) {
      return false;
    }

    try {
      const expectedSignature = this.computeHMAC(
        data,
        this.installation_secret,
      );

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      return false;
    }
  }

  private computeHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  public signData(data: string): string {
    if (!this.installation_secret) {
      throw new Error('Installation secret not found');
    }

    return this.computeHMAC(data, this.installation_secret);
  }

  private static async getMasterSecret(ncMeta = Noco.ncMeta): Promise<string> {
    let secret = process.env.NC_ON_PREMISE_SECRET;

    if (secret) {
      if (secret.length < 32) {
        throw new Error(
          'NC_ON_PREMISE_SECRET must be at least 32 characters long for security.',
        );
      }
      return secret;
    }

    const storedSecret = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      {
        key: 'NC_ON_PREMISE_SECRET',
      },
    );

    if (storedSecret?.value) {
      secret = storedSecret.value;
      return secret;
    }

    secret = this.generateMasterSecret(64); // 128 hex chars

    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      {
        key: 'NC_ON_PREMISE_SECRET',
        value: secret,
      },
      true,
    );

    return secret;
  }

  /**
   * Derive a client-specific secret using HKDF (HMAC-based Key Derivation Function)
   *
   * HKDF is a cryptographic key derivation function defined in RFC 5869
   * It's designed to extract and expand cryptographic keys from input key material
   *
   * @param installationId - Unique installation identifier (used as info parameter)
   * @param ncMeta - Database connection
   * @returns 64-character hex string (256 bits of entropy)
   */
  public static async deriveClientSecret(
    installationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string> {
    const masterSecret = await this.getMasterSecret(ncMeta);

    // HKDF Parameters:
    // - hash: 'sha256' - Use SHA-256 as the underlying hash function
    // - ikm: masterSecret - Input Key Material (master secret)
    // - salt: 'nocodb-license-v1' - Salt for additional entropy and domain separation
    // - info: installation ID - Context-specific information
    // - keylen: 32 - Output 32 bytes (256 bits)
    return new Promise((resolve, reject) => {
      crypto.hkdf(
        'sha256',
        Buffer.from(masterSecret, 'hex'),
        'nocodb-license-v1', // Salt for domain separation
        `installation:${installationId}`, // Info (context)
        32, // Output length in bytes (256 bits)
        (err, derivedKey) => {
          if (err) {
            reject(new Error(`HKDF derivation failed: ${err.message}`));
          } else {
            // Convert ArrayBuffer to hex string
            resolve(Buffer.from(derivedKey).toString('hex'));
          }
        },
      );
    });
  }

  public getClientSecret(): string {
    if (!this.installation_secret) {
      throw new Error('Installation secret not initialized');
    }
    return this.installation_secret;
  }

  public isValid(): boolean {
    // Check status
    if (
      this.status === InstallationStatus.PENDING ||
      this.status === InstallationStatus.REVOKED ||
      this.status === InstallationStatus.SUSPENDED ||
      this.status === InstallationStatus.EXPIRED
    ) {
      return false;
    }

    // Check expiration
    if (this.expires_at && new Date() > new Date(this.expires_at)) {
      return false;
    }

    return true;
  }

  public getDaysUntilExpiration(): number | null {
    if (!this.expires_at) {
      return null; // No expiration
    }

    const now = new Date();
    const expirationDate = new Date(this.expires_at);
    const diffMs = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  public static generateMasterSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Get RSA key pair for JWT signing
   * Requires NC_LICENSE_SERVER_PRIVATE_KEY environment variable to be set
   *
   * @returns RSA key pair (private and public keys in PEM format)
   * @throws Error if NC_LICENSE_SERVER_PRIVATE_KEY is not set
   */
  private static async getServerKeys(): Promise<{
    privateKey: string;
    publicKey: string;
  }> {
    const privateKey = process.env.NC_LICENSE_SERVER_PRIVATE_KEY;
    const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAodQkNztOFlnvajjcrJYl
aM5zEyApANuJBaipGgKaXnVWseSEX32x8pqD6CuDS7TXbmsJ7VTRou0bhaCoPi/O
zYWPLxIoCDwgWkyeFqOJgAzUv0AEx/Z6Ecj12Eu561WeaHvR5CjurmF94q7lrrUl
uvrnnTxZpHU3Gj7YpFIopSRgmF1KDv/QnrkkS94RhBUQrr56j0j5PXnEsZHNsWRs
iuw1xDDNsCsonzp81T7zIKVS65v2S5DvuOpesBt2xRbfY1T3ONH8MFZyfmcucdhf
CmIgS4CsVOV8eBGWsB3JrpmLKQqmApUBW8I1vQgXP5C7FabY5wb9fO+TXsw+4u+o
mwIDAQAB
-----END PUBLIC KEY-----`;

    if (!privateKey) {
      throw new Error(
        'NC_LICENSE_SERVER_PRIVATE_KEY environment variable is required for license server functionality',
      );
    }

    if (!publicKey) {
      throw new Error(
        'NC_LICENSE_SERVER_PUBLIC_KEY environment variable is required for license server functionality',
      );
    }

    return { privateKey, publicKey };
  }

  /**
   * Sign license state as JWT using server's private key
   * This prevents clients from tampering with license data
   *
   * @param installation - Installation instance to sign
   * @param ncMeta - Database connection
   * @returns Signed JWT token containing license state
   */
  public static async signLicenseStateJWT(
    installation: Installation,
  ): Promise<string> {
    const { privateKey } = await this.getServerKeys();

    return jwt.sign(
      {
        installation_id: installation.id,
        license_key: installation.license_key,
        license_type: installation.license_type,
        status: installation.status,
        seat_count: installation.seat_count,
        expires_at: installation.expires_at,
        config: installation.config,
      },
      privateKey,
      {
        algorithm: LICENSE_CONFIG.JWT_ALGORITHM,
        expiresIn: LICENSE_CONFIG.JWT_EXPIRY,
      },
    );
  }

  public static async initializeLicenseServer(
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Ensure master secret is initialized
    await this.getMasterSecret(ncMeta);

    // Ensure RSA keys are initialized
    await this.getServerKeys();
  }
}
