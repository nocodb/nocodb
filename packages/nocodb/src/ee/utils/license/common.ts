/**
 * Installation status enum representing the lifecycle of an on-premise installation
 */
export enum InstallationStatus {
  PENDING = 'pending', // License key created but not yet activated by end user
  ACTIVE = 'active', // License is active and valid
  EXPIRED = 'expired', // License has expired
  REVOKED = 'revoked', // License has been revoked by server
  SUSPENDED = 'suspended', // Temporarily suspended (e.g., payment issues)
}

/**
 * License type enum representing different licensing tiers
 */
export enum LicenseType {
  ENTERPRISE_TRIAL = 'enterprise_trial',
  ENTERPRISE_STARTER = 'enterprise_starter',
  ENTERPRISE = 'enterprise',
}

/**
 * Metadata update directives
 */
export enum MetaUpdateStrategy {
  OVERWRITE = 'overwrite', // Replace the existing value
  APPEND = 'append', // Append to arrays, merge objects
  PRESERVE = 'preserve', // Keep existing value, ignore new value
}

/**
 * Metadata field configuration defining update behavior
 */
export interface MetaFieldConfig {
  strategy: MetaUpdateStrategy;
  arrayMergeDedup?: boolean; // For APPEND strategy: deduplicate array items
}

/**
 * Installation metadata interface for storing additional data as JSON
 */
export interface InstallationMeta {
  // Environment information collected during activation and updated via heartbeats
  environment?: {
    version?: string;
    platform?: string;
    domains?: string[]; // Append-only array of all domains ever accessed by this installation
  };
  // Additional custom fields
  [key: string]: any;
}
