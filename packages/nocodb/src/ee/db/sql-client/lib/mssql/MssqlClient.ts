import knex from 'knex';
import { find } from 'lodash';
import { nanoid } from 'nanoid';
import mssqlQueries from './mssql.queries';
import KnexClient from '~/db/sql-client/lib/KnexClient';
import Debug from '~/db/util/Debug';
import Result from '~/db/util/Result';
import deepClone from '~/helpers/deepClone';
import { runExternal } from '~/helpers/muxHelpers';

const log = new Debug('MssqlClient');

const isKnexWrapped = Symbol('isKnexWrapped');

/**
 * Microsoft SQL Server client.
 *
 * Uses knex's built-in `mssql` dialect (which drives the `tedious` TDS driver),
 * so it does NOT reassign `connectionConfig.client` the way the Snowflake /
 * Databricks EE clients do — `client: 'mssql'` is a native knex dialect.
 *
 * Modeled on the complete CE dialects (PgClient / MysqlClient). The connect
 * path (testConnection / version / databaseList / getKnexDataTypes) is
 * implemented; schema introspection and DDL are stubbed and filled in across
 * Phases 1, 3 and 4.
 */
class MssqlClient extends KnexClient {
  constructor(connectionConfig) {
    super(connectionConfig);
    this.queries = mssqlQueries;
    this._version = {};

    // When DB Mux is enabled (EE default), the source's knex is built with no
    // local connection and queries must be routed to the nc-sql-executor.
    // Wrap raw() to forward through runExternal in that mode — mirrors the EE
    // PgClient / MysqlClient / Snowflake wrappers. In non-mux mode (no
    // isExternal/extDb) it falls through to the normal local execution.
    if (!this.sqlClient[isKnexWrapped]) {
      this.sqlClient[isKnexWrapped] = true;

      const knexRaw = this.sqlClient.raw;
      const self = this;

      Object.defineProperties(this.sqlClient, {
        raw: {
          enumerable: true,
          value: function (...args) {
            const builder = knexRaw.apply(this, args);

            const originalThen = builder.then;

            builder.then = function (onFulfilled, onRejected) {
              if (
                self.sqlClient &&
                (self.sqlClient.isExternal || self.sqlClient.extDb?.upgrader)
              ) {
                return runExternal(builder.toQuery(), self.sqlClient.extDb, {
                  raw: true,
                })
                  .then(onFulfilled)
                  .catch(onRejected);
              }
              return originalThen.call(builder, onFulfilled, onRejected);
            };

            return builder;
          },
        },
      });
    }
  }

  private _tempConnectionConfig(database: string) {
    const cfg = deepClone(this.connectionConfig);
    cfg.connection.password = this.connectionConfig.connection.password;
    cfg.connection.database = database;
    return { ...cfg, pool: { min: 0, max: 1 } };
  }

  async testConnection(args: any = {}) {
    const _func = this.testConnection.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.raw('SELECT 1 AS data');
    } catch (e1) {
      // Retry against the `master` system database — the target database may
      // not exist yet, but the credentials/host can still be valid.
      const tempSqlClient = knex(this._tempConnectionConfig('master'));
      try {
        await tempSqlClient.raw('SELECT 1 AS data');
      } catch (e) {
        log.ppe(e);
        result.code = -1;
        // surface the original error against the requested database
        result.message = e1.message;
      } finally {
        await tempSqlClient.destroy();
      }
    } finally {
      log.api(`${_func}:result:`, result);
    }

