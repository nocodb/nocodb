import 'mocha';
import { expect } from 'chai';
import { Parser } from 'node-sql-parser';
import { serialize } from 'pg-protocol';
import type { InterceptSession } from '~/helpers/dataReflectionInterceptor';
import {
  allowedNonParseablePatterns,
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

  it('blocks dangerous catalog functions', () => {
    const funcs = [
      'pg_relation_filepath(123)',
      'pg_identify_object(1,2,3)',
      'pg_get_indexdef(123)',
      'pg_get_constraintdef(123)',
      'pg_get_viewdef(123)',
      'pg_get_functiondef(123)',
      'pg_get_triggerdef(123)',
      "has_schema_privilege(1, 'USAGE')",
      "has_table_privilege(1, 'SELECT')",
    ];
    for (const fn of funcs) {
      const sql = `SELECT ${fn}`;
      const match = blockedQueryPatterns.find((p) => p.pattern.test(sql));
      expect(match, `Expected ${fn} to be blocked`).to.not.be.undefined;
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

  it('blocks SET statement_timeout', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SET statement_timeout = 0'),
    );
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('timeout');
  });

  it('blocks SET LOCAL statement_timeout', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SET LOCAL statement_timeout = 0'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks SET idle_in_transaction_session_timeout', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('SET idle_in_transaction_session_timeout = 0'),
    );
    expect(match).to.not.be.undefined;
  });

  it('blocks RESET ALL', () => {
    const match = blockedQueryPatterns.find((p) => p.pattern.test('RESET ALL'));
    expect(match).to.not.be.undefined;
    expect(match.message).to.include('timeout');
  });

  it('blocks RESET statement_timeout', () => {
    const match = blockedQueryPatterns.find((p) =>
      p.pattern.test('RESET statement_timeout'),
    );
    expect(match).to.not.be.undefined;
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

  it('does not block SET for non-timeout settings', () => {
    const safeSql = 'SET search_path TO myschema';
    const match = blockedQueryPatterns.find((p) => p.pattern.test(safeSql));
    expect(match).to.be.undefined;
  });

  it('does not block RESET for non-timeout settings', () => {
    const safeSql = 'RESET search_path';
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

  it('allows EXPLAIN ANALYZE through', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('EXPLAIN ANALYZE SELECT * FROM pg_tables');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('allows EXPLAIN with current_database rewrite', async () => {
    const session = makeSession({ fk_workspace_id: 'ws_explain' });
    const buf = buildQueryBuffer('EXPLAIN SELECT current_database()');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.instanceOf(Buffer);
    const sql = result.subarray(5).toString('utf8').replace(/\0/g, '');
    expect(sql).to.include('ws_explain');
  });

  it('allows RESET for safe settings', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET search_path');
    const result = await interceptQueryIfNeeded(buf, session, parser);
    expect(result).to.be.undefined;
  });

  it('blocks RESET ALL via regex', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('RESET ALL');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('timeout');
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

  it('blocks SET statement_timeout', async () => {
    const session = makeSession();
    const buf = buildQueryBuffer('SET statement_timeout = 0');
    try {
      await interceptQueryIfNeeded(buf, session, parser);
      expect.fail('Expected QueryBlockedError');
    } catch (e) {
      expect(e).to.be.instanceOf(QueryBlockedError);
      expect(e.message).to.include('timeout');
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
  it('interceptMap has 22 rules', () => {
    expect(interceptMap.length).to.equal(22);
  });

  it('blockedQueryPatterns has 32 patterns', () => {
    expect(blockedQueryPatterns.length).to.equal(32);
  });

  it('allowedNonParseablePatterns has 2 patterns', () => {
    expect(allowedNonParseablePatterns.length).to.equal(2);
  });

  it('catalogNamespaceFilters has 8 entries', () => {
    expect(catalogNamespaceFilters.length).to.equal(8);
  });

  it('catalogNamespaceFilters has correct modes', () => {
    const direct = catalogNamespaceFilters.filter((f) => f.mode === 'direct');
    const nested = catalogNamespaceFilters.filter((f) => f.mode === 'nested');
    expect(direct.length).to.equal(2); // pg_class, pg_type
    expect(nested.length).to.equal(6);
  });
}

function dataReflectionInterceptorTests() {
  describe('blockedQueryPatterns', blockedQueryTests);
  describe('allowedShowSettings', allowedShowSettingsTests);
  describe('parseNullDelimitedBuffer', parseNullDelimitedBufferTests);
  describe('buildPgErrorResponse', buildPgErrorResponseTests);
  describe('buildNamespaceOidSubquery', buildNamespaceOidSubqueryTests);
  describe('buildNestedClassSubquery', buildNestedClassSubqueryTests);
  describe('applyInterceptRulesRecursive', applyInterceptRulesRecursiveTests);
  describe('interceptQueryIfNeeded', interceptQueryIfNeededTests);
  describe('rewriteSASLMechanisms', rewriteSASLMechanismsTests);
  describe('constants', constantsTests);
}

export function dataReflectionInterceptorTest() {
  describe('dataReflectionInterceptor', dataReflectionInterceptorTests);
}
