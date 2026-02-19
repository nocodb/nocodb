import 'mocha';
import { expect } from 'chai';
import { Parser } from 'node-sql-parser';
import { serialize } from 'pg-protocol';
import type { InterceptSession } from '~/helpers/dataReflectionInterceptor';
import {
  allowedNonParseablePatterns,
  allowedSetSettings,
  allowedShowSettings,
  applyInterceptRulesRecursive,
  blockedQueryPatterns,
  buildNamespaceOidSubquery,
  buildNestedClassSubquery,
  buildPgErrorResponse,
  catalogNamespaceFilters,
  interceptMap,
  interceptQueryIfNeeded,
  parseNullDelimitedBuffer,
  QueryBlockedError,
  rewriteSASLMechanisms,
  stripSqlComments,
} from '~/helpers/dataReflectionInterceptor';

/** Helper: build a PG wire protocol Query message from SQL text */
function buildQueryBuffer(sql: string): Buffer {
  return serialize.query(sql);
}

/** Helper: create a minimal InterceptSession for testing */
function makeSession(
  overrides: Partial<InterceptSession> = {},
): InterceptSession {
  return {
    fk_workspace_id: 'ws_test123',
    availableSchemas: ['schema_a', 'schema_b'],
    pgUser: 'nc_readonly_abc',
    ...overrides,
  };
}

