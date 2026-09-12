/**
 * Per-user integration credentials — the credential-sharing axis on AUTH
 * integrations. A `shared` integration (the default) has one credential everyone
 * uses; a `per_user` one holds NO usable token of its own, so every user connects
 * their own account and the provider's own access control applies per user.
 *
 * Only OAuth2 authorization-code providers qualify — an API-key credential is
 * workspace infrastructure with no user identity in it. The package opts in via
 * `allowsPerUserCredentials`, and the instance creator flips `credential_mode`.
 *
 * A PRIMITIVE for the Apps platform: app routines execute as the logged-in viewer
 * and resolve that viewer's connection. Sync and workflow nodes reject per-user
 * integrations outright.
 */
export enum IntegrationCredentialMode {
  SHARED = 'shared',
  PER_USER = 'per_user',
}

/**
 * A user's own credential for one (integration, environment) — the row shape
 * of `nc_integration_user_configs`. `config` NEVER leaves the backend (not
 * even to its owner); clients only ever see connection state.
 */
export interface IntegrationUserConfigType {
  id?: string;
  fk_workspace_id?: string;
  fk_integration_id?: string;
  fk_user_id?: string;
  /** `'production'` / `'staging'` / a custom env id. Unlike env-config
   * overrides, `production` IS stored here — per-user mode has no fallback
   * to the shared config, so production needs its own row. */
  fk_environment_id?: string;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * The REQUESTING user's connection state for one per-user integration —
 * returned by the `integrationUserCredentialConnect`/`Disconnect` ops (and
 * their base-scoped variants) so the client can update its UI without a
 * follow-up read. For browsing/discovery there is NO standalone state
 * endpoint: the (viewer+) integration list/read responses attach
 * `connected_environment_ids` on per-user integrations instead. No secrets
 * ever — ids, title and provider only.
 */
export interface IntegrationUserCredentialStateType {
  fk_integration_id?: string;
  title?: string;
  sub_type?: string;
  /** Environment ids the requesting user has connected (incl. `production`). */
  connected_environment_ids?: string[];
}
