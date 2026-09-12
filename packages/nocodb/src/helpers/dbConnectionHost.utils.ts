/**
 * Pick the connection host that must be SSRF range-checked for a DB source.
 *
 * Returns undefined for clients whose network target is not a `connection.host`
 * TCP endpoint — sqlite (file-based) and snowflake (account/URL-based) — and when
 * no host is present, so the caller validates only real, checkable hosts. Mirrors
 * the client exclusions the test-connection path already applies. Used to wire
 * SSRF host validation into the source-create path (GHSA-m4v9-qmg3-6h7p).
 */
export function getValidatableDbHost(
  config:
    | { client?: string; connection?: { host?: unknown } }
    | undefined
    | null,
): string | undefined {
  const client = config?.client;
  if (!client) return undefined;
  // sqlite is file-based; snowflake connects by account/URL — neither uses
  // connection.host as the routable TCP target.
  if (client.includes('sqlite') || client === 'snowflake') return undefined;

  const host = config?.connection?.host;
  return typeof host === 'string' && host.length > 0 ? host : undefined;
}

type DbHostConfig =
  | { client?: string; connection?: { host?: unknown } }
  | undefined
  | null;

/**
 * Resolve the connection host to SSRF range-check for a source-create request,
 * accounting for the integration-backed path.
 *
 * When a source references an integration (`fk_integration_id`), the routable
 * host lives in the integration's config — the inline body only overrides
 * specific fields (e.g. `connection.database` / `searchPath`) and is merged on
 * top at connect time (see Source.getConfig). Range-checking only `body.config`
 * therefore misses the host for integration-backed sources, letting them point
 * at internal hosts (GHSA-m4v9 review follow-up). Callers pass the referenced
 * integration's config so the host resolves against the merged result, with any
 * inline body value still winning — mirroring the EE controller.
 */
export function getValidatableSourceCreateHost(
  bodyConfig: DbHostConfig,
  integrationConfig?: DbHostConfig,
): string | undefined {
  if (!integrationConfig) return getValidatableDbHost(bodyConfig);

  // The integration supplies client + host; the body overrides only specific
  // fields. An inline host/client, if present, still wins.
  const merged = {
    client: bodyConfig?.client ?? integrationConfig.client,
    connection: {
      ...integrationConfig.connection,
      ...bodyConfig?.connection,
    },
  };

  return getValidatableDbHost(merged);
}