function blockedQueryTests() {
  it('blocks ALTER ROLE', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("ALTER ROLE foo WITH PASSWORD 'bar'"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('ALTER ROLE');
  });

  it('blocks ALTER USER', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('ALTER USER admin SUPERUSER'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks DO blocks', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("DO $$ BEGIN RAISE NOTICE 'hi'; END $$;"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('Anonymous code blocks');
  });

  it('blocks LISTEN', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('LISTEN my_channel'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks NOTIFY', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("NOTIFY my_channel, 'payload'"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks CREATE TEMP TABLE', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('CREATE TEMP TABLE foo (id int)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks CREATE TEMPORARY TABLE', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('CREATE TEMPORARY TABLE foo (id int)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_sleep', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_sleep(10)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks advisory locks', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_advisory_lock(1)'),
    );
    expect(match).to.not.be.undefined;
    const matchUnlock = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_advisory_unlock(1)'),
    );
    expect(matchUnlock).to.not.be.undefined;
  });

  it('blocks ::regclass cast', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT 'pg_class'::regclass"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks ::regnamespace cast', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT 'public'::regnamespace"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks ::regrole cast', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT 'postgres'::regrole"),
    );
    expect(match).to.not.be.undefined;
  });

  it('does NOT block ::regtype cast (safe — resolves standard PG type names only)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT 'integer'::regtype"),
    );
    expect(match).to.be.undefined;
  });

  it('blocks CAST(... AS regclass)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT CAST(1259 AS regclass)'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('reg*');
  });

  it('blocks CAST(... AS regrole)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT CAST(10 AS regrole)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks dangerous catalog functions', () => {
    const funcs = [
      'pg_relation_filepath(123)',
      'pg_identify_object(1,2,3)',
      'pg_get_indexdef(123)',
      'pg_get_constraintdef(123)',
      'pg_get_viewdef(123)',
      'pg_get_functiondef(123)',
      'pg_get_triggerdef(123)',
      'pg_get_ruledef(123)',
    ];
    for (const fn of funcs) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
    }
  });

  it('blocks all has_*_privilege variants', () => {
    const variants = [
      "has_schema_privilege(1, 'USAGE')",
      "has_table_privilege(1, 'SELECT')",
      "has_database_privilege('mydb', 'CONNECT')",
      "has_column_privilege(1, 1, 'SELECT')",
      "has_function_privilege(1, 'EXECUTE')",
      "has_sequence_privilege(1, 'USAGE')",
      "has_type_privilege(1, 'USAGE')",
      "has_any_column_privilege(1, 'SELECT')",
    ];
    for (const fn of variants) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('Privilege');
    }
  });

  it('blocks pg_depend and pg_shdepend', () => {
    const match1 = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_depend'),
    );
    expect(match1).to.not.be.undefined;
    const match2 = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_shdepend'),
    );
    expect(match2).to.not.be.undefined;
  });

  it('blocks pg_try_advisory_lock', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_try_advisory_lock(1)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_advisory_xact_lock', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_advisory_xact_lock(1)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks COPY TO STDOUT', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('COPY (SELECT * FROM pg_namespace) TO STDOUT'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('COPY');
  });

  it('blocks COPY FROM', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("COPY foo FROM '/tmp/evil.csv'"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks GRANT', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('GRANT ALL ON SCHEMA public TO evil'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks REVOKE', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('REVOKE ALL ON SCHEMA public FROM evil'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks lo_create', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT lo_create(0)'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('Large object');
  });

  it('blocks lo_put', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT lo_put(123, 0, E'\\x48')"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks lo_import and lo_export', () => {
    expect(
      blockedQueryPatterns.find((p) =>
        p.pattern.test("SELECT lo_import('/etc/passwd')"),
      ),
    ).to.not.be.undefined;
    expect(
      blockedQueryPatterns.find((p) =>
        p.pattern.test("SELECT lo_export(1, '/tmp/evil')"),
      ),
    ).to.not.be.undefined;
  });

  it('blocks pg_notify function', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT pg_notify('channel', 'payload')"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_notify');
  });

  it('blocks VACUUM', () => {
    const match = blockedQueryPatterns.find((p) => p.pattern.test('VACUUM'));
    expect(match).to.not.be.undefined;
  });

  it('blocks CLUSTER', () => {
    const match = blockedQueryPatterns.find((p) => p.pattern.test('CLUSTER'));
    expect(match).to.not.be.undefined;
  });

  it('blocks DISCARD', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('DISCARD ALL'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks UNLISTEN', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('UNLISTEN *'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks inet_server_addr', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT inet_server_addr()'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks inet_server_port', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT inet_server_port()'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks query_to_xml', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test(
        "SELECT query_to_xml('SELECT * FROM pg_namespace', true, false, '')",
      ),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('XML');
  });

  it('blocks table_to_xml', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT table_to_xml('pg_roles', true, false, '')"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks database_to_xmlschema', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT database_to_xmlschema(true, false, '')"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks schema_to_xml', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT schema_to_xml('public', true, false, '')"),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks set_config', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT set_config('search_path', 'evil_schema', false)"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('set_config');
  });

  it('blocks current_setting', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT current_setting('listen_addresses')"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('current_setting');
  });

  it('blocks EXPLAIN ANALYZE', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('EXPLAIN ANALYZE SELECT * FROM pg_tables'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('EXPLAIN ANALYZE');
  });

  it('blocks EXPLAIN (ANALYZE) with parenthesized options', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('EXPLAIN (ANALYZE, COSTS) SELECT * FROM pg_tables'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks EXPLAIN ANALYSE (British spelling)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('EXPLAIN ANALYSE SELECT 1'),
    );
    expect(match).to.not.be.undefined;
  });

  it('does not block plain EXPLAIN', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('EXPLAIN SELECT 1'),
    );
    expect(match).to.be.undefined;
  });

  it('blocks pg_cancel_backend', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_cancel_backend(12345)'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('termination');
  });

  it('blocks pg_terminate_backend', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_terminate_backend(12345)'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_database (server-wide stats)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_database'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('Server-wide');
  });

  it('blocks pg_stat_database_conflicts', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_database_conflicts'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_bgwriter', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_bgwriter'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_wal', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_wal'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_archiver', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_archiver'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_ssl', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_ssl'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_stat_replication', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_replication'),
    );
    expect(match).to.not.be.undefined;
  });

  it('does not block pg_stat_user_tables (schema-filtered)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_user_tables'),
    );
    expect(match).to.be.undefined;
  });

  it('does not block pg_stat_all_tables (schema-filtered)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_stat_all_tables'),
    );
    expect(match).to.be.undefined;
  });

  it('blocks pg_auth_members (shared catalog)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_auth_members'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('shared catalog');
  });

  it('blocks pg_db_role_setting', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_db_role_setting'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_shdescription', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_shdescription'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_extension (server-level catalog)', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_extension'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('server-level');
  });

  it('blocks pg_language', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_language'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_tablespace', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_tablespace'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_postmaster_start_time', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_postmaster_start_time()'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('timing');
  });

  it('blocks pg_conf_load_time', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_conf_load_time()'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks inet_client_addr', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT inet_client_addr()'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('Client network');
  });

  it('blocks inet_client_port', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT inet_client_port()'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks pg_backend_pid', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_backend_pid()'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_backend_pid');
  });

  it('blocks pg_is_in_recovery', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT pg_is_in_recovery()'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_is_in_recovery');
  });

  it('blocks pg_relation_filenode', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test("SELECT pg_relation_filenode('pg_class')"),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_relation_filenode');
  });

  // --- New blocked patterns (Step 2) ---
  it('blocks file system functions', () => {
    const funcs = [
      "pg_ls_dir('.')",
      "pg_read_file('/etc/passwd')",
      "pg_read_binary_file('/etc/shadow')",
      "pg_stat_file('/etc/passwd')",
      'pg_ls_logdir()',
      'pg_ls_waldir()',
      'pg_ls_tmpdir()',
      'pg_ls_archive_statusdir()',
    ];
    for (const fn of funcs) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('File system');
    }
  });

  it('blocks pg_authid', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_authid'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_authid');
  });

  it('blocks pg_subscription', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_subscription'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_subscription');
  });

  it('blocks pg_largeobject direct table access', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_largeobject'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('pg_largeobject');
  });

  it('blocks pg_largeobject_metadata', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT * FROM pg_largeobject_metadata'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks foreign data wrapper catalogs', () => {
    for (const table of [
      'pg_foreign_server',
      'pg_foreign_data_wrapper',
      'pg_user_mapping',
    ]) {
      const match = blockedQueryPatterns.find((p) =>
        p.pattern.test(`SELECT * FROM ${table}`),
      );
      expect(match, `Expected ${table} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('foreign data');
    }
  });

  it('blocks server-wide object catalogs', () => {
    for (const table of [
      'pg_event_trigger',
      'pg_seclabel',
      'pg_shseclabel',
      'pg_init_privs',
    ]) {
      const match = blockedQueryPatterns.find((p) =>
        p.pattern.test(`SELECT * FROM ${table}`),
      );
      expect(match, `Expected ${table} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('server-wide object');
    }
  });

  it('blocks OID resolution functions', () => {
    const funcs = [
      'pg_get_userbyid(10)',
      'pg_describe_object(1,2,3)',
      "pg_identify_object_as_address('pg_class', '{1259}', '{}')",
      'pg_filenode_relation(0, 1234)',
    ];
    for (const fn of funcs) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
    }
  });

  it('blocks low-level stat functions', () => {
    const funcs = [
      'pg_stat_get_numscans(123)',
      'pg_stat_get_tuples_returned(123)',
      'pg_stat_get_blocks_fetched(123)',
    ];
    for (const fn of funcs) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('Low-level statistics');
    }
  });

  it('blocks pg_stat_gssapi and pg_stat_progress views', () => {
    for (const view of [
      'pg_stat_gssapi',
      'pg_stat_progress_vacuum',
      'pg_stat_progress_create_index',
      'pg_stat_progress_analyze',
    ]) {
      const match = blockedQueryPatterns.find((p) =>
        p.pattern.test(`SELECT * FROM ${view}`),
      );
      expect(match, `Expected ${view} to be blocked`).to.not.be.undefined;
    }
  });

  it('blocks aclexplode', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SELECT aclexplode(relacl) FROM pg_class'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('aclexplode');
  });

  it('blocks server size functions', () => {
    for (const fn of [
      "pg_database_size('mydb')",
      "pg_tablespace_size('pg_default')",
    ]) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
      expect(match.message).to.include('size');
    }
  });

  it('does not block safe SELECT queries', () => {
    const safeSql = 'SELECT * FROM users WHERE id = 1';
    const match = blockedQueryPatterns.find((p) => p.pattern.test(safeSql));
    expect(match).to.be.undefined;
  });

  it('does not block safe INSERT queries', () => {
    const safeSql = "INSERT INTO user_table (name) VALUES ('Alice')";
    const match = blockedQueryPatterns.find((p) => p.pattern.test(safeSql));
    expect(match).to.be.undefined;
  });

  it('is case insensitive', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('alter role foo superuser'),
    );
    expect(match).to.not.be.undefined;
  });
}