    return result;
  }

  /**
   * SQL Server data types surfaced to the column-type picker. Must stay in
   * sync with MssqlUi.dbTypes / MssqlUi.getAbstractType (SDK).
   */
  getKnexDataTypes() {
    const result = new Result();

    result.data.list = [
      // exact numerics
      'bigint',
      'bit',
      'decimal',
      'int',
      'money',
      'numeric',
      'smallint',
      'smallmoney',
      'tinyint',
      // approximate numerics
      'float',
      'real',
      // date & time
      'date',
      'datetime',
      'datetime2',
      'datetimeoffset',
      'smalldatetime',
      'time',
      // character strings
      'char',
      'varchar',
      'text',
      // unicode character strings
      'nchar',
      'nvarchar',
      'ntext',
      // binary strings
      'binary',
      'varbinary',
      'image',
      // other
      'uniqueidentifier',
      'xml',
      'json',
      'geography',
      'geometry',
      'hierarchyid',
      'sql_variant',
      'rowversion',
      'timestamp',
    ];

    return result;
  }

  async version(args: any = {}) {
    const _func = this.version.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data.object = {};
      const data = await this.sqlClient.raw(
        `SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS version`,
      );
      // knex's mssql dialect returns the recordset array directly; guard for
      // the pg-style `{ rows }` shape too so this is resilient.
      const rows = data?.rows ?? data ?? [];
      const versionString = rows[0]?.version;

      if (!versionString) {
        result.code = -1;
        result.message = 'Could not determine SQL Server version';
        return result;
      }

      result.data.object.version = versionString;
      const versions = versionString.split('.');
      // ProductVersion is major.minor.build.revision (e.g. 16.0.1000.6)
      result.data.object.primary = versions[0];
      result.data.object.major = versions[1];
      result.data.object.minor = versions[2] ?? versions[1];
      result.data.object.key = (versions[0] ?? '') + (versions[1] ?? '');
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${_func} :result: %o`, result);
    }
    return result;
  }

  async databaseList(args: any = {}) {
    const _func = this.databaseList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const data = await this.sqlClient.raw(
        `SELECT name AS database_name
           FROM sys.databases
          WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
          ORDER BY name`,
      );
      result.data.list = data?.rows ?? data ?? [];
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Schema introspection (Phase 1) — reads SQL Server system catalogs.
  // ---------------------------------------------------------------------------

  // knex's mssql dialect returns recordsets as a plain array; guard for the
  // pg-style { rows } shape too.
  private _rows(resp: any): any[] {
    return resp?.rows ?? resp ?? [];
  }

  // Effective schema for catalog lookups (SQL Server default is `dbo`).
  private _schema(args: any = {}): string {
    return (
      args.schema || (this.connectionConfig as any)?.searchPath?.[0] || 'dbo'
    );
  }

  // Normalize a SQL Server COLUMN_DEFAULT (e.g. `((0))`, `(N'abc')`,
  // `(getdate())`) to a bare value/expression.
  private _cleanDefault(cdf: any) {
    if (cdf === null || cdf === undefined) return cdf;
    let v = String(cdf).trim();
    while (v.startsWith('(') && v.endsWith(')')) v = v.slice(1, -1).trim();
    v = v.replace(/^N?'([\s\S]*)'$/, '$1');
    return v;
  }

  async tableList(args: any = {}) {
    const _func = this.tableList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT TABLE_NAME AS tn, TABLE_SCHEMA AS ts
           FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME`,
        [this._schema(args)],
      );
      result.data.list = this._rows(resp).map((r) => ({ tn: r.tn, ts: r.ts }));
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async schemaList(args: any = {}) {
    const _func = this.schemaList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT name AS schema_name
           FROM sys.schemas
          WHERE name NOT IN (
            'sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
            'db_securityadmin','db_ddladmin','db_backupoperator','db_datareader',
            'db_datawriter','db_denydatareader','db_denydatawriter')
          ORDER BY name`,
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async columnList(args: any = {}) {
    const _func = this.columnList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT
            c.TABLE_NAME AS tn,
            c.COLUMN_NAME AS cn,
            c.DATA_TYPE AS dt,
            c.CHARACTER_MAXIMUM_LENGTH AS clen,
            c.NUMERIC_PRECISION AS np,
            c.NUMERIC_SCALE AS ns,
            c.DATETIME_PRECISION AS dp,
            c.ORDINAL_POSITION AS cop,
            c.IS_NULLABLE AS nrqd,
            c.COLUMN_DEFAULT AS cdf,
            c.COLLATION_NAME AS clnn,
            COLUMNPROPERTY(
              OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)),
              c.COLUMN_NAME, 'IsIdentity') AS is_identity,
            COLUMNPROPERTY(
              OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)),
              c.COLUMN_NAME, 'IsComputed') AS is_computed,
            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_pk,
            CASE WHEN uq.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_unique
          FROM INFORMATION_SCHEMA.COLUMNS c
          LEFT JOIN (
            SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
               AND tc.CONSTRAINT_SCHEMA = ku.CONSTRAINT_SCHEMA
             WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
              AND pk.TABLE_NAME = c.TABLE_NAME
              AND pk.COLUMN_NAME = c.COLUMN_NAME
          LEFT JOIN (
            SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
               AND tc.CONSTRAINT_SCHEMA = ku.CONSTRAINT_SCHEMA
             WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
          ) uq ON uq.TABLE_SCHEMA = c.TABLE_SCHEMA
              AND uq.TABLE_NAME = c.TABLE_NAME
              AND uq.COLUMN_NAME = c.COLUMN_NAME
          WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
          ORDER BY c.ORDINAL_POSITION`,
        [this._schema(args), args.tn],
      );

      const columns = [];
      for (const r of this._rows(resp)) {
        const column: any = {};
        // CHARACTER_MAXIMUM_LENGTH is -1 for (max)/xml large-value types — not
        // a real length. Normalize so it isn't treated as a literal size.
        const isMaxLen = r.clen === -1;
        column.tn = r.tn;
        column.cn = r.cn;
        column.cno = r.cn;
        column.dt = r.dt;
        column.dtx = r.dt;
        column.np = r.np;
        column.ns = r.ns;
        column.clen = isMaxLen ? null : r.clen;
        column.dp = r.dp;
        column.cop = r.cop;
        column.pk = !!r.is_pk;
        column.unique = !!r.is_unique;
        column.nrqd = r.nrqd !== 'NO';
        column.not_nullable = !column.nrqd;
        column.rqd = !column.nrqd;
        column.un = false; // SQL Server has no UNSIGNED
        column.ai = r.is_identity === 1;
        column.cdf = this._cleanDefault(r.cdf);
        column.clnn = r.clnn;
        column.dtxp = isMaxLen ? undefined : r.clen ?? r.np ?? r.dp;
        column.dtxs = r.ns;
        // Computed columns are read-only in SQL Server — surface so write
        // paths (Phase 3) can skip them.
        column.is_computed = r.is_computed === 1;
        column.au = false;
        columns.push(column);
      }
      result.data.list = columns;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT
            i.name AS key_name,
            col.name AS cn,
            ic.key_ordinal AS seq_in_index,
            CASE WHEN i.is_unique = 1 THEN 0 ELSE 1 END AS non_unique,
            CASE WHEN i.is_unique = 1 THEN 0 ELSE 1 END AS non_unique_original,
            i.is_primary_key AS primarykey,
            1 AS is_index
          FROM sys.indexes i
          JOIN sys.tables tab ON tab.object_id = i.object_id
          JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
          JOIN sys.index_columns ic
            ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          JOIN sys.columns col
            ON col.object_id = ic.object_id AND col.column_id = ic.column_id
          WHERE sch.name = ? AND tab.name = ? AND i.type > 0
          ORDER BY i.name, ic.key_ordinal`,
        [this._schema(args), args.tn],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // SQL Server referential-action descriptions → NocoDB's expected wording.
  private _mapReferentialAction(desc: string) {
    return (desc || 'NO_ACTION').replace(/_/g, ' ');
  }

  private _relationListSql(filterByTable: boolean) {
    return `SELECT
          fk.name AS cstn,
          sch.name AS ts,
          tab.name AS tn,
          col.name AS cn,
          rsch.name AS foreign_table_schema,
          rtab.name AS rtn,
          rcol.name AS rcn,
          fk.update_referential_action_desc AS ur,
          fk.delete_referential_action_desc AS dr
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.tables tab ON tab.object_id = fk.parent_object_id
        JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
        JOIN sys.columns col
          ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id
        JOIN sys.tables rtab ON rtab.object_id = fk.referenced_object_id
        JOIN sys.schemas rsch ON rsch.schema_id = rtab.schema_id
        JOIN sys.columns rcol
          ON rcol.object_id = fkc.referenced_object_id AND rcol.column_id = fkc.referenced_column_id
        WHERE sch.name = ?${filterByTable ? ' AND tab.name = ?' : ''}
        ORDER BY fk.name, fkc.constraint_column_id`;
  }

  private _mapRelationRows(resp: any) {
    return this._rows(resp).map((r) => ({
      ...r,
      ur: this._mapReferentialAction(r.ur),
      dr: this._mapReferentialAction(r.dr),
    }));
  }

  async relationList(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(this._relationListSql(true), [
        this._schema(args),
        args.tn,
      ]);
      result.data.list = this._mapRelationRows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async relationListAll(args: any = {}) {
    const _func = this.relationListAll.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(this._relationListSql(false), [
        this._schema(args),
      ]);
      result.data.list = this._mapRelationRows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async viewList(args: any = {}) {
    const _func = this.viewList.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT TABLE_NAME AS view_name, TABLE_NAME AS tn, TABLE_SCHEMA AS ts
           FROM INFORMATION_SCHEMA.VIEWS
          WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME`,
        [this._schema(args)],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Database VIEW CRUD — NocoDB's "SQL View" feature dispatches viewCreate /
  // viewDelete (and viewUpdate / viewRead via the legacy SqlMgr). SQL Server has
  // no CREATE OR REPLACE VIEW, so updates use CREATE OR ALTER VIEW (2016 SP1+).
  // CREATE/ALTER VIEW must be the only statement in its batch, so the executed
  // statement carries no querySeparator prefix (kept only in the display SQL).
  // ---------------------------------------------------------------------------

  async viewCreate(args: any = {}) {
    const _func = this.viewCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const viewArg = `${this._schema(args)}.${args.view_name}`;
      const createSql = this.genQuery(
        `CREATE VIEW ?? AS \n${this.sanitize(args.view_definition)}`,
        [viewArg],
      );

      await this.sqlClient.raw(createSql);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + createSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() + this.genQuery(`DROP VIEW ??`, [viewArg]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async viewUpdate(args: any = {}) {
    const _func = this.viewUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const viewArg = `${this._schema(args)}.${args.view_name}`;
      const upSql = this.genQuery(
        `CREATE OR ALTER VIEW ?? AS \n${this.sanitize(args.view_definition)}`,
        [viewArg],
      );

      await this.sqlClient.raw(upSql);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(
                `CREATE OR ALTER VIEW ?? AS \n${this.sanitize(
                  args.oldViewDefination ?? '',
                )}`,
                [viewArg],
              ),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async viewDelete(args: any = {}) {
    const _func = this.viewDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const viewArg = `${this._schema(args)}.${args.view_name}`;
      const dropSql = this.genQuery(`DROP VIEW ??`, [viewArg]);

      await this.sqlClient.raw(dropSql);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + dropSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(
                `CREATE VIEW ?? AS \n${this.sanitize(
                  args.oldViewDefination ?? '',
                )}`,
                [viewArg],
              ),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async viewRead(args: any = {}) {
    const _func = this.viewRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // OBJECT_DEFINITION returns the full module text (INFORMATION_SCHEMA's
      // VIEW_DEFINITION truncates at 4000 chars).
      const resp = await this.sqlClient.raw(
        `SELECT v.TABLE_NAME AS view_name,
                OBJECT_DEFINITION(OBJECT_ID(QUOTENAME(v.TABLE_SCHEMA) + '.' + QUOTENAME(v.TABLE_NAME))) AS view_definition
           FROM INFORMATION_SCHEMA.VIEWS v
          WHERE v.TABLE_SCHEMA = ? AND v.TABLE_NAME = ?`,
        [this._schema(args), args.view_name],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async hasTable(args: any = {}) {
    const _func = this.hasTable.name;
    const result = new Result();
    try {
      const resp = await this.sqlClient.raw(
        `SELECT 1 AS exist
           FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [this._schema(args), args.tn],
      );
      result.data.value = this._rows(resp).length > 0;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async hasDatabase(args: any = {}) {
    const _func = this.hasDatabase.name;
    const result = new Result();
    try {
      const dbName = args.databaseName || args.database;
      const resp = await this.sqlClient.raw(
        `SELECT 1 AS exist FROM sys.databases WHERE name = ?`,
        [dbName],
      );
      result.data.value = this._rows(resp).length > 0;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Sequences — SQL Server has no sequence objects in NocoDB's model;
  // auto-increment is IDENTITY(1,1), declared inline by tableCreate /
  // tableUpdate. These satisfy the abstract KnexClient surface and mirror
  // MysqlClient's no-op sequence handling (clean empty Result, not an error).
  // ---------------------------------------------------------------------------

  async sequenceList(args: any = {}) {
    const _func = this.sequenceList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    result.data.list = [];
    return result;
  }

  async sequenceCreate(_args: any = {}): Promise<any> {}

  async sequenceUpdate(_args: any = {}): Promise<any> {}

  async sequenceDelete(_args: any = {}): Promise<any> {}

  // Provision a fresh database with a dedicated login/user (the "NocoDB-managed
  // database" base flow). Mirrors MysqlClient.schemaCreateWithCredentials,
  // adapted to SQL Server's server-login + database-user model: CREATE DATABASE
  // and CREATE LOGIN are server-scoped (run on `master`); CREATE USER and role
  // membership are database-scoped (run on the new database).
  async schemaCreateWithCredentials(args: any = {}) {
    const _func = this.schemaCreateWithCredentials.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      if (!args.schema) args.schema = `nc${nanoid(8)}`;
      if (!args.user) args.user = `nc${nanoid(8)}`;
      if (!args.password) args.password = nanoid(16);

      const masterClient = knex(this._tempConnectionConfig('master'));
      try {
        // EXEC() only concatenates literals/variables (not function calls), and
        // CREATE DATABASE must be alone in its batch — so build the statement
        // into a variable, then EXEC it. QUOTENAME safely brackets identifiers;
        // QUOTENAME(pwd, '''') produces a quote-escaped string literal.
        await masterClient.raw(
          `DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(?);
           IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = ?) EXEC (@sql);`,
          [args.schema, args.schema],
        );
        await masterClient.raw(
          `DECLARE @sql nvarchar(max) =
             N'CREATE LOGIN ' + QUOTENAME(?) + N' WITH PASSWORD = ' + QUOTENAME(?, '''');
           IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = ?) EXEC (@sql);`,
          [args.user, args.password, args.user],
        );
      } finally {
        await masterClient.destroy();
      }

      const dbClient = knex(this._tempConnectionConfig(args.schema));
      try {
        await dbClient.raw(
          `DECLARE @sql nvarchar(max) = N'CREATE USER ' + QUOTENAME(?) + N' FOR LOGIN ' + QUOTENAME(?);
           IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = ?) EXEC (@sql);`,
          [args.user, args.user, args.user],
        );
        // db_owner gives the user full create/alter/drop control over its DB,
        // matching the broad grant the MySQL client issues.
        await dbClient.raw(
          `DECLARE @sql nvarchar(max) = N'ALTER ROLE db_owner ADD MEMBER ' + QUOTENAME(?);
           EXEC (@sql);`,
          [args.user],
        );
      } finally {
        await dbClient.destroy();
      }

      result.data.object = args;
    } catch (e) {
      log.ppe(e, _func);
      result.code = -1;
      result.message = e.message;
      result.object = e;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // DDL (Phase 4) — create / alter / drop tables & columns.
  //   Relations (FK) and indexes reuse the dialect-agnostic KnexClient base
  //   methods (relationCreate / relationDelete / indexCreate / indexDelete),
  //   which emit valid T-SQL through knex's mssql schema builder.
  // ---------------------------------------------------------------------------

  // Full DDL target: `schema.table`. genQuery `??` wraps each part →
  // [schema].[table]. Schema defaults to `dbo`.
  private _tnArg(args: any): string {
    return `${this._schema(args)}.${args.tn}`;
  }

  // Constraint / index names must be valid sysname (<=128 chars) and contain no
  // `.` (which knex `??` would split) — collapse anything else to `_`.
  private _safeName(...parts: string[]): string {
    return parts
      .join('_')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 128);
  }

  // Render an MSSQL column type with correct length / precision-scale. Unlike
  // MySQL, SQL Server rejects a length on non-length types (e.g. `int(10)`), so
  // only the string-length and numeric types receive a size suffix.
  private _genColumnType(col: any): string {
    const dt = String(col.dt || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z_][a-z0-9_ ]*$/.test(dt)) {
      throw new Error(`Invalid data type: ${col.dt}`);
    }

    const lengthTypes = [
      'char',
      'varchar',
      'nchar',
      'nvarchar',
      'binary',
      'varbinary',
    ];
    const precisionScaleTypes = ['decimal', 'numeric'];

    if (lengthTypes.includes(dt)) {
      const raw = `${col.dtxp ?? ''}`.trim().toLowerCase();
      let len: string;
      if (raw === 'max' || raw === '-1') {
        len = 'max';
      } else {
        const n = parseInt(raw, 10);
        len = Number.isFinite(n) && n > 0 ? String(n) : '255';
      }
      return `${dt}(${len})`;
    }

    if (precisionScaleTypes.includes(dt)) {
      const p = parseInt(col.dtxp, 10);
      const s = parseInt(col.dtxs, 10);
      const prec = Number.isFinite(p) && p > 0 ? p : 18;
      const scale = Number.isFinite(s) && s >= 0 ? s : 0;
      return `${dt}(${prec},${scale})`;
    }

    return dt;
  }

  // Inline column definition for CREATE TABLE / ADD COLUMN:
  //   [cn] <type>[ IDENTITY(1,1)] NULL|NOT NULL[ DEFAULT v][ UNIQUE]
  private _columnDefinition(col: any): string {
    let def = this.genQuery('??', [col.cn]);

    def += ` ${this._genColumnType(col)}`;
    // IDENTITY is only valid on the integer family (guarded by MssqlUi).
    if (col.ai) def += ' IDENTITY(1,1)';

    def += col.rqd ? ' NOT NULL' : ' NULL';

    if (!col.ai) {
      const defaultValue = this.sanitiseDefaultValue(col.cdf);
      if (defaultValue !== undefined && defaultValue !== '') {
        def += ` DEFAULT ${defaultValue}`;
      }
    }

    // Inline UNIQUE creates an auto-named constraint; the drop paths resolve the
    // actual name from sys.* so the generated name need not be predictable.
    if (col.unique && !col.pk) def += ' UNIQUE';

    return def;
  }

  createTable(args: any) {
    const columns = (args.columns || []).filter((c: any) => c.altered !== 4);

    const defs = columns.map((c: any) => this._columnDefinition(c));

    const pkCols = columns.filter((c: any) => c.pk).map((c: any) => c.cn);
    if (pkCols.length) {
      defs.push(
        this.genQuery(`CONSTRAINT ?? PRIMARY KEY (??)`, [
          this._safeName('PK', args.tn),
          pkCols,
        ]),
      );
    }

    return this.genQuery(
      `CREATE TABLE ?? (${this.sanitize(defs.join(', '))})`,
      [this._tnArg(args)],
    );
  }

  async tableCreate(args: any) {
    const _func = this.tableCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;
      args.sqlClient = this.sqlClient;

      const upQuery = this.querySeparator() + this.createTable(args);
      await this.sqlClient.raw(upQuery);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(this._tnArg(args)).toString();

      this.emit(`Success : ${upQuery}`);

      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async tableDelete(args: any) {
    const _func = this.tableDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.sqlClient = this.sqlClient;
      const tnArg = this._tnArg(args);

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(tnArg).toString();

      // Best-effort down statement: recreate the table from its current columns
      // (FKs / indexes are restored by the relation / index services on undo —
      // matching the display-only down behaviour of the pg / mysql clients).
      let downQuery = '';
      try {
        const cols = await this.columnList(args);
        downQuery = this.createTable({ ...args, columns: cols.data.list });
      } catch (e) {
        log.api(`${_func}: could not build down statement: ${e.message}`);
      }

      await this.sqlClient.raw(
        this.sqlClient.schema.dropTable(tnArg).toQuery(),
      );

      this.emit(`Success : ${upStatement}`);

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: this.querySeparator() + downQuery }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   * @param {Object} args
   * @param {Object[]} args.columns - new column set with `altered` bitmask
   *   (1 = added, 2/8 = edited, 4 = dropped)
   * @param {Object[]} args.originalColumns - pre-change column set
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableUpdate(args: any) {
    const _func = this.tableUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;
      args.sqlClient = this.sqlClient;

      const schema = this._schema(args);
      const tnArg = this._tnArg(args);
      const tn = args.tn;
      const originalColumns = args.originalColumns || [];

      const upStatements: string[] = [];
      const downStatements: string[] = [];

      for (const column of args.columns || []) {
        const oldColumn = find(originalColumns, { cn: column.cno });

        if (column.altered & 4) {
          // ---- DROP COLUMN (drop bound default / unique constraints first) ----
          const dfName = await this._findDefaultConstraintName(
            schema,
            tn,
            column.cn,
          );
          if (dfName) {
            upStatements.push(
              this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
                tnArg,
                dfName,
              ]),
            );
          }
          const uqName = await this._findUniqueConstraintName(
            schema,
            tn,
            column.cn,
          );
          if (uqName) {
            upStatements.push(
              this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
                tnArg,
                uqName,
              ]),
            );
          }
          upStatements.push(
            this.genQuery(`ALTER TABLE ?? DROP COLUMN ??`, [tnArg, column.cn]),
          );
          downStatements.push(this._addColumnStatement(tnArg, column));
        } else if (column.altered & 1) {
          // ---- ADD COLUMN ----
          upStatements.push(this._addColumnStatement(tnArg, column));
          downStatements.push(
            this.genQuery(`ALTER TABLE ?? DROP COLUMN ??`, [tnArg, column.cn]),
          );
        } else if (column.altered & 2 || column.altered & 8) {
          // ---- CHANGE COLUMN ----
          const { up, down } = await this._changeColumnStatements(
            schema,
            tnArg,
            tn,
            column,
            oldColumn,
          );
          upStatements.push(...up);
          downStatements.push(...down);
        }
      }

      // ---- PRIMARY KEY changes ----
      const pk = await this._pkChangeStatements(
        schema,
        tnArg,
        tn,
        args.columns || [],
        originalColumns,
      );
      upStatements.push(...pk.up);
      downStatements.push(...pk.down);

      // Execute each statement individually — SQL Server cannot combine
      // ALTER COLUMN with ADD / DROP / sp_rename in one ALTER TABLE, and
      // sp_rename must commit before later statements reference the new name.
      for (const stmt of upStatements) {
        if (stmt && stmt.trim()) await this.sqlClient.raw(stmt);
      }

      result.data.object = {
        upStatement: upStatements
          .filter((s) => s && s.trim())
          .map((sql) => ({ sql: this.querySeparator() + sql })),
        downStatement: downStatements
          .filter((s) => s && s.trim())
          .map((sql) => ({ sql: this.querySeparator() + sql })),
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  private _addColumnStatement(tnArg: string, column: any): string {
    return this.genQuery(
      `ALTER TABLE ?? ADD ${this.sanitize(this._columnDefinition(column))}`,
      [tnArg],
    );
  }

  // Statements for editing an existing column. SQL Server requires bound
  // default constraints to be dropped before the column type / nullability can
  // change, and renames go through sp_rename (string args, not identifiers).
  private async _changeColumnStatements(
    schema: string,
    tnArg: string,
    tn: string,
    n: any,
    o: any,
  ): Promise<{ up: string[]; down: string[] }> {
    const up: string[] = [];
    const down: string[] = [];

    const oldName = (o && (o.cno || o.cn)) || n.cno || n.cn;
    const newName = n.cn || oldName;
    if (!newName) {
      throw new Error('Column name is required for column update operations');
    }
    n.cn = newName;

    // 1) Rename via sp_rename ('schema.table.col' as a string, new name only).
    if (oldName && newName && oldName !== newName) {
      up.push(
        this.genQuery(`EXEC sp_rename ?, ?, 'COLUMN'`, [
          `${schema}.${tn}.${oldName}`,
          newName,
        ]),
      );
      down.push(
        this.genQuery(`EXEC sp_rename ?, ?, 'COLUMN'`, [
          `${schema}.${tn}.${newName}`,
          oldName,
        ]),
      );
    }

    const typeChanged =
      !!o && this._genColumnType(n) !== this._genColumnType(o);
    const nullChanged = !!o && !!n.rqd !== !!o.rqd;
    const defChanged = !o || n.cdf !== o.cdf;

    if (typeChanged || nullChanged) {
      // 2) Type / nullability change → drop default, ALTER COLUMN, re-add default.
      const dfName = await this._findDefaultConstraintName(schema, tn, newName);
      if (dfName) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, dfName]),
        );
      }
      up.push(
        this.genQuery(
          `ALTER TABLE ?? ALTER COLUMN ?? ${this._genColumnType(n)} ${
            n.rqd ? 'NOT NULL' : 'NULL'
          }`,
          [tnArg, newName],
        ),
      );
      if (o) {
        down.push(
          this.genQuery(
            `ALTER TABLE ?? ALTER COLUMN ?? ${this._genColumnType(o)} ${
              o.rqd ? 'NOT NULL' : 'NULL'
            }`,
            [tnArg, oldName],
          ),
        );
      }
      this._pushAddDefault(up, tnArg, tn, newName, n.cdf);
    } else if (defChanged) {
      // 3) Only the default changed → drop + re-add the default constraint.
      const dfName = await this._findDefaultConstraintName(schema, tn, newName);
      if (dfName) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, dfName]),
        );
      }
      this._pushAddDefault(up, tnArg, tn, newName, n.cdf);
    }

    // 4) Unique constraint add / drop.
    const nUnique = !!n.unique;
    const oUnique = !!(o && o.unique);
    if (nUnique !== oUnique) {
      if (nUnique) {
        up.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
            tnArg,
            this._safeName('UQ', tn, newName),
            newName,
          ]),
        );
      } else {
        const uqName = await this._findUniqueConstraintName(
          schema,
          tn,
          newName,
        );
        if (uqName) {
          up.push(
            this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, uqName]),
          );
        }
      }
    }

    return { up, down };
  }

  private _pushAddDefault(
    statements: string[],
    tnArg: string,
    tn: string,
    cn: string,
    cdf: any,
  ) {
    const defaultValue = this.sanitiseDefaultValue(cdf);
    if (defaultValue === undefined || defaultValue === '') return;
    statements.push(
      this.genQuery(
        `ALTER TABLE ?? ADD CONSTRAINT ?? DEFAULT ${this.sanitize(
          defaultValue,
        )} FOR ??`,
        [tnArg, this._safeName('DF', tn, cn), cn],
      ),
    );
  }

  private async _pkChangeStatements(
    schema: string,
    tnArg: string,
    tn: string,
    newColumns: any[],
    originalColumns: any[],
  ): Promise<{ up: string[]; down: string[] }> {
    const up: string[] = [];
    const down: string[] = [];

    const newPk = newColumns
      .filter((c) => c.pk && c.altered !== 4)
      .map((c) => c.cn);
    const oldPk = (originalColumns || []).filter((c) => c.pk).map((c) => c.cn);

    const changed =
      newPk.length !== oldPk.length || newPk.some((c, i) => c !== oldPk[i]);
    if (!changed) return { up, down };

    if (oldPk.length) {
      const pkName = await this._findPkConstraintName(schema, tn);
      if (pkName) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, pkName]),
        );
        down.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? PRIMARY KEY (??)`, [
            tnArg,
            this._safeName('PK', tn),
            oldPk,
          ]),
        );
      }
    }
    if (newPk.length) {
      up.push(
        this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? PRIMARY KEY (??)`, [
          tnArg,
          this._safeName('PK', tn),
          newPk,
        ]),
      );
      down.push(
        this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
          tnArg,
          this._safeName('PK', tn),
        ]),
      );
    }

    return { up, down };
  }

  // Resolve the auto-generated default-constraint name bound to a column.
  private async _findDefaultConstraintName(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<string | null> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT dc.name AS name
           FROM sys.default_constraints dc
           JOIN sys.columns c
             ON c.object_id = dc.parent_object_id
            AND c.column_id = dc.parent_column_id
           JOIN sys.tables t ON t.object_id = dc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE s.name = ? AND t.name = ? AND c.name = ?`,
        [schema, tn, cn],
      );
      return this._rows(resp)[0]?.name ?? null;
    } catch (e) {
      log.api('Error finding default constraint name:', e);
      return null;
    }
  }

  // Resolve a single-column UNIQUE constraint name on a column.
  private async _findUniqueConstraintName(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<string | null> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT kc.name AS name
           FROM sys.key_constraints kc
           JOIN sys.index_columns ic
             ON ic.object_id = kc.parent_object_id
            AND ic.index_id = kc.unique_index_id
           JOIN sys.columns c
             ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           JOIN sys.tables t ON t.object_id = kc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE kc.type = 'UQ' AND s.name = ? AND t.name = ? AND c.name = ?`,
        [schema, tn, cn],
      );
      return this._rows(resp)[0]?.name ?? null;
    } catch (e) {
      log.api('Error finding unique constraint name:', e);
      return null;
    }
  }

  // Resolve the PRIMARY KEY constraint name for a table.
  private async _findPkConstraintName(
    schema: string,
    tn: string,
  ): Promise<string | null> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT kc.name AS name
           FROM sys.key_constraints kc
           JOIN sys.tables t ON t.object_id = kc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE kc.type = 'PK' AND s.name = ? AND t.name = ?`,
        [schema, tn],
      );
      return this._rows(resp)[0]?.name ?? null;
    } catch (e) {
      log.api('Error finding pk constraint name:', e);
      return null;
    }
  }

  async createDatabaseIfNotExists(args: any = {}) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const tempSqlClient = knex(this._tempConnectionConfig('master'));
      try {
        // CREATE DATABASE must be alone in its batch and EXEC() can't contain a
        // function call — build the statement into a variable, then EXEC it.
        await tempSqlClient.raw(
          `DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(?);
           IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = ?) EXEC (@sql);`,
          [args.database, args.database],
        );
      } finally {
        await tempSqlClient.destroy();
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async dropDatabase(args: any = {}) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const tempSqlClient = knex(this._tempConnectionConfig('master'));
      try {
        await tempSqlClient.raw(
          `DECLARE @sql nvarchar(max) = N'ALTER DATABASE ' + QUOTENAME(?) +
             N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' + QUOTENAME(?);
           IF EXISTS (SELECT name FROM sys.databases WHERE name = ?) EXEC (@sql);`,
          [args.database, args.database, args.database],
        );
      } finally {
        await tempSqlClient.destroy();
      }
    } catch (e) {
      log.ppe(e.message, _func);
    }

    return result;
  }

  async createTableIfNotExists(args: any = {}) {
    const _func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const exists = await this.hasTable(args);
      if (!exists.data.value) {
        await this.sqlClient.raw(
          this.sqlClient.schema
            .createTable(this._tnArg(args), function (table) {
              table.increments();
              table.string('title').notNullable();
              table.string('titleDown').nullable();
              table.string('description').nullable();
              table.integer('batch').nullable();
              table.string('checksum').nullable();
              table.integer('status').nullable();
              table.dateTime('created');
              table.timestamps();
            })
            .toQuery(),
        );
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Statement generators — return display SQL (not executed).
  // ---------------------------------------------------------------------------

  async tableCreateStatement(args: any) {
    const _func = this.tableCreateStatement.name;
    let result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result = await this.columnList(args);
      result.data = this.createTable({
        tn: args.tn,
        schema: this._schema(args),
        columns: result.data.list,
      });
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async tableInsertStatement(args: any) {
    const _func = this.tableInsertStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `INSERT INTO ${this.genQuery('??', [this._tnArg(args)])} (`;
      let values = ' VALUES (';
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          const cn = response.data.list[i].cn;
          if (!i) {
            result.data += `\n[${cn}]\n\t`;
            values += `\n<${cn}>\n\t`;
          } else {
            result.data += `, [${cn}]\n\t`;
            values += `, <${cn}>\n\t`;
          }
        }
      }
      result.data += `)`;
      values += `);`;
      result.data += values;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async tableUpdateStatement(args: any) {
    const _func = this.tableUpdateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `UPDATE ${this.genQuery('??', [
        this._tnArg(args),
      ])} \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          const cn = response.data.list[i].cn;
          result.data += `${i ? ',' : ''}[${cn}] = <${cn}>\n\t`;
        }
      }
      result.data += ';';
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async tableDeleteStatement(args: any) {
    const _func = this.tableDeleteStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `DELETE FROM ${this.genQuery('??', [
        this._tnArg(args),
      ])} WHERE ;`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async tableTruncateStatement(args: any) {
    const _func = this.tableTruncateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `TRUNCATE TABLE ${this.genQuery('??', [
        this._tnArg(args),
      ])};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async tableSelectStatement(args: any) {
    const _func = this.tableSelectStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `SELECT `;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          const cn = response.data.list[i].cn;
          result.data += `${i ? ', ' : ''}[${cn}]\n\t`;
        }
      }
      result.data += ` FROM ${this.genQuery('??', [this._tnArg(args)])};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }
}

export default MssqlClient;
