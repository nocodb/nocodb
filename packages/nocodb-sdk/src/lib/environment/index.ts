/**
 * Environments — workspace-scoped stages (development / staging / production …)
 * that resolve integration configuration per stage. See the `environments` branch
 * design doc. This branch: environments apply to INTEGRATIONS only.
 */

/** Reserved default environment keys present for every workspace. */
export enum DefaultEnvironmentKey {
  PRODUCTION = 'production',
  STAGING = 'staging',
}

/** The default (fallback) environment — its config is `integration.config`. */
export const DEFAULT_ENVIRONMENT_KEY = DefaultEnvironmentKey.PRODUCTION;

export interface EnvironmentType {
  id?: string;
  /** Set for a WORKSPACE-scoped environment (exactly one of ws/org is set). */
  fk_workspace_id?: string;
  /** Set for an ORG-scoped environment, shared by all the org's workspaces. */
  fk_org_id?: string;
  /** Stable slug used by `ctx.environment` + the `_environment` URL param.
   * Auto-derived from `title` at create time and frozen thereafter (renaming
   * the title never changes it). */
  key?: string;
  title?: string;
  /** Optional human description shown on the environment card / editor. */
  description?: string;
  /** A solid color (hex) used for the environment's dot/badge. */
  color?: string;
  order?: number;
  /** The fallback environment (production). Its config lives on the integration. */
  is_default?: boolean;
  /** Locked = cannot be renamed/removed (production). */
  is_locked?: boolean;
  meta?: Record<string, any>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EnvironmentReqType {
  /** Human-readable name. The stable `key` slug is auto-derived from this
   * server-side at create time — clients never send a key. */
  title?: string;
  description?: string;
  color?: string;
  order?: number;
}

/**
 * Virtual default environments — `production` (default, locked) + `staging`.
 * Present for EVERY workspace/org with **no DB row** (their `id` is the reserved
 * key, distinct from generated `env…` ids). The backend synthesizes these in
 * `Environment.listEffective`; the frontend renders them alongside custom
 * environments. `production` is the permanent default; its config is the
 * integration's own (`integration.config`) — see the environments design.
 */
export const DEFAULT_ENVIRONMENTS: EnvironmentType[] = [
  {
    id: DefaultEnvironmentKey.PRODUCTION,
    key: DefaultEnvironmentKey.PRODUCTION,
    title: 'Production',
    description:
      'The default. Your live apps and automations always run on this configuration.',
    color: '#17803d', // solid green
    order: -2,
    is_default: true,
    is_locked: true,
  },
  {
    id: DefaultEnvironmentKey.STAGING,
    key: DefaultEnvironmentKey.STAGING,
    title: 'Staging',
    description:
      'Pick this while building apps or creating a sandbox, to test against non-production data.',
    color: '#c2410c', // solid orange
    order: -1,
    is_locked: true,
  },
];

/**
 * Per-environment integration config OVERRIDE. Only non-default environments get
 * a row; the default/production config stays in `integration.config`.
 * `config` is decrypted on read for authorized callers, masked otherwise.
 */
export interface IntegrationEnvConfigType {
  id?: string;
  fk_workspace_id?: string;
  fk_integration_id?: string;
  fk_environment_id?: string;
  config?: Record<string, any>;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}