function allowedSetSettingsTests() {
  it('has 14 entries', () => {
    expect(allowedSetSettings.size).to.equal(14);
  });

  it('allows safe formatting/locale settings', () => {
    for (const s of [
      'datestyle',
      'timezone',
      'intervalstyle',
      'client_encoding',
      'bytea_output',
      'lc_messages',
      'lc_monetary',
      'lc_numeric',
      'lc_time',
    ]) {
      expect(allowedSetSettings.has(s), `Expected ${s} to be allowed`).to.be
        .true;
    }
  });

  it('allows application_name and search_path', () => {
    expect(allowedSetSettings.has('application_name')).to.be.true;
    expect(allowedSetSettings.has('search_path')).to.be.true;
  });

  it('blocks dangerous resource settings', () => {
    for (const s of [
      'work_mem',
      'hash_mem_multiplier',
      'max_parallel_workers_per_gather',
      'from_collapse_limit',
      'join_collapse_limit',
      'statement_timeout',
      'idle_in_transaction_session_timeout',
    ]) {
      expect(allowedSetSettings.has(s), `Expected ${s} to be blocked`).to.be
        .false;
    }
  });

  it('blocks privilege/security settings', () => {
    for (const s of [
      'role',
      'session_authorization',
      'default_transaction_read_only',
      'row_security',
      'client_min_messages',
    ]) {
      expect(allowedSetSettings.has(s), `Expected ${s} to be blocked`).to.be
        .false;
    }
  });
}

function allowedShowSettingsTests() {
  it('contains expected safe settings', () => {
    expect(allowedShowSettings.has('server_version')).to.be.true;
    expect(allowedShowSettings.has('search_path')).to.be.true;
    expect(allowedShowSettings.has('timezone')).to.be.true;
    expect(allowedShowSettings.has('client_encoding')).to.be.true;
    expect(allowedShowSettings.has('transaction_isolation')).to.be.true;
  });

  it('excludes sensitive settings', () => {
    expect(allowedShowSettings.has('max_connections')).to.be.false;
    expect(allowedShowSettings.has('wal_level')).to.be.false;
    expect(allowedShowSettings.has('ssl')).to.be.false;
    expect(allowedShowSettings.has('password_encryption')).to.be.false;
  });

  it('has 23 entries', () => {
    expect(allowedShowSettings.size).to.equal(23);
  });
}

function parseNullDelimitedBufferTests() {
  it('parses basic null-delimited buffer', () => {
    const buf = Buffer.from('hello\0world\0');
    const result = parseNullDelimitedBuffer(buf);
    expect(result).to.deep.equal(['hello', 'world']);
  });

  it('returns empty array for empty buffer', () => {
    const buf = Buffer.alloc(0);
    const result = parseNullDelimitedBuffer(buf);
    expect(result).to.deep.equal([]);
  });

  it('handles UTF-8 characters', () => {
    const buf = Buffer.from('héllo\0wörld\0');
    const result = parseNullDelimitedBuffer(buf);
    expect(result).to.deep.equal(['héllo', 'wörld']);
  });

  it('parses PG startup message format', () => {
    const buf = Buffer.from('user\0admin\0database\0mydb\0\0');
    const result = parseNullDelimitedBuffer(buf);
    expect(result).to.deep.equal(['user', 'admin', 'database', 'mydb', '']);
  });

  it('handles trailing non-null content', () => {
    const buf = Buffer.from('abc\0def');
    const result = parseNullDelimitedBuffer(buf);
    expect(result).to.deep.equal(['abc', 'def']);
  });
}

