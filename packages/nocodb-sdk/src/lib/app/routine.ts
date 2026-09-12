/**
 * What an action acts on — and therefore the one question install has to answer:
 * does the installer bind a connection, or not.
 *
 * `platform` is ours, and which surface is named by `source_ref.action`'s namespace
 * (`nc.data.list`, `nc.members.invite`), so shipping a new platform surface does not
 * widen this union. `integration` is a connected system whatever its protocol — a
 * Postgres database and a Google Calendar are the same kind of thing here.
 */
export type RoutineSourceType = 'platform' | 'integration';

export type HttpRoutineMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Bare ops of the `nc.members` platform namespace — the app's own membership
 * surface. Action ids are formed as `nc.members.<op>`, and the capability is
 * derived rather than authored, so a team's grant list stays legible about who
 * manages people.
 */
export type NcMembersRoutineOp =
  | 'list_teams'
  | 'list_members'
  | 'invite'
  | 'add_member'
  | 'remove_member'
  | 'revoke';

/** invoke() result for a SQL routine. */
export interface SqlRoutineResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

/** invoke() result for an HTTP routine. */
export interface HttpRoutineResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/** Per-op invoke() results for a Redis routine (strings-only values). */
export interface RedisGetResult {
  value: string | null;
}
export interface RedisMgetResult {
  /** Aligned 1:1 with the input `keys`; null for a missing key. */
  values: (string | null)[];
}
export interface RedisSetResult {
  ok: boolean;
}
export interface RedisDelResult {
  deleted: number;
}
export interface RedisExpireResult {
  applied: boolean;
}
export interface RedisTtlResult {
  /** Remaining TTL in seconds; null when the key has no TTL or is missing. */
  ttlSeconds: number | null;
}
export interface RedisIncrResult {
  value: number;
}
export interface RedisScanResult {
  /** Keys matched in this single non-blocking SCAN round (may be empty). */
  keys: string[];
  /**
   * Cursor to resume from. Pass it back unchanged on the next call; 0 (the
   * string "0") means the scan walked the whole keyspace and is complete.
   */
  cursor: string;
}

export type RedisRoutineResult =
  | RedisGetResult
  | RedisMgetResult
  | RedisSetResult
  | RedisDelResult
  | RedisExpireResult
  | RedisTtlResult
  | RedisIncrResult
  | RedisScanResult;

/**
 * Full-payload audit detail for an action invoke. One shape for every source, so
 * a Postgres query and a Google Calendar insert audit identically.
 *
 * Secret-free by construction: the injected DB password / auth header / api-key
 * are added inside the provider and never appear in authored/input/result.
 */
export interface RoutineInvokeAuditDetail {
  /** `source_ref.action` — which capability or platform op ran. */
  action?: string;
  /** Authoring-time values (the SQL statement, the HTTP method, headers…). */
  authored?: Record<string, unknown>;
  /** Caller-supplied input. */
  input?: Record<string, unknown>;
  result?: unknown;
  /** true when the captured payload was size-capped before persistence. */
  payloadTruncated?: boolean;
  /**
   * Set when the invoke was denied by a permission/grant gate before dispatch
   * (no request ever left the platform) — the audit row's only distinguisher
   * between an authorization denial and a downstream execution failure.
   */
  denialReason?: string;
}

/**
 * Audit detail for `ACTION_INVOKE`. Actions absorbed routines, so the captured
 * shapes for the declarative kinds are unchanged — the alias exists so audit
 * consumers name the surviving concept rather than the retired one.
 */
export type ActionInvokeAuditDetail = RoutineInvokeAuditDetail;

export type RoutineDataOp =
  | 'list' | 'read' | 'create' | 'update' | 'delete' | 'count'
  // Link ops pin `linkFieldId` in `source_ref`; `link`/`unlink` mirror v3's
  // POST/DELETE `/links/{linkFieldId}/{recordId}`, `list_links` its GET.
  | 'link' | 'unlink' | 'list_links';

export type RoutineParamFieldType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'json';

export interface RoutineParamField {
  name: string;
  type: RoutineParamFieldType;
  description?: string;
  optional?: boolean;
  values?: string[]; // enum only (>=1)
  items?: 'string' | 'number' | 'integer' | 'boolean'; // array only
  schema?: Record<string, unknown>; // json only (JSON Schema 2020-12)
  secret?: boolean; // reserved for audit redaction (spec §12.6)
}

export interface RoutineParamSchema {
  fields: RoutineParamField[];
}

export type Binding =
  | { lit: unknown }
  | { ref: string }
  | { tmpl: string }
  | { arr: string[] }
  | { obj: Record<string, Binding> }
  /**
   * A pinned predicate with exactly one caller-supplied value: the author fixes
   * the column and the operator, the caller supplies the value. Travels under
   * the `guard` op field, where the query layer turns it into one filter term.
   *
   * This is the ONE way a public action lets an anonymous visitor influence
   * which rows it touches — a booking page asking about one slot, a "manage your
   * booking" link carrying a token.
   */
  | { pred: { field: string; op: string; value: { ref: string } } };

export interface RoutineTemplate {
  opName: string; // mirrors `operation`
  input?: Record<string, Binding>; // object binding tree
  paramMap?: Record<string, string>; // opField -> paramField (mutually exclusive with input)
}

export interface RoutineValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface RoutineType {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id: string;
  title: string;
  name: string; // ctx.routines.<name>; camelCase; unique per app
  description?: string;
  fk_current_version_id?: string;
  created_by?: string;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoutineVersionType {
  id: string;
  fk_routine_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  version_number: number;
  source_type: RoutineSourceType;
  // platform: {action, …namespace ref} · integration: {integrationId, action, …authored}
  source_ref: Record<string, unknown>;
  operation: string; // RoutineDataOp | workflow-node action key
  template: RoutineTemplate;
  param_schema: RoutineParamSchema;
  body_hash: string;
  created_by?: string;
  created_at?: string;
}

export interface AppVersionRoutineType {
  id: string;
  fk_app_version_id: string;
  fk_routine_id: string;
  fk_routine_version_id: string;
  routine_name: string;
}
