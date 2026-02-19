import { serialize } from 'pg-protocol';
import type { Parser } from 'node-sql-parser';
import { generateWhereClause } from '~/helpers/dataReflectionHelpers';

/**
 * Minimal session interface for interceptor functions.
 * Decouples from the concrete DataReflectionSession class so the logic is testable in isolation.
 */
export type SessionValueKey = 'fk_workspace_id' | 'availableSchemas' | 'pgUser';

export interface InterceptSession {
  fk_workspace_id?: string;
  availableSchemas?: string[];
  pgUser?: string | null;
}

function getSessionValue(
  session: InterceptSession,
  key: SessionValueKey,
): string | string[] | undefined {
  switch (key) {
    case 'fk_workspace_id':
      return session.fk_workspace_id;
    case 'availableSchemas':
      return session.availableSchemas;
    case 'pgUser':
      return session.pgUser ?? undefined;
  }
}

// Interception rules
export const interceptMap: {
  table_name: string;
  column_name: string;
  type: 'in' | 'eq';
  sessionValue?: SessionValueKey;
  value?: string | string[];
}[] = [
  {
    table_name: 'pg_namespace',
    column_name: 'nspname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'schemata',
    column_name: 'schema_name',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_database',
    column_name: 'datname',
    type: 'eq',
    sessionValue: 'fk_workspace_id',
  },
  {
    table_name: 'pg_roles',
    column_name: 'rolname',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  {
    table_name: 'pg_user',
    column_name: 'usename',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  // pg_stat views — schema-level filtering to prevent cross-tenant enumeration
  {
    table_name: 'pg_stat_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_xact_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_xact_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_user_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_all_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  // pg_stat_activity — only show own connections
  {
    table_name: 'pg_stat_activity',
    column_name: 'usename',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  // pg_settings — whitelist safe settings only (clients need these for protocol/encoding)
  {
    table_name: 'pg_settings',
    column_name: 'name',
    type: 'in',
    value: [
      'server_version',
      'server_encoding',
      'client_encoding',
      'standard_conforming_strings',
      'DateStyle',
      'TimeZone',
      'IntervalStyle',
      'integer_datetimes',
      'application_name',
      'default_transaction_read_only',
      'is_superuser',
      'session_authorization',
      'lc_messages',
      'lc_monetary',
      'lc_numeric',
      'lc_time',
      'bytea_output',
      'xmloption',
      'statement_timeout',
      'idle_in_transaction_session_timeout',
      'search_path',
    ],
  },
  // --- pg_catalog views with text schema columns (Step 3) ---
  {
    table_name: 'pg_stats',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stats_ext',
    column_name: 'schema_name',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stats_ext_exprs',
    column_name: 'schema_name',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_matviews',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_views',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_rules',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_user_functions',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_all_functions',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_xact_user_functions',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_sys_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_sys_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_sys_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_sys_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_sys_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  // --- information_schema views (Step 3) ---
  {
    table_name: 'tables',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'columns',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'views',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'routines',
    column_name: 'routine_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'parameters',
    column_name: 'specific_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'table_constraints',
    column_name: 'constraint_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'key_column_usage',
    column_name: 'constraint_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'referential_constraints',
    column_name: 'constraint_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'check_constraints',
    column_name: 'constraint_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'constraint_column_usage',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'constraint_table_usage',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'table_privileges',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'column_privileges',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'role_table_grants',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'role_column_grants',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'triggers',
    column_name: 'trigger_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'sequences',
    column_name: 'sequence_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'routine_privileges',
    column_name: 'specific_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'usage_privileges',
    column_name: 'object_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'view_column_usage',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'view_table_usage',
    column_name: 'table_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'domains',
    column_name: 'domain_schema',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
];

// Blocked query patterns — these statements are never allowed through the proxy
export const blockedQueryPatterns: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\bALTER\s+(ROLE|USER)\b/i,
    message: 'ALTER ROLE/USER is not permitted',
  },
  {
    pattern: /\bDO\s+\$/i,
    message: 'Anonymous code blocks are not permitted',
  },
  { pattern: /\bLISTEN\b/i, message: 'LISTEN is not permitted' },
  { pattern: /\bNOTIFY\b/i, message: 'NOTIFY is not permitted' },
  {
    pattern: /\bCREATE\s+TEMP(ORARY)?\b/i,
    message: 'Creating temporary objects is not permitted',
  },
  {
    pattern: /\bpg_sleep\s*\(/i,
    message: 'pg_sleep is not permitted',
  },
  {
    pattern: /\bpg_(try_)?advisory/i,
    message: 'Advisory locks are not permitted',
  },
  // Block OID-to-name type casts that bypass schema filtering (all ::reg* variants)
  {
    pattern: /::reg(class|namespace|role|type|proc|oper|config|dictionary)\b/i,
    message: 'Type cast to reg* types is not permitted',
  },
  // Block CAST(... AS reg*) syntax — bypasses the :: form check above
  {
    pattern:
      /\bAS\s+reg(class|namespace|role|type|proc|oper|config|dictionary)\b/i,
    message: 'CAST to reg* types is not permitted',
  },
  // Block dangerous catalog functions that leak cross-tenant metadata
  {
    pattern: /\bpg_relation_filepath\s*\(/i,
    message: 'pg_relation_filepath is not permitted',
  },
  {
    pattern: /\bpg_identify_object\s*\(/i,
    message: 'pg_identify_object is not permitted',
  },
  {
    pattern: /\bpg_get_indexdef\s*\(/i,
    message: 'pg_get_indexdef is not permitted',
  },
  {
    pattern: /\bpg_get_constraintdef\s*\(/i,
    message: 'pg_get_constraintdef is not permitted',
  },
  {
    pattern: /\bpg_get_viewdef\s*\(/i,
    message: 'pg_get_viewdef is not permitted',
  },
  {
    pattern: /\bpg_get_functiondef\s*\(/i,
    message: 'pg_get_functiondef is not permitted',
  },
  {
    pattern: /\bpg_get_triggerdef\s*\(/i,
    message: 'pg_get_triggerdef is not permitted',
  },
  // Block all has_*_privilege() function variants (schema, table, database, column, etc.)
  {
    pattern: /\bhas_\w+_privilege\s*\(/i,
    message: 'Privilege checking functions are not permitted',
  },
  // Block catalog tables that leak cross-tenant dependency/object info
  {
    pattern: /\bpg_depend\b/i,
    message: 'Access to pg_depend is not permitted',
  },
  {
    pattern: /\bpg_shdepend\b/i,
    message: 'Access to pg_shdepend is not permitted',
  },
  // Block COPY — bypasses AST-based interceptor entirely (critical tenant isolation bypass).
  // These use broad \b matching intentionally (not start-anchored) to catch keywords inside
  // PL/pgSQL DO blocks, dynamic SQL strings, and other non-top-level positions.
  // False positives on identifiers named "copy"/"grant" etc. are acceptable — this is a
  // read-only analytics proxy where users don't define their own schemas.
  { pattern: /\bCOPY\b/i, message: 'COPY is not permitted' },
  // Block privilege manipulation
  { pattern: /\bGRANT\b/i, message: 'GRANT is not permitted' },
  { pattern: /\bREVOKE\b/i, message: 'REVOKE is not permitted' },
  // Block large object operations (storage abuse, covert data channel)
  {
    pattern:
      /\blo_(create|import|export|put|get|open|write|close|unlink)\s*\(/i,
    message: 'Large object operations are not permitted',
  },
  // Block pg_notify() function (NOTIFY command already blocked, but function form bypasses)
  {
    pattern: /\bpg_notify\s*\(/i,
    message: 'pg_notify is not permitted',
  },
  // Block maintenance commands
  { pattern: /\bVACUUM\b/i, message: 'VACUUM is not permitted' },
  { pattern: /\bCLUSTER\b/i, message: 'CLUSTER is not permitted' },
  { pattern: /\bDISCARD\b/i, message: 'DISCARD is not permitted' },
  { pattern: /\bUNLISTEN\b/i, message: 'UNLISTEN is not permitted' },
  // Block infrastructure discovery functions
  {
    pattern: /\binet_server_(addr|port)\s*\(/i,
    message: 'Server network information functions are not permitted',
  },
  // Block XML mapping functions — execute arbitrary inner SQL, bypassing all AST filtering (critical tenant isolation bypass)
  {
    pattern: /\b(query|table|cursor|schema|database)_to_xml\w*\s*\(/i,
    message: 'XML mapping functions are not permitted',
  },
  // Block set_config() — can change session settings like search_path
  {
    pattern: /\bset_config\s*\(/i,
    message: 'set_config is not permitted',
  },
  // Block current_setting() — leaks infrastructure configuration (listen_addresses, etc.)
  {
    pattern: /\bcurrent_setting\s*\(/i,
    message: 'current_setting is not permitted',
  },
  // Block EXPLAIN ANALYZE — actually executes the inner query without AST interception
  {
    pattern: /\bEXPLAIN\b[^;]*\bANALY[ZS]E\b/i,
    message: 'EXPLAIN ANALYZE is not permitted',
  },
  // Block pg_cancel_backend / pg_terminate_backend — can kill other connections
  {
    pattern: /\bpg_(cancel|terminate)_backend\s*\(/i,
    message: 'Backend termination functions are not permitted',
  },
  // Block server-wide stat views — leak all database names, server stats, replication info
  {
    pattern:
      /\bpg_stat_(database\w*|bgwriter|wal\w*|archiver|ssl|replication\w*|subscription\w*)\b/i,
    message: 'Server-wide statistics views are not permitted',
  },
  // Block shared catalog tables — leak role membership, settings, shared descriptions
  {
    pattern: /\bpg_(auth_members|db_role_setting|shdescription)\b/i,
    message: 'Access to shared catalog tables is not permitted',
  },
  // Block server-level catalog tables — leak installed extensions, languages, tablespaces
  {
    pattern: /\bpg_(extension|language|tablespace)\b/i,
    message: 'Access to server-level catalog tables is not permitted',
  },
  // Block infrastructure timing functions — leak server uptime and config reload times
  {
    pattern: /\bpg_(postmaster_start_time|conf_load_time)\s*\(/i,
    message: 'Server timing functions are not permitted',
  },
  // Block client network info functions — leak network topology
  {
    pattern: /\binet_client_(addr|port)\s*\(/i,
    message: 'Client network information functions are not permitted',
  },
  // Block pg_backend_pid — leaks backend process IDs
  {
    pattern: /\bpg_backend_pid\s*\(/i,
    message: 'pg_backend_pid is not permitted',
  },
  // Block pg_is_in_recovery — leaks HA topology (primary vs standby)
  {
    pattern: /\bpg_is_in_recovery\s*\(/i,
    message: 'pg_is_in_recovery is not permitted',
  },
  // Block pg_relation_filenode — leaks physical storage layout
  {
    pattern: /\bpg_relation_filenode\s*\(/i,
    message: 'pg_relation_filenode is not permitted',
  },
  // Block file system functions — arbitrary file read/listing on the server
  {
    pattern:
      /\bpg_(ls_dir|read_file|read_binary_file|stat_file|ls_logdir|ls_waldir|ls_tmpdir|ls_archive_statusdir)\s*\(/i,
    message: 'File system functions are not permitted',
  },
  // Block pg_authid — contains password hashes (defense-in-depth)
  {
    pattern: /\bpg_authid\b/i,
    message: 'Access to pg_authid is not permitted',
  },
  // Block pg_subscription — may contain replication connection strings
  {
    pattern: /\bpg_subscription\b/i,
    message: 'Access to pg_subscription is not permitted',
  },
  // Block direct large object table access (pg_largeobject and pg_largeobject_metadata)
  {
    pattern: /\bpg_largeobject(_metadata)?\b/i,
    message: 'Access to pg_largeobject is not permitted',
  },
  // Block foreign data wrappers — leak external server connection info
  {
    pattern: /\bpg_(foreign_server|foreign_data_wrapper|user_mapping)\b/i,
    message: 'Access to foreign data wrapper catalogs is not permitted',
  },
  // Block server-wide object catalogs
  {
    pattern: /\bpg_(event_trigger|seclabel|shseclabel|init_privs)\b/i,
    message: 'Access to server-wide object catalogs is not permitted',
  },
  // Block OID resolution functions — leak cross-tenant object names
  {
    pattern:
      /\bpg_(get_userbyid|describe_object|identify_object_as_address|filenode_relation)\s*\(/i,
    message: 'OID resolution functions are not permitted',
  },
  // Block low-level stat functions — bypass view-level schema filtering
  {
    pattern: /\bpg_stat_get_\w+\s*\(/i,
    message: 'Low-level statistics functions are not permitted',
  },
  // Block pg_stat_gssapi and pg_stat_progress views
  {
    pattern: /\bpg_stat_(gssapi|progress_\w+)\b/i,
    message: 'Access to server-wide statistics views is not permitted',
  },
  // Block aclexplode — leaks role OIDs and privilege details
  {
    pattern: /\baclexplode\s*\(/i,
    message: 'aclexplode is not permitted',
  },
  // Block server/tablespace size functions — leak infrastructure info
  {
    pattern: /\bpg_(database_size|tablespace_size)\s*\(/i,
    message: 'Server size functions are not permitted',
  },
];

export class QueryBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryBlockedError';
  }
}

/**
 * Build a PostgreSQL wire protocol ErrorResponse + ReadyForQuery.
 */
export function buildPgErrorResponse(message: string): Buffer {
  const severity = Buffer.from('SERROR\0', 'utf8');
  const severityV = Buffer.from('VERROR\0', 'utf8');
  const code = Buffer.from('C42501\0', 'utf8'); // insufficient_privilege
  const msg = Buffer.from(`M${message}\0`, 'utf8');
  const terminator = Buffer.from('\0', 'utf8');

  const fieldsBody = Buffer.concat([
    severity,
    severityV,
    code,
    msg,
    terminator,
  ]);

  const errorHeader = Buffer.alloc(5);
  errorHeader.writeUInt8(0x45, 0); // 'E'
  errorHeader.writeUInt32BE(4 + fieldsBody.length, 1);

  const readyForQuery = Buffer.alloc(6);
  readyForQuery.writeUInt8(0x5a, 0); // 'Z'
  readyForQuery.writeUInt32BE(5, 1);
  readyForQuery.writeUInt8(0x49, 5); // 'I' (idle)

  return Buffer.concat([errorHeader, fieldsBody, readyForQuery]);
}

/**
 * Catalog tables that require namespace OID-based filtering.
 * These tables don't have a text schema column — they use OID references
 * to pg_namespace, so we inject a subquery filter.
 */
export const catalogNamespaceFilters: {
  table_name: string;
  column_name: string;
  /** If 'nested', the column references pg_class.oid instead of pg_namespace.oid directly */
  mode: 'direct' | 'nested';
}[] = [
  // pg_class.relnamespace → pg_namespace.oid
  { table_name: 'pg_class', column_name: 'relnamespace', mode: 'direct' },
  // pg_type.typnamespace → pg_namespace.oid
  { table_name: 'pg_type', column_name: 'typnamespace', mode: 'direct' },
  // pg_attribute.attrelid → pg_class.oid (nested: pg_class → pg_namespace)
  { table_name: 'pg_attribute', column_name: 'attrelid', mode: 'nested' },
  // pg_index.indrelid → pg_class.oid (nested)
  { table_name: 'pg_index', column_name: 'indrelid', mode: 'nested' },
  // pg_constraint.conrelid → pg_class.oid (nested)
  { table_name: 'pg_constraint', column_name: 'conrelid', mode: 'nested' },
  // pg_attrdef.adrelid → pg_class.oid (nested) — pg_get_expr() leaks schema names via default expressions
  { table_name: 'pg_attrdef', column_name: 'adrelid', mode: 'nested' },
  // pg_trigger.tgrelid → pg_class.oid (nested)
  { table_name: 'pg_trigger', column_name: 'tgrelid', mode: 'nested' },
  // pg_rewrite.ev_class → pg_class.oid (nested)
  { table_name: 'pg_rewrite', column_name: 'ev_class', mode: 'nested' },
  // pg_proc.pronamespace → pg_namespace.oid (direct)
  { table_name: 'pg_proc', column_name: 'pronamespace', mode: 'direct' },
  // pg_statistic.starelid → pg_class.oid (nested)
  { table_name: 'pg_statistic', column_name: 'starelid', mode: 'nested' },
  // pg_statistic_ext.stxrelid → pg_class.oid (nested)
  {
    table_name: 'pg_statistic_ext',
    column_name: 'stxrelid',
    mode: 'nested',
  },
  // pg_policy.polrelid → pg_class.oid (nested)
  { table_name: 'pg_policy', column_name: 'polrelid', mode: 'nested' },
  // pg_default_acl.defaclnamespace → pg_namespace.oid (direct)
  {
    table_name: 'pg_default_acl',
    column_name: 'defaclnamespace',
    mode: 'direct',
  },
  // pg_sequence.seqrelid → pg_class.oid (nested)
  { table_name: 'pg_sequence', column_name: 'seqrelid', mode: 'nested' },
];

// Settings allowed through SET/RESET commands (whitelist approach)
export const allowedSetSettings = new Set([
  'datestyle',
  'timezone',
  'intervalstyle',
  'client_encoding',
  'bytea_output',
  'application_name',
  'extra_float_digits',
  'lc_messages',
  'lc_monetary',
  'lc_numeric',
  'lc_time',
  'standard_conforming_strings',
  'xmloption',
  'search_path',
]);

// Settings allowed through SHOW and pg_settings (same whitelist for consistency)
export const allowedShowSettings = new Set([
  'server_version',
  'server_encoding',
  'client_encoding',
  'standard_conforming_strings',
  'datestyle',
  'timezone',
  'intervalstyle',
  'integer_datetimes',
  'application_name',
  'default_transaction_read_only',
  'is_superuser',
  'session_authorization',
  'lc_messages',
  'lc_monetary',
  'lc_numeric',
  'lc_time',
  'bytea_output',
  'xmloption',
  'statement_timeout',
  'idle_in_transaction_session_timeout',
  'search_path',
  'transaction_isolation',
  'transaction_read_only',
]);

/**
 * Patterns for commands that are safe to pass through even though the parser
 * cannot handle them.  Checked only when AST parsing fails.
 * Dangerous non-parseable commands (COPY, VACUUM, etc.) are caught by
 * blockedQueryPatterns before parsing is attempted.
 */
export const allowedNonParseablePatterns: RegExp[] = [/^\s*EXPLAIN\b/i];

/**
 * Build a subquery AST node for filtering by namespace OID.
 * Generates: <alias>.<column> IN (SELECT oid FROM pg_namespace WHERE nspname IN (...schemas))
 * The inner SELECT is marked with _ncGenerated to prevent the recursive walker from
 * applying additional interceptMap rules (which would double-filter pg_namespace).
 */
export function buildNamespaceOidSubquery(
  alias: string,
  column: string,
  schemas: string[],
) {
  const allSchemas = [
    ...schemas,
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'public',
  ];

  return {
    type: 'binary_expr',
    operator: 'IN',
    left: {
      type: 'column_ref',
      table: alias,
      column: { expr: { type: 'default', value: column } },
    },
    right: {
      type: 'expr_list',
      value: [
        {
          ast: {
            _ncGenerated: true,
            type: 'select',
            options: null,
            distinct: { type: null },
            columns: [
              {
                type: 'expr',
                expr: {
                  type: 'column_ref',
                  table: null,
                  column: { expr: { type: 'default', value: 'oid' } },
                },
                as: null,
              },
            ],
            into: { position: null },
            from: [{ db: null, table: 'pg_namespace', as: null }],
            where: {
              type: 'binary_expr',
              operator: 'IN',
              left: {
                type: 'column_ref',
                table: null,
                column: { expr: { type: 'default', value: 'nspname' } },
              },
              right: {
                type: 'expr_list',
                value: allSchemas.map((s) => ({
                  type: 'single_quote_string',
                  value: s,
                })),
              },
            },
            groupby: null,
            having: null,
            orderby: null,
            limit: { seperator: '', value: [] },
            window: null,
          },
        },
      ],
    },
  };
}

/**
 * Build a nested subquery AST for filtering via pg_class.
 * Generates: <alias>.<column> IN (SELECT oid FROM pg_class WHERE relnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN (...)))
 */
export function buildNestedClassSubquery(
  alias: string,
  column: string,
  schemas: string[],
) {
  const namespaceSubquery = buildNamespaceOidSubquery(
    null,
    'relnamespace',
    schemas,
  );

  return {
    type: 'binary_expr',
    operator: 'IN',
    left: {
      type: 'column_ref',
      table: alias,
      column: { expr: { type: 'default', value: column } },
    },
    right: {
      type: 'expr_list',
      value: [
        {
          ast: {
            _ncGenerated: true,
            type: 'select',
            options: null,
            distinct: { type: null },
            columns: [
              {
                type: 'expr',
                expr: {
                  type: 'column_ref',
                  table: null,
                  column: { expr: { type: 'default', value: 'oid' } },
                },
                as: null,
              },
            ],
            into: { position: null },
            from: [{ db: null, table: 'pg_class', as: null }],
            where: namespaceSubquery,
            groupby: null,
            having: null,
            orderby: null,
            limit: { seperator: '', value: [] },
            window: null,
          },
        },
      ],
    },
  };
}

/**
 * Recursively walk the AST and apply intercept rules to all SELECT statements,
 * including those inside subqueries, CTEs, and WHERE clauses.
 */
export function applyInterceptRulesRecursive(
  node: any,
  session: InterceptSession,
  visited = new WeakSet(),
): boolean {
  if (!node || typeof node !== 'object' || visited.has(node)) return false;
  visited.add(node);

  // Skip nodes generated by our own subquery builders (prevents double-filtering)
  if (node._ncGenerated) return false;

  let modified = false;

  // Apply intercept rules to SELECT statements with FROM clauses
  if (node.type === 'select' && node.from && Array.isArray(node.from)) {
    // 1. Text-column based intercept rules (schemaname, nspname, etc.)
    for (const target of interceptMap) {
      const targetFrom = node.from.find(
        (f: any) => f.table === target.table_name,
      );
      if (!targetFrom) continue;

      const alias = targetFrom.as || targetFrom.table;
      const additionalClause = generateWhereClause(
        alias,
        target.column_name,
        target.type,
        target.value
          ? target.value
          : getSessionValue(session, target.sessionValue),
      );

      if (node.where) {
        node.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: node.where,
          right: additionalClause,
        };
      } else {
        node.where = additionalClause;
      }
      modified = true;
    }

    // 2. OID-based namespace filters for catalog tables (pg_class, pg_type, pg_attribute, etc.)
    for (const filter of catalogNamespaceFilters) {
      const targetFrom = node.from.find(
        (f: any) => f.table === filter.table_name,
      );
      if (!targetFrom) continue;

      const alias = targetFrom.as || targetFrom.table;
      const schemas = session.availableSchemas || [];

      const additionalClause =
        filter.mode === 'direct'
          ? buildNamespaceOidSubquery(alias, filter.column_name, schemas)
          : buildNestedClassSubquery(alias, filter.column_name, schemas);

      if (node.where) {
        node.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: node.where,
          right: additionalClause,
        };
      } else {
        node.where = additionalClause;
      }
      modified = true;
    }
  }

  // Recurse into all child nodes to find nested SELECTs
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'object' && item !== null) {
          if (applyInterceptRulesRecursive(item, session, visited))
            modified = true;
        }
      }
    } else if (typeof child === 'object' && child !== null) {
      if (applyInterceptRulesRecursive(child, session, visited))
        modified = true;
    }
  }

  return modified;
}

/**
 * Normalize SQL for security pattern matching.
 * Strips comments (block + line, including nested) and neutralizes string
 * literal contents so that blocked-keyword patterns cannot false-positive
 * on values like `'This is a copy'` matching `\bCOPY\b`.
 *
 * String literals are replaced with empty delimiters:
 *   'some COPY text'  →  ''
 *   $$GRANT stuff$$   →  $$$$
 *
 * Only used for blocked-pattern matching — the original text is used for parsing.
 */
export function stripSqlComments(sql: string): string {
  let result = '';
  let i = 0;

  while (i < sql.length) {
    // Single-quoted string literal — neutralize content, keep delimiters
    if (sql[i] === "'") {
      result += "''"; // emit empty string literal
      i++; // skip opening quote
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2; // skip escaped quote
        } else if (sql[i] === "'") {
          i++; // skip closing quote
          break;
        } else {
          i++; // skip content
        }
      }
    }
    // Dollar-quoted string literal — neutralize content, keep tags
    else if (sql[i] === '$') {
      const tagMatch = sql.slice(i).match(/^\$([A-Za-z_][\w]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0]; // e.g. $$ or $tag$
        result += tag + tag; // emit empty dollar-quoted string
        i += tag.length;
        const endIdx = sql.indexOf(tag, i);
        if (endIdx !== -1) {
          i = endIdx + tag.length; // skip past content + closing tag
        } else {
          i = sql.length; // unterminated — skip rest
        }
      } else {
        result += sql[i++];
      }
    }
    // Block comment (handles nesting)
    else if (sql[i] === '/' && sql[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      result += ' ';
    }
    // Line comment
    else if (sql[i] === '-' && sql[i + 1] === '-') {
      i += 2;
      while (i < sql.length && sql[i] !== '\n') {
        i++;
      }
      result += ' ';
    }
    // Normal character
    else {
      result += sql[i++];
    }
  }

  return result;
}

/**
 * Attempt to parse and intercept the query.
 * If it matches our interception rules inject a WHERE clause to restrict the query.
 * Return modified query buffer if successful (undefined otherwise).
 */
export async function interceptQueryIfNeeded(
  data: Buffer,
  session: InterceptSession,
  parser: Parser,
  onParseError?: (query: string) => void,
): Promise<Buffer | undefined> {
  // Extract the query text from the buffer
  // Byte 0: Message type (0x51 for 'Q')
  // Bytes 1-4: Message length
  let queryText = data.subarray(5).toString('utf8').replace(/\0/g, '');

  // Strip SQL comments to prevent regex bypass (e.g. pg_sleep/**/())
  const normalizedQueryText = stripSqlComments(queryText);

  // Check for blocked patterns before parsing (use comment-stripped text)
  for (const { pattern, message } of blockedQueryPatterns) {
    if (pattern.test(normalizedQueryText)) {
      throw new QueryBlockedError(message);
    }
  }

  // Block SHOW for sensitive settings (SHOW bypasses the AST-based interceptor)
  const showMatch = normalizedQueryText.match(
    /^\s*SHOW\s+(ALL|[\w]+)\s*;?\s*$/i,
  );
  if (showMatch) {
    const setting = showMatch[1].toLowerCase();
    if (!allowedShowSettings.has(setting)) {
      throw new QueryBlockedError(`SHOW ${showMatch[1]} is not permitted`);
    }
    // Allowed SHOW — pass through without modification
    return;
  }

  // Handle SET commands via whitelist (before AST parsing — parser can't handle all SET variants)
  const setMatch = normalizedQueryText.match(
    /^\s*SET\s+(?:LOCAL\s+)?(?:SESSION\s+)?(\w+)\s*(?:=|TO)\s*/i,
  );
  if (setMatch) {
    const setting = setMatch[1].toLowerCase();
    if (!allowedSetSettings.has(setting)) {
      throw new QueryBlockedError(`SET ${setMatch[1]} is not permitted`);
    }
    return; // Allowed SET — pass through
  }

  // Handle SET TRANSACTION separately (no setting name, different syntax)
  const setTxnMatch = normalizedQueryText.match(/^\s*SET\s+TRANSACTION\b(.*)/i);
  if (setTxnMatch) {
    const txnBody = setTxnMatch[1];
    if (/\bREAD\s+WRITE\b/i.test(txnBody)) {
      throw new QueryBlockedError(
        'SET TRANSACTION READ WRITE is not permitted',
      );
    }
    return; // Allow READ ONLY and isolation levels
  }

  // Handle RESET commands via same whitelist as SET
  const resetMatch = normalizedQueryText.match(/^\s*RESET\s+(\w+)\s*;?\s*$/i);
  if (resetMatch) {
    const setting = resetMatch[1].toLowerCase();
    if (setting === 'all') {
      throw new QueryBlockedError('RESET ALL is not permitted');
    }
    if (!allowedSetSettings.has(setting)) {
      throw new QueryBlockedError(`RESET ${resetMatch[1]} is not permitted`);
    }
    return; // Allowed RESET — pass through
  }

  // Rewrite session-level identifiers to return the session values.
  // current_database()/current_catalog → workspace ID
  // current_user/session_user → DB user (these are SQL keywords without parens
  // that many parsers cannot handle as column expressions)
  let forceModified = false;
  const rewritten = queryText
    .replace(/\bcurrent_database\s*\(\s*\)/gi, `'${session.fk_workspace_id}'`)
    .replace(/\bcurrent_catalog\b/gi, `'${session.fk_workspace_id}'`)
    .replace(/\bsession_user\b/gi, `'${session.pgUser}'`)
    .replace(/\bcurrent_user\b/gi, `'${session.pgUser}'`);
  if (rewritten !== queryText) {
    queryText = rewritten;
    forceModified = true;
  }

  let ast;
  try {
    ast = parser.astify(queryText, { database: 'postgresql' });
  } catch (e) {
    if (onParseError) {
      onParseError(queryText);
    }
    // Check if the query matches a known safe non-parseable pattern
    for (const pattern of allowedNonParseablePatterns) {
      if (pattern.test(queryText)) {
        // If we already rewrote current_database(), serialize the rewritten text
        if (forceModified) {
          return serialize.query(queryText);
        }
        return;
      }
    }
    // Block unparseable queries — if we can't verify it's safe, don't allow it
    throw new QueryBlockedError('Query syntax is not supported');
  }

  const astArray = Array.isArray(ast) ? ast : [ast];
  let modified = false;

  for (const statement of astArray) {
    if (applyInterceptRulesRecursive(statement, session)) {
      modified = true;
    }
  }

  if (!modified && !forceModified) {
    return;
  }

  // Convert the AST back to SQL
  const modifiedQuery = parser.sqlify(
    astArray.length === 1 ? astArray[0] : astArray,
    {
      database: 'postgresql',
    },
  );

  // Serialize the modified query into a PostgreSQL wire protocol query message
  return serialize.query(modifiedQuery);
}

/**
 * Splits a buffer by null bytes into a list of strings.
 */
export function parseNullDelimitedBuffer(buf: Buffer): string[] {
  const bytes = Array.from(buf);
  const parts: string[] = [];
  let temp: number[] = [];

  for (const byte of bytes) {
    if (byte === 0) {
      parts.push(Buffer.from(temp).toString('utf8'));
      temp = [];
    } else {
      temp.push(byte);
    }
  }

  // If there's trailing non-null content (shouldn't happen in startup messages but just in case)
  if (temp.length > 0) {
    parts.push(Buffer.from(temp).toString('utf8'));
  }

  return parts;
}

export function rewriteSASLMechanisms(buf: Buffer): Buffer {
  const saslMechs = parseNullDelimitedBuffer(buf.subarray(9));
  const filtered = saslMechs.filter((m) => m !== 'SCRAM-SHA-256-PLUS');

  if (filtered.length === 0) {
    throw new Error('No valid SASL mechanisms after filtering');
  }

  const mechList = Buffer.concat(filtered.map((m) => Buffer.from(m + '\0')));

  const totalLength = 4 + 4 + mechList.length; // 4 (length), 4 (auth type), N

  const header = Buffer.alloc(9);
  header.writeUInt8(0x52, 0); // 'R'
  header.writeUInt32BE(totalLength, 1);
  header.writeUInt32BE(10, 5); // AuthenticationSASL

  return Buffer.concat([header, mechList]);
}