function buildPgErrorResponseTests() {
  it('starts with 0x45 (ErrorResponse)', () => {
    const buf = buildPgErrorResponse('test error');
    expect(buf[0]).to.equal(0x45);
  });

  it('ends with ReadyForQuery (0x5A + idle 0x49)', () => {
    const buf = buildPgErrorResponse('test error');
    // Last 6 bytes: Z + length(5) + I
    expect(buf[buf.length - 6]).to.equal(0x5a);
    expect(buf[buf.length - 1]).to.equal(0x49);
  });

  it('contains SQLSTATE 42501', () => {
    const buf = buildPgErrorResponse('test error');
    const str = buf.toString('utf8');
    expect(str).to.include('C42501');
  });

  it('contains the error message', () => {
    const msg = 'Access denied for tenant';
    const buf = buildPgErrorResponse(msg);
    const str = buf.toString('utf8');
    expect(str).to.include(msg);
  });

  it('has valid length field', () => {
    const buf = buildPgErrorResponse('test');
    const length = buf.readUInt32BE(1);
    // length field includes itself (4 bytes) + body, but NOT the message type byte
    // Total error portion = 1 (type) + length
    // Total buffer = error portion + 6 (ReadyForQuery)
    expect(1 + length + 6).to.equal(buf.length);
  });
}

function buildNamespaceOidSubqueryTests() {
  const parser = new Parser();

  it('produces IN operator with namespace subquery', () => {
    const result = buildNamespaceOidSubquery('c', 'relnamespace', [
      'my_schema',
    ]);
    expect(result.type).to.equal('binary_expr');
    expect(result.operator).to.equal('IN');
    expect(result.left.table).to.equal('c');
    expect(result.left.column.expr.value).to.equal('relnamespace');
  });

  it('includes system schemas', () => {
    const result = buildNamespaceOidSubquery('c', 'relnamespace', [
      'my_schema',
    ]);
    const innerWhere = result.right.value[0].ast.where;
    const schemaValues = innerWhere.right.value.map((v: any) => v.value);
    expect(schemaValues).to.include('pg_catalog');
    expect(schemaValues).to.include('information_schema');
    expect(schemaValues).to.include('pg_toast');
    expect(schemaValues).to.include('public');
    expect(schemaValues).to.include('my_schema');
  });

  it('marks inner SELECT as _ncGenerated', () => {
    const result = buildNamespaceOidSubquery('c', 'relnamespace', []);
    expect(result.right.value[0].ast._ncGenerated).to.be.true;
  });

  it('round-trips through parser.sqlify()', () => {
    const result = buildNamespaceOidSubquery('pg_class', 'relnamespace', [
      'test_schema',
    ]);
    // Build a full SELECT AST wrapping the subquery as a WHERE condition
    const fullAst = {
      type: 'select',
      options: null,
      distinct: { type: null },
      columns: [
        {
          type: 'expr',
          expr: { type: 'column_ref', table: null, column: '*' },
          as: null,
        },
      ],
      into: { position: null },
      from: [{ db: null, table: 'pg_class', as: null }],
      where: result,
      groupby: null,
      having: null,
      orderby: null,
      limit: { seperator: '', value: [] },
      window: null,
    };
    const sql = parser.sqlify(fullAst, { database: 'postgresql' });
    expect(sql).to.be.a('string');
    expect(sql.toLowerCase()).to.include('pg_namespace');
    expect(sql.toLowerCase()).to.include('nspname');
  });

  it('handles null alias', () => {
    const result = buildNamespaceOidSubquery(null, 'relnamespace', [
      'my_schema',
    ]);
    expect(result.left.table).to.be.null;
  });
}

function buildNestedClassSubqueryTests() {
  const parser = new Parser();

  it('produces nested pg_class → pg_namespace subquery', () => {
    const result = buildNestedClassSubquery('a', 'attrelid', ['my_schema']);
    expect(result.type).to.equal('binary_expr');
    expect(result.operator).to.equal('IN');
    // Outer: attrelid IN (SELECT oid FROM pg_class WHERE ...)
    const outerAst = result.right.value[0].ast;
    expect(outerAst.from[0].table).to.equal('pg_class');
    // Inner: relnamespace IN (SELECT oid FROM pg_namespace WHERE ...)
    const innerWhere = outerAst.where;
    expect(innerWhere.operator).to.equal('IN');
    const innerAst = innerWhere.right.value[0].ast;
    expect(innerAst.from[0].table).to.equal('pg_namespace');
  });

  it('marks both inner SELECTs as _ncGenerated', () => {
    const result = buildNestedClassSubquery('a', 'attrelid', []);
    const outerAst = result.right.value[0].ast;
    expect(outerAst._ncGenerated).to.be.true;
    const innerAst = outerAst.where.right.value[0].ast;
    expect(innerAst._ncGenerated).to.be.true;
  });

  it('round-trips through parser.sqlify()', () => {
    const result = buildNestedClassSubquery('pg_attribute', 'attrelid', [
      'test_schema',
    ]);
    const fullAst = {
      type: 'select',
      options: null,
      distinct: { type: null },
      columns: [
        {
          type: 'expr',
          expr: { type: 'column_ref', table: null, column: '*' },
          as: null,
        },
      ],
      into: { position: null },
      from: [{ db: null, table: 'pg_attribute', as: null }],
      where: result,
      groupby: null,
      having: null,
      orderby: null,
      limit: { seperator: '', value: [] },
      window: null,
    };
    const sql = parser.sqlify(fullAst, { database: 'postgresql' });
    expect(sql).to.be.a('string');
    expect(sql.toLowerCase()).to.include('pg_class');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });
}

