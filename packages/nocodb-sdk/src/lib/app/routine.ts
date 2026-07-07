export type RoutineSourceType =
  | 'nocodb_data'
  | 'integration'
  | 'sql'
  | 'http'
  | 'redis';

export type HttpRoutineMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Named capability ops for source_type='redis' (strings-only KeyValue). */
export type RedisRoutineOp =
  | 'get'
  | 'mget'
  | 'set'
  | 'del'
  | 'expire'
  | 'ttl'
  | 'incr'
  | 'scan';

/** source_ref for source_type='sql' (static part of a SQL routine). */
export interface SqlRoutineSourceRef {
  integrationId: string;
  /** Raw SQL authored by the builder; uses :name bind placeholders. */
  sql: string;
}

/** source_ref for source_type='http' (static part of an HTTP routine). */
export interface HttpRoutineSourceRef {
  integrationId: string;
  method: HttpRoutineMethod;
}

/**
 * source_ref for source_type='redis' (static part of a Redis routine). The op
 * itself lives on the version's `operation` field (one of RedisRoutineOp) — the
 * source_ref carries only the connection. Strings-only by contract.
 */
export interface RedisRoutineSourceRef {
  integrationId: string;
}

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
 * Full-payload audit detail captured for sql/http routine invokes (D10).
 * Secret-free by construction — injected DB password / auth header / api-key
 * are added inside the adapter and never appear in source_ref/input/result.
 */
export interface RoutineInvokeAuditDetail {
  sql?: string;
  binds?: Record<string, unknown>;
  httpRequest?: {
    method: string;
    path: string;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: unknown;
  };
  httpResponse?: {
    status: number;
    headers?: Record<string, unknown>;
    body?: unknown;
  };
  /** Redis routine: the named op + its input + result (secret-free). */
  redisOp?: string;
  redisInput?: Record<string, unknown>;
  redisResult?: unknown;
  rowCount?: number;
  truncated?: boolean;
  /** true when the captured payload was size-capped before persistence. */
  payloadTruncated?: boolean;
}

export type RoutineDataOp = 'list' | 'read' | 'create' | 'update' | 'delete' | 'count';

export type RoutineParamFieldType =
  | 'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'array' | 'json';

export interface RoutineParamField {
  name: string;
  type: RoutineParamFieldType;
  description?: string;
  optional?: boolean;
  values?: string[];                       // enum only (>=1)
  items?: 'string' | 'number' | 'integer' | 'boolean'; // array only
  schema?: Record<string, unknown>;        // json only (JSON Schema 2020-12)
  secret?: boolean;                         // reserved for audit redaction (spec §12.6)
}

export interface RoutineParamSchema { fields: RoutineParamField[]; }

export type Binding =
  | { lit: unknown }
  | { ref: string }
  | { tmpl: string }
  | { arr: string[] }
  | { obj: Record<string, Binding> };

export interface RoutineTemplate {
  opName: string;                           // mirrors `operation`
  input?: Record<string, Binding>;          // object binding tree
  paramMap?: Record<string, string>;        // opField -> paramField (mutually exclusive with input)
}

export interface RoutineValidationIssue { path: string; code: string; message: string; }

export interface RoutineType {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id: string;
  title: string;
  name: string;                             // ctx.routines.<name>; camelCase; unique per app
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
  source_ref: Record<string, unknown>;      // {modelId} | {integrationId, action}
  operation: string;                        // RoutineDataOp | workflow-node action key
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