function applyInterceptRulesRecursiveTests() {
  const parser = new Parser();
  const session = makeSession();

  it('injects WHERE for pg_namespace', () => {
    const ast = parser.astify('SELECT * FROM pg_namespace', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    expect(ast.where).to.not.be.null;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('nspname');
  });

  it('injects WHERE for pg_tables', () => {
    const ast = parser.astify('SELECT * FROM pg_tables', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  it('injects WHERE for pg_stat_user_tables', () => {
    const ast = parser.astify('SELECT * FROM pg_stat_user_tables', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  it('injects WHERE for pg_settings', () => {
    const ast = parser.astify('SELECT * FROM pg_settings', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('name');
  });

  it('injects WHERE for pg_stat_activity', () => {
    const ast = parser.astify('SELECT * FROM pg_stat_activity', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('usename');
  });

  it('injects WHERE for pg_roles', () => {
    const ast = parser.astify('SELECT * FROM pg_roles', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('rolname');
  });

  it('injects namespace OID subquery for pg_class', () => {
    const ast = parser.astify('SELECT * FROM pg_class', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('relnamespace');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });

  it('injects namespace OID subquery for pg_type', () => {
    const ast = parser.astify('SELECT * FROM pg_type', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('typnamespace');
  });

  it('injects nested subquery for pg_attribute', () => {
    const ast = parser.astify('SELECT * FROM pg_attribute', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('attrelid');
    expect(sql.toLowerCase()).to.include('pg_class');
  });

  it('injects nested subquery for pg_attrdef', () => {
    const ast = parser.astify('SELECT * FROM pg_attrdef', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('adrelid');
    expect(sql.toLowerCase()).to.include('pg_class');
  });

  it('ANDs with existing WHERE conditions', () => {
    const ast = parser.astify(
      "SELECT * FROM pg_namespace WHERE nspname = 'public'",
      { database: 'postgresql' },
    ) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    expect(ast.where.operator).to.equal('AND');
  });

  it('handles aliased tables', () => {
    const ast = parser.astify('SELECT n.nspname FROM pg_namespace n', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    // The injected clause should use alias 'n'
    expect(sql).to.include('n');
    expect(sql.toLowerCase()).to.include('nspname');
  });

  it('recurses into subqueries', () => {
    const ast = parser.astify(
      'SELECT * FROM (SELECT * FROM pg_namespace) sub',
      { database: 'postgresql' },
    ) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
  });

  it('skips _ncGenerated nodes', () => {
    const ast = {
      _ncGenerated: true,
      type: 'select',
      from: [{ table: 'pg_namespace', as: null }],
      where: null,
    };
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.false;
  });

  it('returns false for non-matching queries', () => {
    const ast = parser.astify('SELECT 1', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.false;
  });

  // --- New interceptMap entries (Step 3: pg_catalog views) ---
  it('injects WHERE for pg_stats', () => {
    const ast = parser.astify('SELECT * FROM pg_stats', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  it('injects WHERE for pg_matviews', () => {
    const ast = parser.astify('SELECT * FROM pg_matviews', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  it('injects WHERE for pg_views', () => {
    const ast = parser.astify('SELECT * FROM pg_views', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  it('injects WHERE for pg_rules', () => {
    const ast = parser.astify('SELECT * FROM pg_rules', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('schemaname');
  });

  // --- New interceptMap entries (Step 3: information_schema views) ---
  it('injects WHERE for information_schema.tables', () => {
    const ast = parser.astify('SELECT * FROM information_schema.tables', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('table_schema');
  });

  it('injects WHERE for information_schema.columns', () => {
    const ast = parser.astify('SELECT * FROM information_schema.columns', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('table_schema');
  });

  it('injects WHERE for information_schema.routines', () => {
    const ast = parser.astify('SELECT * FROM information_schema.routines', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('routine_schema');
  });

  it('injects WHERE for information_schema.table_constraints', () => {
    const ast = parser.astify(
      'SELECT * FROM information_schema.table_constraints',
      { database: 'postgresql' },
    ) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('constraint_schema');
  });

  it('injects WHERE for information_schema.triggers', () => {
    const ast = parser.astify('SELECT * FROM information_schema.triggers', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('trigger_schema');
  });

  it('injects WHERE for information_schema.domains', () => {
    const ast = parser.astify('SELECT * FROM information_schema.domains', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('domain_schema');
  });

  // --- New catalogNamespaceFilters entries (Step 4) ---
  it('injects namespace OID subquery for pg_proc', () => {
    const ast = parser.astify('SELECT * FROM pg_proc', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('pronamespace');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });

  it('injects nested subquery for pg_statistic', () => {
    const ast = parser.astify('SELECT * FROM pg_statistic', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('starelid');
    expect(sql.toLowerCase()).to.include('pg_class');
  });

  it('injects nested subquery for pg_policy', () => {
    const ast = parser.astify('SELECT * FROM pg_policy', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('polrelid');
    expect(sql.toLowerCase()).to.include('pg_class');
  });

  it('injects namespace OID subquery for pg_default_acl', () => {
    const ast = parser.astify('SELECT * FROM pg_default_acl', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('defaclnamespace');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });

  it('injects nested subquery for pg_sequence', () => {
    const ast = parser.astify('SELECT * FROM pg_sequence', {
      database: 'postgresql',
    }) as any;
    const modified = applyInterceptRulesRecursive(ast, session);
    expect(modified).to.be.true;
    const sql = parser.sqlify(ast, { database: 'postgresql' });
    expect(sql.toLowerCase()).to.include('seqrelid');
    expect(sql.toLowerCase()).to.include('pg_class');
  });
}

function interceptQueryIfNeededTests() {
  const parser = new Parser();

  it('throws QueryBlockedError for blocked patterns', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('ALTER ROLE foo SUPERUSER');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('ALTER ROLE');
    }
  });

  it('allows SHOW for safe settings', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SHOW server_version');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SHOW timezone (case insensitive)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SHOW TimeZone');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks SHOW for sensitive settings', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SHOW max_connections');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('SHOW');
    }
  });

  it('blocks SHOW ALL', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SHOW ALL');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('rewrites current_database() to workspace ID', async () => {
    const session = makeSession({ fk_workspace_id: 'ws_abc' });
    const buf = buildQueryBuffer('SELECT current_database()');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('ws_abc');
    expect(sql.toLowerCase()).to.not.include('current_database');
  });

  it('rewrites current_catalog to workspace ID', async () => {
    const session = makeSession({ fk_workspace_id: 'ws_xyz' });
    const buf = buildQueryBuffer('SELECT current_catalog');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('ws_xyz');
  });

  it('returns modified Buffer for catalog table SELECT', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT * FROM pg_namespace');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include('nspname');
  });

  it('returns undefined for non-matching SELECT', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT 1 + 1');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks unparseable queries', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('THIS IS NOT SQL AT ALL ~~~');
    let parseErrorCalled = false;
    try {
      await interceptQueryIfNeeded(buf, session, parser, () => {
        parseErrorCalled = true;
      });
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('not supported');
    }
    expect(parseErrorCalled).to.be.true;
  });

  it('blocks unparseable query even with current_database rewrite', async () => {
    const session = makeSession({ fk_workspace_id: 'ws_fallback' });
    const buf = buildQueryBuffer('SOME WEIRD current_database() STUFF ~~~');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('allows EXPLAIN through as non-parseable safe pattern', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('EXPLAIN SELECT 1');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks EXPLAIN ANALYZE via regex', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('EXPLAIN ANALYZE SELECT * FROM pg_tables');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('EXPLAIN ANALYZE');
    }
  });

  it('allows EXPLAIN with current_database rewrite', async () => {
    const session = makeSession({ fk_workspace_id: 'ws_explain' });
    const buf = buildQueryBuffer('EXPLAIN SELECT current_database()');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('ws_explain');
  });

  it('allows RESET for whitelisted settings', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET search_path');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks RESET ALL', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET ALL');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('RESET ALL');
    }
  });

  it('blocks RESET for non-whitelisted settings', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET work_mem');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('RESET work_mem');
    }
  });

  it('blocks COPY via regex before parse', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      'COPY (SELECT nspname FROM pg_namespace) TO STDOUT',
    );
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('COPY');
    }
  });

  // --- SET/RESET whitelist tests ---
  it('blocks SET statement_timeout (not whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET statement_timeout = 0');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('SET statement_timeout');
    }
  });

  it('blocks SET work_mem (DoS vector)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET work_mem = '10GB'");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('SET work_mem');
    }
  });

  it('blocks SET from_collapse_limit', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET from_collapse_limit = 1000');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET join_collapse_limit', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET join_collapse_limit = 1000');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET max_parallel_workers_per_gather', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET max_parallel_workers_per_gather = 100');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET role (privilege escalation)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET role = 'postgres'");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('SET role');
    }
  });

  it('blocks SET default_transaction_read_only', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET default_transaction_read_only = 'off'");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET hash_mem_multiplier', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET hash_mem_multiplier = 100');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET client_min_messages', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET client_min_messages = 'debug5'");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET row_security', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET row_security = 'off'");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks SET LOCAL statement_timeout', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET LOCAL statement_timeout = 0');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('allows SET DateStyle (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET DateStyle = 'ISO, MDY'");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET timezone (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET timezone = 'UTC'");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET client_encoding (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET client_encoding = 'UTF8'");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET application_name (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SET application_name = 'Metabase'");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET extra_float_digits (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET extra_float_digits = 3');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET TRANSACTION READ ONLY', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET TRANSACTION READ ONLY');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows SET TRANSACTION ISOLATION LEVEL', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks SET TRANSACTION READ WRITE', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET TRANSACTION READ WRITE');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('READ WRITE');
    }
  });

  it('allows RESET search_path (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET search_path');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows RESET datestyle (whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET datestyle');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks RESET work_mem (not whitelisted)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET work_mem');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('SET is case insensitive', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("set DATESTYLE = 'ISO'");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks SET idle_in_transaction_session_timeout', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET idle_in_transaction_session_timeout = 0');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('blocks lo_create', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT lo_create(0)');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('Large object');
    }
  });

  it('output starts with 0x51 (Query message type)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT * FROM pg_namespace');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result[0]).to.equal(0x51);
  });

  it('handles pg_class with OID subquery injection', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT relname FROM pg_class WHERE relkind = 'r'",
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include('relnamespace');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });

  it('handles pg_attribute with nested subquery injection', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT attname FROM pg_attribute');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include('pg_class');
    expect(sql.toLowerCase()).to.include('pg_namespace');
  });

  it('does not call onParseError for parseable queries', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT 1');
    let called = false;
    await interceptQueryIfNeeded(buf, session, parser, () => {
      called = true;
    });
    expect(called).to.be.false;
  });

  it('blocks pg_sleep even inside complex SQL', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT CASE WHEN 1=1 THEN pg_sleep(5) ELSE 'ok' END",
    );
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
    }
  });

  it('allows SHOW with trailing semicolon', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SHOW search_path;');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('rewrites current_user to session pgUser', async () => {
    const session = makeSession({ pgUser: 'nc_test_user' });
    const buf = buildQueryBuffer('SELECT current_user');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('nc_test_user');
  });

  it('rewrites session_user to session pgUser', async () => {
    const session = makeSession({ pgUser: 'nc_test_user' });
    const buf = buildQueryBuffer('SELECT session_user');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('nc_test_user');
  });

  it('rewrites current_user and session_user together', async () => {
    const session = makeSession({ pgUser: 'nc_usr' });
    const buf = buildQueryBuffer('SELECT current_user, session_user');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.not.include('current_user');
    expect(sql).to.not.include('session_user');
    expect(sql).to.include('nc_usr');
  });

  it('allows SET search_path via whitelist handler', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET search_path TO myschema, public');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('does not false-positive on COPY inside string literal', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT 'This is a copy of the data' AS label",
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    // Should not throw — 'copy' is inside a string literal
    expect(result).to.be.undefined;
  });

  it('does not false-positive on GRANT inside string literal', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SELECT 'GRANT me access' AS msg");
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks pg_sleep with comment bypass (pg_sleep/**/())', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_sleep/*comment*/(5)');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('pg_sleep');
    }
  });

  it('blocks query_to_xml', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT query_to_xml('SELECT * FROM pg_namespace', true, false, '')",
    );
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('XML');
    }
  });

  it('blocks set_config function', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT set_config('search_path', 'evil', false)",
    );
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('set_config');
    }
  });

  it('blocks current_setting function', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer("SELECT current_setting('listen_addresses')");
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('current_setting');
    }
  });

  it('blocks CAST(oid AS regclass)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT CAST(1259 AS regclass)');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('reg*');
    }
  });

  it('blocks pg_terminate_backend', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_terminate_backend(12345)');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('termination');
    }
  });

  it('blocks pg_stat_database query', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT datname FROM pg_stat_database');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('Server-wide');
    }
  });

  it('blocks pg_auth_members query', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT * FROM pg_auth_members');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('shared catalog');
    }
  });

  it('blocks pg_backend_pid function', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_backend_pid()');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('pg_backend_pid');
    }
  });

  it('blocks inet_client_addr function', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT inet_client_addr()');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('Client network');
    }
  });

  it('blocks pg_extension query', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT * FROM pg_extension');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('server-level');
    }
  });

  // --- Function rewrite tests ---
  it('rewrites pg_get_indexdef to empty string', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_get_indexdef(16384)');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("''::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_indexdef');
  });

  it('rewrites pg_get_constraintdef to empty string', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_get_constraintdef(16384)');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("''::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_constraintdef');
  });

  it('rewrites pg_get_userbyid to nocodb', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_get_userbyid(10)');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("'nocodb'::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_userbyid');
  });

  it('rewrites pg_catalog.pg_get_userbyid (schema-qualified)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      'SELECT pg_catalog.pg_get_userbyid(c.relowner) FROM pg_class c',
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("'nocodb'::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_userbyid');
  });

  it('rewrites pg_get_indexdef with 3 args', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_get_indexdef(16384, 0, true)');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("''::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_indexdef');
  });

  // --- Double-quoted identifier normalization tests ---
  // Double-quoted function names get normalized to unquoted, then rewritten to safe literals
  it('rewrites double-quoted "pg_get_userbyid"(10) to nocodb', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT "pg_get_userbyid"(10)');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("'nocodb'::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_userbyid');
  });

  it('rewrites double-quoted "pg_catalog"."pg_get_indexdef"(16384)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      'SELECT "pg_catalog"."pg_get_indexdef"(16384)',
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("''::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_indexdef');
  });

  it('rewrites pg_catalog."pg_get_constraintdef"(16384)', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      'SELECT pg_catalog."pg_get_constraintdef"(16384)',
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include("''::text");
    expect(sql.toLowerCase()).to.not.include('pg_get_constraintdef');
  });

  // --- Publication query replacement test ---
  it('replaces publication + publishable query with empty result', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer(
      "SELECT * FROM pg_publication p WHERE pg_relation_is_publishable('t')",
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql.toLowerCase()).to.include('where false');
  });

  // --- forceModified tracking test ---
  it('returns Buffer for standalone rewritten query (forceModified)', async () => {
    const session = makeSession();
    // pg_get_userbyid(10) gets rewritten to 'nocodb'::text — should still return a Buffer
    const buf = buildQueryBuffer(
      "SELECT pg_get_userbyid(10) AS owner, 'hello'",
    );
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    // Verify the result is a valid query message
    expect(result[0]).to.equal(0x51);
  });

  it('blocks pg_get_ruledef', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SELECT pg_get_ruledef(16384)');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e: any) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('pg_get_ruledef');
    }
  });
}

function stripSqlCommentsTests() {
  it('strips block comments', () => {
    expect(stripSqlComments('SELECT /* comment */ 1')).to.equal('SELECT   1');
  });

  it('strips line comments', () => {
    expect(stripSqlComments('SELECT 1 -- comment')).to.equal('SELECT 1  ');
  });

  it('strips comment between function name and parens', () => {
    const result = stripSqlComments('pg_sleep/*bypass*/(5)');
    expect(result).to.equal('pg_sleep (5)');
  });

  it('strips multiple block comments', () => {
    const result = stripSqlComments('SELECT /* a */ 1 /* b */ + 2');
    expect(result).to.equal('SELECT   1   + 2');
  });

  it('handles nested block comments', () => {
    const result = stripSqlComments(
      'SELECT /* outer /* inner */ still outer */ 1',
    );
    expect(result).to.equal('SELECT   1');
  });

  it('neutralizes single-quoted string contents', () => {
    const result = stripSqlComments("SELECT 'This is a COPY' FROM t");
    expect(result).to.equal("SELECT '' FROM t");
    expect(result).to.not.include('COPY');
  });

  it('neutralizes dollar-quoted string contents', () => {
    const result = stripSqlComments('SELECT $$GRANT ALL$$ FROM t');
    expect(result).to.equal('SELECT $$$$ FROM t');
    expect(result).to.not.include('GRANT');
  });

  it('neutralizes escaped single quotes', () => {
    const result = stripSqlComments("SELECT 'it''s a COPY' FROM t");
    expect(result).to.equal("SELECT '' FROM t");
    expect(result).to.not.include('COPY');
  });

  it('handles mixed strings and comments', () => {
    const sql = "SELECT 'safe' /* remove this */ FROM t -- also remove";
    const result = stripSqlComments(sql);
    expect(result).to.include("''");
    expect(result).to.not.include('remove this');
    expect(result).to.not.include('also remove');
  });

  it('neutralizes comment-like syntax inside strings', () => {
    const result = stripSqlComments("SELECT '/* not a comment */' FROM t");
    expect(result).to.equal("SELECT '' FROM t");
  });

  it('returns input unchanged when no comments or strings', () => {
    const sql = 'SELECT * FROM pg_namespace';
    expect(stripSqlComments(sql)).to.equal(sql);
  });
}

function rewriteSASLMechanismsTests() {
  it('filters out SCRAM-SHA-256-PLUS', () => {
    // Build a mock AuthenticationSASL message
    // byte 0: 'R' (0x52)
    // bytes 1-4: length
    // bytes 5-8: auth type (10 = SASL)
    // bytes 9+: null-delimited mechanism list
    const mechs = Buffer.from('SCRAM-SHA-256\0SCRAM-SHA-256-PLUS\0\0');
    const header = Buffer.alloc(9);
    header.writeUInt8(0x52, 0);
    header.writeUInt32BE(4 + 4 + mechs.length, 1);
    header.writeUInt32BE(10, 5);
    const buf = Buffer.concat([header, mechs]);

    const result = rewriteSASLMechanisms(buf);
    const resultMechs = parseNullDelimitedBuffer(result.subarray(9));
    expect(resultMechs).to.include('SCRAM-SHA-256');
    expect(resultMechs).to.not.include('SCRAM-SHA-256-PLUS');
  });

  it('throws when no valid mechanisms remain', () => {
    // Only SCRAM-SHA-256-PLUS with single null terminator (no trailing empty)
    const mechs = Buffer.from('SCRAM-SHA-256-PLUS\0');
    const header = Buffer.alloc(9);
    header.writeUInt8(0x52, 0);
    header.writeUInt32BE(4 + 4 + mechs.length, 1);
    header.writeUInt32BE(10, 5);
    const buf = Buffer.concat([header, mechs]);

    expect(() => rewriteSASLMechanisms(buf)).to.throw(
      'No valid SASL mechanisms after filtering',
    );
  });

  it('preserves header format', () => {
    const mechs = Buffer.from('SCRAM-SHA-256\0\0');
    const header = Buffer.alloc(9);
    header.writeUInt8(0x52, 0);
    header.writeUInt32BE(4 + 4 + mechs.length, 1);
    header.writeUInt32BE(10, 5);
    const buf = Buffer.concat([header, mechs]);

    const result = rewriteSASLMechanisms(buf);
    expect(result[0]).to.equal(0x52); // 'R'
    expect(result.readUInt32BE(5)).to.equal(10); // AuthenticationSASL
  });
}

function constantsTests() {
  it('interceptMap has 58 rules', () => {
    expect(interceptMap.length).to.equal(58);
  });

  it('blockedQueryPatterns has 55 patterns', () => {
    expect(blockedQueryPatterns.length).to.equal(55);
  });

  it('allowedNonParseablePatterns has 1 pattern', () => {
    expect(allowedNonParseablePatterns.length).to.equal(1);
  });

  it('catalogNamespaceFilters has 14 entries', () => {
    expect(catalogNamespaceFilters.length).to.equal(14);
  });

  it('catalogNamespaceFilters has correct modes', () => {
    const direct = catalogNamespaceFilters.filter((f) => f.mode === 'direct');
    const nested = catalogNamespaceFilters.filter((f) => f.mode === 'nested');
    expect(direct.length).to.equal(4); // pg_class, pg_type, pg_proc, pg_default_acl
    expect(nested.length).to.equal(10);
  });

  it('allowedSetSettings has 14 entries', () => {
    expect(allowedSetSettings.size).to.equal(14);
  });
}

function dataReflectionInterceptorTests() {
  describe('blockedQueryPatterns', blockedQueryTests);
  describe('allowedSetSettings', allowedSetSettingsTests);
  describe('allowedShowSettings', allowedShowSettingsTests);
  describe('parseNullDelimitedBuffer', parseNullDelimitedBufferTests);
  describe('buildPgErrorResponse', buildPgErrorResponseTests);
  describe('buildNamespaceOidSubquery', buildNamespaceOidSubqueryTests);
  describe('buildNestedClassSubquery', buildNestedClassSubqueryTests);
  describe('applyInterceptRulesRecursive', applyInterceptRulesRecursiveTests);
  describe('interceptQueryIfNeeded', interceptQueryIfNeededTests);
  describe('stripSqlComments', stripSqlCommentsTests);
  describe('rewriteSASLMechanisms', rewriteSASLMechanismsTests);
  describe('constants', constantsTests);
}

export function dataReflectionInterceptorTest() {
  describe('dataReflectionInterceptor', dataReflectionInterceptorTests);
}
