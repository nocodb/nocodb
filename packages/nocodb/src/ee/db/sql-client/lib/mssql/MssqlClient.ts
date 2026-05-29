import knex from 'knex';
import { find } from 'lodash';
import { nanoid } from 'nanoid';
import { UITypes } from 'nocodb-sdk';
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

  // T-SQL has no `true`/`false` literal — Checkbox defaults arrive as those
  // strings (set by the column-create code that's PG/MySQL-friendly). Map
  // them to `1`/`0` for `bit`; everything else delegates to KnexClient.
  override sanitiseDefaultValue(value: string | number | boolean) {
    if (value === true || value === 1) return '1';
    if (value === false || value === 0) return '0';
    if (typeof value === 'string') {
      const v = value.trim();
      if (/^(true|TRUE)$/.test(v)) return '1';
      if (/^(false|FALSE)$/.test(v)) return '0';
    }
    return super.sanitiseDefaultValue(value);
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
        // `rowversion` (legacy `timestamp`) is auto-incremented by the server
        // on every row write — UPDATE rejects any explicit value. Mark it
        // so the write path can exclude it from INSERT/UPDATE payloads.
        // (`au = true` matches the semantic of "auto-updated by DB", how
        // CreatedAt/UpdatedAt are tagged on system tables.)
        const dt = (column.dt || '').toLowerCase();
        const isRowversion = dt === 'rowversion' || dt === 'timestamp';
        column.au = isRowversion || column.is_computed;
        // A NocoDB-level read-only flag isn't in the SDK column type yet;
        // until that lands, the `au` flag is the closest available signal
        // for both rowversion (auto-updated) and computed (auto-computed)
        // columns — write paths skip `au` columns from user-supplied
        // payloads, which is the correct behavior for both.
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

  // ---------------------------------------------------------------------------
  // indexCreate / indexDelete — override the dialect-agnostic base so index
  // names are deterministic and schema-scoped. knex's mssql dialect emits
  // a `${table}_${cols}_index` default that ignores the schema; when the
  // same table name lives in two schemas, the autogenerated names collide
  // at the database level (UNIQUE constraint names share a global
  // namespace in T-SQL even though non-key indexes are per-table).
  //
  // We name as `IX_<schema>_<table>_<col…>` (or `UX_…` for UNIQUE) so
  // multi-schema deployments stay collision-free and DROP INDEX can find
  // the index without guessing knex's convention.
  // ---------------------------------------------------------------------------

  async indexCreate(args: any) {
    const _func = this.indexCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const schema = this._schema(args);
      const tnArg = `${schema}.${args.tn}`;
      const unique = !args.non_unique;
      const indexName =
        args.indexName ||
        this._indexName(schema, args.tn, args.columns, unique);

      const upSql = unique
        ? this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
            tnArg,
            indexName,
            args.columns,
          ])
        : this.genQuery(`CREATE INDEX ?? ON ?? (??)`, [
            indexName,
            tnArg,
            args.columns,
          ]);

      await this.sqlClient.raw(upSql);

      const upStatement = this.querySeparator() + upSql;
      const downSql = unique
        ? this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, indexName])
        : this.genQuery(`DROP INDEX ?? ON ??`, [indexName, tnArg]);
      const downStatement = this.querySeparator() + downSql;

      this.emit(`Success : ${upStatement}`);
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async indexDelete(args: any) {
    const _func = this.indexDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const schema = this._schema(args);
      const tnArg = `${schema}.${args.tn}`;
      const wasUnique = !args.non_unique_original;
      // Resolve the actual name + kind from sys.* — unique enforcer may be a
      // UQ-type key constraint OR a standalone unique INDEX (soft-delete
      // tables); non-unique is always an index.
      let indexName: string | null = args.indexName || null;
      let uniqueKind: 'constraint' | 'index' = 'constraint';
      if (!indexName) {
        if (wasUnique) {
          const info = await this._findUniqueOnColumn(
            schema,
            args.tn,
            args.columns?.[0],
          );
          if (info) {
            indexName = info.name;
            uniqueKind = info.kind;
          }
        } else {
          const found = await this._findIndexesOnColumn(
            schema,
            args.tn,
            args.columns?.[0],
          );
          indexName = found[0]?.name ?? null;
        }
      }
      if (!indexName) {
        // Fallback to deterministic name — matches what indexCreate emits
        // when no explicit name was supplied.
        indexName = this._indexName(schema, args.tn, args.columns, wasUnique);
      }

      const dropSql = wasUnique
        ? uniqueKind === 'constraint'
          ? this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
              tnArg,
              indexName,
            ])
          : this.genQuery(`DROP INDEX ?? ON ??`, [indexName, tnArg])
        : this.genQuery(`DROP INDEX ?? ON ??`, [indexName, tnArg]);

      await this.sqlClient.raw(dropSql);

      const upStatement = this.querySeparator() + dropSql;
      const downSql = wasUnique
        ? uniqueKind === 'constraint'
          ? this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
              tnArg,
              indexName,
              args.columns,
            ])
          : // Can't faithfully restore a filtered partial index without the
            // filter expression; emit an unconditional unique index as the
            // closest reversible form. Down statements are best-effort.
            this.genQuery(`CREATE UNIQUE INDEX ?? ON ?? (??)`, [
              indexName,
              tnArg,
              args.columns,
            ])
        : this.genQuery(`CREATE INDEX ?? ON ?? (??)`, [
            indexName,
            tnArg,
            args.columns,
          ]);
      const downStatement = this.querySeparator() + downSql;

      this.emit(`Success : ${upStatement}`);
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // relationCreate / relationDelete — override the dialect-agnostic base
  // so the FK constraint name is deterministic (schema/table/columns
  // scoped) and so DROP resolves the *actual* name via sys.foreign_keys
  // instead of relying on knex's default-name convention (which fails for
  // FKs whose name was generated by a different code path or migration).
  // ---------------------------------------------------------------------------

  async relationCreate(args: any) {
    const _func = this.relationCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const schema = this._schema(args);
      const childArg = `${schema}.${args.childTable}`;
      const parentArg = `${args.parentSchema || schema}.${args.parentTable}`;
      const fkName =
        args.foreignKeyName ||
        this._safeName(
          'FK',
          schema,
          args.childTable,
          args.childColumn,
          args.parentTable,
        );

      let createSql = this.genQuery(
        `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??)`,
        [childArg, fkName, args.childColumn, parentArg, args.parentColumn],
      );
      if (args.onUpdate) createSql += ` ON UPDATE ${args.onUpdate}`;
      if (args.onDelete) createSql += ` ON DELETE ${args.onDelete}`;

      await this.sqlClient.raw(createSql);

      const upStatement = this.querySeparator() + createSql;
      const downStatement =
        this.querySeparator() +
        this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [childArg, fkName]);

      this.emit(`Success : ${upStatement}`);
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async relationDelete(args: any) {
    const _func = this.relationDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const schema = this._schema(args);
      const childArg = `${schema}.${args.childTable}`;

      // Resolve the actual FK name from sys.* — falls back to the caller's
      // foreignKeyName, then to the deterministic _safeName so previously-
      // created FKs (whichever code path made them) drop cleanly.
      const fkName =
        (await this._findFkConstraintNameByEnds({
          childSchema: schema,
          childTable: args.childTable,
          childColumn: args.childColumn,
          parentSchema: args.parentSchema || schema,
          parentTable: args.parentTable,
          parentColumn: args.parentColumn,
        })) ||
        args.foreignKeyName ||
        this._safeName(
          'FK',
          schema,
          args.childTable,
          args.childColumn,
          args.parentTable,
        );

      const dropSql = this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
        childArg,
        fkName,
      ]);

      await this.sqlClient.raw(dropSql);

      const upStatement = this.querySeparator() + dropSql;
      const parentArg = `${args.parentSchema || schema}.${args.parentTable}`;
      let recreate = this.genQuery(
        `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??)`,
        [childArg, fkName, args.childColumn, parentArg, args.parentColumn],
      );
      if (args.onUpdate) recreate += ` ON UPDATE ${args.onUpdate}`;
      if (args.onDelete) recreate += ` ON DELETE ${args.onDelete}`;
      const downStatement = this.querySeparator() + recreate;

      this.emit(`Success : ${upStatement}`);
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
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

  // ---------------------------------------------------------------------------
  // totalRecords / constraintList / schemaCreate / schemaDelete — match the
  // PG/MySQL surface so callers (utils.service, EE multi-schema helpers,
  // constraint-listing UI) work uniformly across dialects.
  // ---------------------------------------------------------------------------

  // Fast approximate row count across the current database — same intent as
  // PG's pg_stat_user_tables sum. sys.dm_db_partition_stats reads from the
  // metadata pages without scanning, and excludes index-only partitions via
  // index_id IN (0,1) (heap or clustered index).
  async totalRecords(_args: any = {}) {
    const _func = this.totalRecords.name;
    const result = new Result();
    log.api(`${_func}:args:`, _args);
    try {
      const data = await this.sqlClient.raw(
        `SELECT SUM(p.rows) AS TotalRecords
           FROM sys.dm_db_partition_stats p
           JOIN sys.tables t ON t.object_id = p.object_id
          WHERE p.index_id IN (0, 1) AND t.is_ms_shipped = 0`,
      );
      const rows = this._rows(data);
      result.data = rows[0] || { TotalRecords: 0 };
    } catch (e) {
      result.code = -1;
      result.message = (e as Error).message;
      log.ppe(e, _func);
    }
    return result;
  }

  // PK / UQ / FK constraints for a table — mirrors the PG `constraintList`
  // shape so the constraint-listing UI receives the same fields regardless
  // of dialect.
  async constraintList(args: any = {}) {
    const _func = this.constraintList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT
            kc.name AS cstn,
            CASE kc.type WHEN 'PK' THEN 'PRIMARY KEY' WHEN 'UQ' THEN 'UNIQUE' END AS cst,
            col.name AS cn,
            ic.key_ordinal AS attnum,
            sch.name AS [schema],
            tab.name AS [table]
          FROM sys.key_constraints kc
          JOIN sys.tables tab ON tab.object_id = kc.parent_object_id
          JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
          JOIN sys.index_columns ic
            ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
          JOIN sys.columns col
            ON col.object_id = ic.object_id AND col.column_id = ic.column_id
          WHERE sch.name = ? AND tab.name = ?
          UNION ALL
          SELECT
            fk.name AS cstn,
            'FOREIGN KEY' AS cst,
            col.name AS cn,
            fkc.constraint_column_id AS attnum,
            sch.name AS [schema],
            tab.name AS [table]
          FROM sys.foreign_keys fk
          JOIN sys.tables tab ON tab.object_id = fk.parent_object_id
          JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
          JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
          JOIN sys.columns col
            ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id
          WHERE sch.name = ? AND tab.name = ?
          ORDER BY cstn, attnum`,
        [this._schema(args), args.tn, this._schema(args), args.tn],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // CREATE SCHEMA / DROP SCHEMA — used by EE multi-schema flows. Both
  // statements must run alone in their batch, which `raw()` satisfies.
  async schemaCreate(args: any = {}) {
    const _func = this.schemaCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const schemaName = args.schema_name || args.database_name;
      const upSql = this.genQuery(`CREATE SCHEMA ??`, [schemaName]);
      await this.sqlClient.raw(upSql);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(`DROP SCHEMA ??`, [schemaName]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async schemaDelete(args: any = {}) {
    const _func = this.schemaDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const schemaName = args.schema_name || args.database_name;
      const upSql = this.genQuery(`DROP SCHEMA ??`, [schemaName]);
      await this.sqlClient.raw(upSql);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(`CREATE SCHEMA ??`, [schemaName]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Trigger CRUD — mirrors MySQL surface (trigger_name / event / timing /
  // statement) so the trigger UI works against MSSQL the same way.
  //
  // T-SQL specifics:
  //   - CREATE / ALTER / DROP TRIGGER must each be alone in its batch — every
  //     statement goes through its own raw() call.
  //   - DML triggers use FOR/AFTER/INSTEAD OF INSERT|UPDATE|DELETE — there's
  //     no concept of "BEFORE" so a BEFORE-timing arg maps to INSTEAD OF.
  // ---------------------------------------------------------------------------

  // Translate the MySQL-style timing (BEFORE/AFTER) to T-SQL's
  // (INSTEAD OF/AFTER). INSTEAD OF is the closest T-SQL semantic for
  // BEFORE — runs in place of the triggering action.
  private _mssqlTriggerTiming(timing: string): string {
    const t = String(timing || '')
      .trim()
      .toUpperCase();
    if (t === 'BEFORE' || t === 'INSTEAD OF' || t === 'INSTEADOF') {
      return 'INSTEAD OF';
    }
    return 'AFTER';
  }

  async triggerList(args: any = {}) {
    const _func = this.triggerList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT
            tr.name AS trigger_name,
            tr.name AS trigger,
            sch.name AS schema_name,
            tab.name AS [table],
            CASE WHEN tr.is_disabled = 0 THEN 'enabled' ELSE 'disabled' END AS status,
            OBJECT_DEFINITION(tr.object_id) AS statement
          FROM sys.triggers tr
          JOIN sys.tables tab ON tab.object_id = tr.parent_id
          JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
          WHERE sch.name = ?${args.tn ? ' AND tab.name = ?' : ''}
          ORDER BY tr.name`,
        args.tn ? [this._schema(args), args.tn] : [this._schema(args)],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async triggerRead(args: any = {}) {
    const _func = this.triggerRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT tr.name AS trigger_name,
                OBJECT_DEFINITION(tr.object_id) AS statement
           FROM sys.triggers tr
           JOIN sys.tables tab ON tab.object_id = tr.parent_id
           JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
          WHERE sch.name = ? AND tr.name = ?`,
        [this._schema(args), args.trigger_name],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async triggerCreate(args: any = {}) {
    const _func = this.triggerCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const schema = this._schema(args);
      const trigArg = `${schema}.${args.trigger_name}`;
      const tnArg = `${schema}.${args.tn}`;
      const timing = this._mssqlTriggerTiming(args.timing);
      const createSql = this.genQuery(
        `CREATE TRIGGER ?? ON ?? ${timing} ${args.event} AS\n${this.sanitize(
          args.statement,
        )}`,
        [trigArg, tnArg],
      );
      await this.sqlClient.raw(createSql);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + createSql }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(`DROP TRIGGER ??`, [trigArg]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async triggerUpdate(args: any = {}) {
    const _func = this.triggerUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const schema = this._schema(args);
      const trigArg = `${schema}.${args.trigger_name}`;
      const tnArg = `${schema}.${args.tn}`;
      const timing = this._mssqlTriggerTiming(args.timing);
      const upSql = this.genQuery(
        `CREATE OR ALTER TRIGGER ?? ON ?? ${timing} ${
          args.event
        } AS\n${this.sanitize(args.statement)}`,
        [trigArg, tnArg],
      );
      await this.sqlClient.raw(upSql);

      const oldTiming = this._mssqlTriggerTiming(args.timing);
      const downSql = this.genQuery(
        `CREATE OR ALTER TRIGGER ?? ON ?? ${oldTiming} ${
          args.event
        } AS\n${this.sanitize(args.oldStatement || '')}`,
        [trigArg, tnArg],
      );

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upSql }],
        downStatement: [{ sql: this.querySeparator() + downSql }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async triggerDelete(args: any = {}) {
    const _func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const schema = this._schema(args);
      const trigArg = `${schema}.${args.trigger_name}`;
      const tnArg = `${schema}.${args.tn}`;
      const dropSql = this.genQuery(`DROP TRIGGER ??`, [trigArg]);
      await this.sqlClient.raw(dropSql);

      const timing = this._mssqlTriggerTiming(args.timing);
      const recreate = this.genQuery(
        `CREATE TRIGGER ?? ON ?? ${timing} ${args.event} AS\n${this.sanitize(
          args.oldStatement || args.statement || '',
        )}`,
        [trigArg, tnArg],
      );

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + dropSql }],
        downStatement: [{ sql: this.querySeparator() + recreate }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Function CRUD — user-defined functions. T-SQL distinguishes scalar (FN),
  // inline TVF (IF), and table-valued (TF). We list all three via type IN.
  // Callers pass the full CREATE FUNCTION script in args.create_function;
  // we run it as-is (must be alone in its batch).
  // ---------------------------------------------------------------------------

  async functionList(args: any = {}) {
    const _func = this.functionList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT o.name AS function_name,
                o.name AS name,
                CASE o.type
                  WHEN 'FN' THEN 'SCALAR'
                  WHEN 'IF' THEN 'INLINE_TVF'
                  WHEN 'TF' THEN 'TABLE_VALUED'
                  WHEN 'AF' THEN 'AGGREGATE'
                END AS type,
                o.create_date AS created,
                o.modify_date AS modified,
                sch.name AS schema_name
           FROM sys.objects o
           JOIN sys.schemas sch ON sch.schema_id = o.schema_id
          WHERE sch.name = ? AND o.type IN ('FN','IF','TF','AF')
          ORDER BY o.name`,
        [this._schema(args)],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async functionRead(args: any = {}) {
    const _func = this.functionRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT o.name AS function_name,
                OBJECT_DEFINITION(o.object_id) AS create_function
           FROM sys.objects o
           JOIN sys.schemas sch ON sch.schema_id = o.schema_id
          WHERE sch.name = ? AND o.name = ? AND o.type IN ('FN','IF','TF','AF')`,
        [this._schema(args), args.function_name],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async functionCreate(args: any = {}) {
    const _func = this.functionCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.sqlClient.raw(args.create_function);
      const fnArg = `${this._schema(args)}.${args.function_name}`;
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + args.create_function }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(`DROP FUNCTION ??`, [fnArg]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async functionUpdate(args: any = {}) {
    const _func = this.functionUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // T-SQL's CREATE FUNCTION fails if the function already exists, and
      // the caller's contract (matching MySQL) is a plain CREATE FUNCTION
      // script — not CREATE OR ALTER. DROP IF EXISTS first, then CREATE.
      // Each statement is its own batch (raw() call) since CREATE FUNCTION
      // must be alone in its batch.
      const fnArg = `${this._schema(args)}.${args.function_name}`;
      const dropSql = this.genQuery(`DROP FUNCTION IF EXISTS ??`, [fnArg]);
      await this.sqlClient.raw(dropSql);
      await this.sqlClient.raw(args.create_function);

      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + dropSql },
          { sql: this.querySeparator() + args.create_function },
        ],
        downStatement: [
          { sql: this.querySeparator() + dropSql },
          {
            sql: this.querySeparator() + (args.oldCreateFunction || ''),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async functionDelete(args: any = {}) {
    const _func = this.functionDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const fnArg = `${this._schema(args)}.${args.function_name}`;
      const dropSql = this.genQuery(`DROP FUNCTION ??`, [fnArg]);
      await this.sqlClient.raw(dropSql);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + dropSql }],
        downStatement: [
          { sql: this.querySeparator() + (args.create_function || '') },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Procedure CRUD — stored procedures (sys.objects.type = 'P'). Same shape
  // as functionCRUD; callers pass the full CREATE PROCEDURE script in
  // args.create_procedure.
  // ---------------------------------------------------------------------------

  async procedureList(args: any = {}) {
    const _func = this.procedureList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT o.name AS procedure_name,
                o.name AS name,
                'PROCEDURE' AS type,
                o.create_date AS created,
                o.modify_date AS modified,
                sch.name AS schema_name
           FROM sys.objects o
           JOIN sys.schemas sch ON sch.schema_id = o.schema_id
          WHERE sch.name = ? AND o.type = 'P'
          ORDER BY o.name`,
        [this._schema(args)],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async procedureRead(args: any = {}) {
    const _func = this.procedureRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const resp = await this.sqlClient.raw(
        `SELECT o.name AS procedure_name,
                OBJECT_DEFINITION(o.object_id) AS create_procedure
           FROM sys.objects o
           JOIN sys.schemas sch ON sch.schema_id = o.schema_id
          WHERE sch.name = ? AND o.name = ? AND o.type = 'P'`,
        [this._schema(args), args.procedure_name],
      );
      result.data.list = this._rows(resp);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async procedureCreate(args: any = {}) {
    const _func = this.procedureCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.sqlClient.raw(args.create_procedure);
      const prArg = `${this._schema(args)}.${args.procedure_name}`;
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + args.create_procedure }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(`DROP PROCEDURE ??`, [prArg]),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async procedureUpdate(args: any = {}) {
    const _func = this.procedureUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // Same as functionUpdate — CREATE PROCEDURE fails if procedure exists.
      // DROP IF EXISTS then CREATE; each its own batch (raw() call).
      const prArg = `${this._schema(args)}.${args.procedure_name}`;
      const dropSql = this.genQuery(`DROP PROCEDURE IF EXISTS ??`, [prArg]);
      await this.sqlClient.raw(dropSql);
      await this.sqlClient.raw(args.create_procedure);
      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + dropSql },
          { sql: this.querySeparator() + args.create_procedure },
        ],
        downStatement: [
          { sql: this.querySeparator() + dropSql },
          {
            sql: this.querySeparator() + (args.oldCreateProcedure || ''),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async procedureDelete(args: any = {}) {
    const _func = this.procedureDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const prArg = `${this._schema(args)}.${args.procedure_name}`;
      const dropSql = this.genQuery(`DROP PROCEDURE ??`, [prArg]);
      await this.sqlClient.raw(dropSql);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + dropSql }],
        downStatement: [
          { sql: this.querySeparator() + (args.create_procedure || '') },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

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
  // only the relevant families receive a size suffix:
  //   - string / binary (char / varchar / nchar / nvarchar / binary / varbinary)
  //     take a length, with `max` for large-value (NVARCHAR(MAX)) variants.
  //   - decimal / numeric take (precision, scale).
  //   - datetime2 / time / datetimeoffset take a single sub-second precision
  //     (0-7). Omit to inherit the T-SQL default of 7 — we only emit when
  //     dtxp is explicitly set so existing tables don't get a forced default.
  //   - float takes (mantissa-bits). 24 = single-precision (real), 53 =
  //     double. Most users want 53; omit when dtxp not set.
  //   - text / ntext / image are deprecated large-value types — they take
  //     no length suffix (their storage is fixed).
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
    const subSecondTypes = ['datetime2', 'time', 'datetimeoffset'];

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

    if (subSecondTypes.includes(dt)) {
      const p = parseInt(col.dtxp, 10);
      if (Number.isFinite(p) && p >= 0 && p <= 7) {
        return `${dt}(${p})`;
      }
      return dt;
    }

    if (dt === 'float') {
      const p = parseInt(col.dtxp, 10);
      if (Number.isFinite(p) && p >= 1 && p <= 53) {
        return `${dt}(${p})`;
      }
      return dt;
    }

    return dt;
  }

  // Inline column definition for CREATE TABLE / ADD COLUMN:
  //   [cn] <type>[ IDENTITY(1,1)] NULL|NOT NULL[ DEFAULT v][ UNIQUE]
  //
  // When `softDeleteColumnName` is supplied the inline UNIQUE is suppressed —
  // the caller emits a soft-delete-filtered unique INDEX separately so trash
  // rows don't block the constraint. Mirrors pg's partial-unique behavior.
  private _columnDefinition(col: any, softDeleteColumnName?: string): string {
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
    // Skipped when soft-delete is present — caller emits a filtered index.
    if (col.unique && !col.pk && !softDeleteColumnName) def += ' UNIQUE';

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
   * Rename a table — schema-qualified. The KnexClient base passes only the
   * bare table name, which on MSSQL emits `sp_rename '[dbo].[old]', 'new'`
   * regardless of the actual schema. We pass `schema.old` so non-`dbo`
   * sources work.
   *
   * @param {Object} args
   * @param {String} args.tn — new table name
   * @param {String} args.tn_old — old table name
   * @param {String} [args.schema] — schema (defaults to dbo)
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableRename(args: any) {
    const _func = this.tableRename.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const schema = this._schema(args);
      // sp_rename accepts `schema.table` for the source; the target is the
      // new bare name (no schema — sp_rename can't move across schemas).
      const renameSql = this.genQuery(`EXEC sp_rename ?, ?`, [
        `${schema}.${args.tn_old}`,
        args.tn,
      ]);
      const undoSql = this.genQuery(`EXEC sp_rename ?, ?`, [
        `${schema}.${args.tn}`,
        args.tn_old,
      ]);

      await this.sqlClient.raw(renameSql);

      const upStatement = this.querySeparator() + renameSql;
      this.emit(`Success : ${upStatement}`);

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: this.querySeparator() + undoSql }],
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

      // Soft-delete-aware unique enforcement: when the table carries a
      // `__nc_deleted` column, single-column UNIQUE is enforced via a
      // filtered partial index so trash rows holding the value don't block
      // the constraint. Mirrors pg's tableUpdate softDeleteColumnName branch.
      const deletedCol = (args.columns || []).find(
        (c: any) => c.uidt === UITypes.Deleted,
      );
      const softDeleteColumnName: string | undefined =
        deletedCol?.cn || deletedCol?.column_name || undefined;

      for (const column of args.columns || []) {
        const oldColumn = find(originalColumns, { cn: column.cno });

        if (column.altered & 4) {
          // ---- DROP COLUMN ----
          // T-SQL refuses DROP COLUMN while ANY of the following reference
          // the column: default / UNIQUE / CHECK constraint, FK in either
          // direction, or non-key index. Drop them in dependency-safe order
          // (incoming FKs first), then DROP COLUMN.
          const incomingFks = await this._findIncomingFks(
            schema,
            tn,
            column.cn,
          );
          for (const fk of incomingFks) {
            const childArg = `${fk.childSchema}.${fk.childTable}`;
            upStatements.push(
              this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
                childArg,
                fk.name,
              ]),
            );
          }
          const outgoingFks = await this._findOutgoingFks(
            schema,
            tn,
            column.cn,
          );
          for (const fk of outgoingFks) {
            upStatements.push(
              this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
                tnArg,
                fk.name,
              ]),
            );
          }
          const checks = await this._findCheckConstraints(
            schema,
            tn,
            column.cn,
          );
          for (const ck of checks) {
            upStatements.push(
              this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
                tnArg,
                ck.name,
              ]),
            );
          }
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
          // Unique enforcer may be a UQ-type key constraint OR a filtered
          // unique INDEX (soft-delete tables). Resolve both and emit the
          // matching DROP so T-SQL doesn't refuse DROP COLUMN.
          const uqInfo = await this._findUniqueOnColumn(
            schema,
            tn,
            column.cn,
          );
          if (uqInfo) {
            upStatements.push(this._dropUniqueStmt(tnArg, uqInfo));
          }
          const nonKeyIndexes = await this._findIndexesOnColumn(
            schema,
            tn,
            column.cn,
          );
          for (const idx of nonKeyIndexes) {
            upStatements.push(
              this.genQuery(`DROP INDEX ?? ON ??`, [idx.name, tnArg]),
            );
          }
          upStatements.push(
            this.genQuery(`ALTER TABLE ?? DROP COLUMN ??`, [tnArg, column.cn]),
          );
          downStatements.push(this._addColumnStatement(tnArg, column));
        } else if (column.altered & 1) {
          // ---- ADD COLUMN ----
          // `_addColumnStatement` honors softDeleteColumnName — inline UNIQUE
          // is suppressed when present; emit the filtered unique INDEX as a
          // follow-up statement so trash rows don't block the constraint.
          upStatements.push(
            this._addColumnStatement(tnArg, column, softDeleteColumnName),
          );
          if (column.unique && !column.pk && softDeleteColumnName) {
            upStatements.push(
              this._createFilteredUniqueIndexStmt(
                tnArg,
                tn,
                column.cn,
                softDeleteColumnName,
              ),
            );
          }
          downStatements.push(
            this.genQuery(`ALTER TABLE ?? DROP COLUMN ??`, [tnArg, column.cn]),
          );

          // T-SQL quirk: `ALTER TABLE … ADD col TYPE NULL DEFAULT v` is a
          // metadata-only operation — existing rows keep NULL and only
          // future inserts pick up the default. pg/mysql/sqlite backfill
          // existing rows automatically. NOT NULL ADDs implicitly backfill
          // (they have to, otherwise NULL would violate the constraint),
          // and IDENTITY columns can't carry an explicit value, so this
          // only applies to nullable, non-identity, non-empty defaults.
          if (!column.ai && !column.rqd) {
            const backfillDefault = this.sanitiseDefaultValue(column.cdf);
            if (backfillDefault !== undefined && backfillDefault !== '') {
              upStatements.push(
                this.genQuery(
                  `UPDATE ?? SET ?? = ${this.sanitize(
                    backfillDefault,
                  )} WHERE ?? IS NULL`,
                  [tnArg, column.cn, column.cn],
                ),
              );
            }
          }
        } else if (column.altered & 2 || column.altered & 8) {
          // ---- CHANGE COLUMN ----
          const { up, down } = await this._changeColumnStatements(
            schema,
            tnArg,
            tn,
            column,
            oldColumn,
            softDeleteColumnName,
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

  private _addColumnStatement(
    tnArg: string,
    column: any,
    softDeleteColumnName?: string,
  ): string {
    return this.genQuery(
      `ALTER TABLE ?? ADD ${this.sanitize(
        this._columnDefinition(column, softDeleteColumnName),
      )}`,
      [tnArg],
    );
  }

  // String-type column? Length and (var)char/(n)text variants need an
  // explicit COLLATE clause on ALTER so widening/narrowing across mixed
  // collations preserves comparison and sort semantics.
  private _isStringDataType(dt: string): boolean {
    const t = String(dt || '')
      .trim()
      .toLowerCase();
    return ['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext'].includes(
      t,
    );
  }

  // Statements for editing an existing column.
  //
  // T-SQL refuses ALTER COLUMN while the column is referenced by a bound
  // default, UNIQUE constraint, CHECK constraint, foreign key (in EITHER
  // direction), or non-key index. Strategy:
  //
  //   1. Snapshot every dependent + the current collation.
  //   2. DROP them all (in the dependency-safe order: FKs first, then
  //      check / unique / default, then non-key indexes).
  //   3. Pre-backfill NULLs if this ALTER turns the column NOT NULL —
  //      T-SQL refuses the ALTER outright otherwise.
  //   4. ALTER COLUMN with explicit COLLATE for string types.
  //   5. Re-CREATE every dependent in reverse order.
  //
  // The down-statements undo each step in the symmetric order so a rollback
  // restores the original schema + constraints exactly.
  //
  // `softDeleteColumnName` (when supplied) routes single-column UNIQUE through
  // a soft-delete-filtered partial index instead of an unconditional UQ
  // constraint, mirroring pg's pattern. Composite UQs aren't filtered (matches
  // pg) — they're handled by the heavyAlter drop+re-add path.
  private async _changeColumnStatements(
    schema: string,
    tnArg: string,
    tn: string,
    n: any,
    o: any,
    softDeleteColumnName?: string,
  ): Promise<{ up: string[]; down: string[] }> {
    const up: string[] = [];
    const down: string[] = [];

    const oldName = (o && (o.cno || o.cn)) || n.cno || n.cn;
    const newName = n.cn || oldName;
    if (!newName) {
      throw new Error('Column name is required for column update operations');
    }
    n.cn = newName;

    // Computed columns are read-only in T-SQL — ALTER COLUMN is rejected
    // outright. We can't transparently DROP+ADD because the new column
    // would lose all FK / index ties to itself. Surface the limitation
    // before generating any DDL.
    if (o && o.is_computed) {
      throw new Error(
        `Cannot alter computed column "${oldName}" — drop and re-add it manually with the new expression.`,
      );
    }

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
    // The column is now known as newName for every subsequent statement
    // (both inside this batch and to subsequent sys.* queries — sp_rename
    // commits before later statements run; see tableUpdate execution loop).
    const lookupName = oldName && oldName !== newName ? oldName : newName;

    const typeChanged =
      !!o && this._genColumnType(n) !== this._genColumnType(o);
    const nullChanged = !!o && !!n.rqd !== !!o.rqd;
    const defChanged = !o || n.cdf !== o.cdf;
    const nUnique = !!n.unique;
    const oUnique = !!(o && o.unique);
    const uniqueChanged = nUnique !== oUnique;
    const renamed = !!oldName && oldName !== newName;

    // Only the heavy alter path needs to unbind FK / CHECK / index
    // dependents — a default-only or unique-only change can ALTER nothing
    // and just patch the constraint set. A rename-only operation must
    // still rebuild CHECK constraints (sp_rename leaves stale text in
    // their stored definitions), but doesn't touch FKs / indexes / default
    // (those bind by object_id and survive the rename).
    const heavyAlter = typeChanged || nullChanged;

    let outgoingFks: Awaited<ReturnType<typeof this._findOutgoingFks>> = [];
    let incomingFks: Awaited<ReturnType<typeof this._findIncomingFks>> = [];
    let checks: Awaited<ReturnType<typeof this._findCheckConstraints>> = [];
    let nonKeyIndexes: Awaited<ReturnType<typeof this._findIndexesOnColumn>> =
      [];
    let uniqueConstraints: Awaited<
      ReturnType<typeof this._findUniqueConstraintsWithCols>
    > = [];
    // PK handling — if the column is part of a PK, the heavy ALTER COLUMN
    // is blocked by the PK constraint. Capture the full PK column list
    // (preserves composite-PK shape on re-add).
    let pkName: string | null = null;
    let pkCols: string[] = [];

    if (heavyAlter && o) {
      // Resolve dependents under the *current* name — they may still be
      // pre-rename when the column is also being renamed in this batch.
      outgoingFks = await this._findOutgoingFks(schema, tn, lookupName);
      incomingFks = await this._findIncomingFks(schema, tn, lookupName);
      checks = await this._findCheckConstraints(schema, tn, lookupName);
      nonKeyIndexes = await this._findIndexesOnColumn(schema, tn, lookupName);
      uniqueConstraints = await this._findUniqueConstraintsWithCols(
        schema,
        tn,
        lookupName,
      );
      if (o.pk) {
        pkName = await this._findPkConstraintName(schema, tn);
        if (pkName) {
          pkCols = await this._findPkColumns(schema, tn);
        }
      }
    } else if (renamed && o) {
      // Rename-only — CHECK constraint definitions reference oldName by
      // text and aren't auto-rewritten by sp_rename. Drop + re-add with
      // substituted definition so subsequent INSERT/UPDATE doesn't fail
      // when T-SQL re-evaluates the check.
      checks = await this._findCheckConstraints(schema, tn, lookupName);
    }

    // CHECK constraints store the raw expression text (e.g. `([col]>0)`).
    // sp_rename does NOT rewrite that text — re-adding the same definition
    // after a rename would still reference oldName and fail. Substitute the
    // bracketed-identifier form, which is what sys.check_constraints
    // normalizes to. (Bare identifiers in user-written CHECKs survive
    // normalization as `[name]` in storage, so this catches the common case.)
    const renameCheckDefinition = (def: string): string => {
      if (!oldName || oldName === newName) return def;
      return def.replace(
        new RegExp(
          `\\[${oldName.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}\\]`,
          'g',
        ),
        `[${newName}]`,
      );
    };

    // 2) Drop dependents — incoming FKs first (they reference us / the PK),
    //    then outgoing FKs / checks / unique / default, then non-key indexes,
    //    then PK last (it underpins incoming FKs, so MUST be dropped after
    //    them but BEFORE ALTER COLUMN which it blocks).
    //
    // Down-statement convention: every DOWN statement executes AFTER the
    // first down step (sp_rename newName → oldName), so they reference
    // the ORIGINAL captured names — no rebindRename in down.
    if (heavyAlter) {
      for (const fk of incomingFks) {
        const childArg = `${fk.childSchema}.${fk.childTable}`;
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [
            childArg,
            fk.name,
          ]),
        );
        // DOWN: column has been renamed back to oldName by then — fk's
        // captured parentCols already reference oldName.
        down.push(this._addIncomingFkStmt(schema, fk, tn));
      }
      for (const fk of outgoingFks) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, fk.name]),
        );
        down.push(this._addOutgoingFkStmt(tnArg, fk));
      }
    }
    // CHECK constraint drop+re-add happens for heavyAlter (the type might
    // be incompatible with the stored expression) AND for rename-only
    // (sp_rename doesn't rewrite the definition text).
    if (heavyAlter || renamed) {
      for (const ck of checks) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, ck.name]),
        );
        down.push(
          this.genQuery(
            `ALTER TABLE ?? ADD CONSTRAINT ?? CHECK ${ck.definition}`,
            [tnArg, ck.name],
          ),
        );
      }
    }

    const dfName = await this._findDefaultConstraintName(
      schema,
      tn,
      lookupName,
    );
    if (heavyAlter || defChanged) {
      if (dfName) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, dfName]),
        );
      }
    }

    // UNIQUE constraint handling:
    //   - heavyAlter on a column that's part of any UQ → drop+re-add all
    //     UQs containing it (composite UQs preserved via uniqueConstraints).
    //   - Transitioning out of unique (uniqueChanged && !nUnique) →
    //     drop the single-col UQ that backed `unique: true`.
    //   - Transitioning into unique (uniqueChanged && nUnique) →
    //     ADD a new single-col UQ after ALTER (handled in re-add section).
    let droppedExistingUq = false;
    if (heavyAlter && uniqueConstraints.length > 0) {
      for (const uq of uniqueConstraints) {
        up.push(
          this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, uq.name]),
        );
        // DOWN: re-add with captured (oldName) column list.
        down.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
            tnArg,
            uq.name,
            uq.cols,
          ]),
        );
      }
      droppedExistingUq = true;
    } else if (uniqueChanged && !nUnique && oUnique) {
      // Pure transition off unique — resolve either a UQ-type constraint
      // (legacy / non-soft-delete tables) or a standalone unique INDEX
      // (filtered partial UQ on soft-delete tables) and emit the right DROP.
      const existing = await this._findUniqueOnColumn(schema, tn, lookupName);
      if (existing) {
        up.push(this._dropUniqueStmt(tnArg, existing));
        droppedExistingUq = true;
      }
    }

    if (heavyAlter) {
      for (const idx of nonKeyIndexes) {
        up.push(this.genQuery(`DROP INDEX ?? ON ??`, [idx.name, tnArg]));
        // DOWN runs after sp_rename back — idx.cols already reference
        // the original (oldName) column names.
        down.push(this._addIndexStmt(tnArg, idx));
      }
    }

    // PK drop — must be last before ALTER COLUMN. T-SQL blocks ALTER COLUMN
    // while the column is part of a PRIMARY KEY constraint. The PK's backing
    // index disappears with it, so this also unblocks the column.
    if (heavyAlter && pkName && pkCols.length > 0) {
      up.push(
        this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, pkName]),
      );
      // DOWN: re-add with the original (oldName) column list.
      down.push(
        this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? PRIMARY KEY (??)`, [
          tnArg,
          pkName,
          pkCols,
        ]),
      );
    }

    // 3) NULL → NOT NULL transition needs a backfill, otherwise T-SQL
    //    refuses ALTER COLUMN with `Cannot insert the value NULL`. We use
    //    the new default if one is supplied; without a default we leave
    //    the ALTER to fail with the database's own error so the user sees
    //    the row-count issue rather than silently dropping NULLs.
    //
    //    Important: this UPDATE runs AFTER sp_rename has executed, so the
    //    column lives under newName at runtime — reference newName.
    if (heavyAlter && n.rqd && (!o || !o.rqd)) {
      const backfill = this.sanitiseDefaultValue(n.cdf);
      if (backfill !== undefined && backfill !== '') {
        up.push(
          this.genQuery(
            `UPDATE ?? SET ?? = ${this.sanitize(
              String(backfill),
            )} WHERE ?? IS NULL`,
            [tnArg, newName, newName],
          ),
        );
      }
    }

    // 4) ALTER COLUMN — preserve collation for string types.
    //    The column is at newName by the time this statement executes
    //    (sp_rename above commits before subsequent statements run).
    //    The DOWN ALTER reverses the type AFTER the down sp_rename has
    //    moved the column back to oldName, so it references oldName.
    if (heavyAlter) {
      const collateClause = await this._buildCollateClause(
        schema,
        tn,
        lookupName,
        n.dt,
        n.clnn ?? (o && o.clnn) ?? null,
      );
      const oldCollateClause =
        o &&
        (await this._buildCollateClause(
          schema,
          tn,
          lookupName,
          o.dt,
          o.clnn ?? null,
        ));
      up.push(
        this.genQuery(
          `ALTER TABLE ?? ALTER COLUMN ?? ${this._genColumnType(
            n,
          )}${collateClause} ${n.rqd ? 'NOT NULL' : 'NULL'}`,
          [tnArg, newName],
        ),
      );
      if (o) {
        down.push(
          this.genQuery(
            `ALTER TABLE ?? ALTER COLUMN ?? ${this._genColumnType(o)}${
              oldCollateClause || ''
            } ${o.rqd ? 'NOT NULL' : 'NULL'}`,
            [tnArg, oldName],
          ),
        );
      }
    }

    // 5) Re-create dependents in reverse-dependency order:
    //    default → composite/single UQ → non-key indexes → PK → CHECK →
    //    outgoing FKs → incoming FKs. PK must precede incoming FKs because
    //    those FKs require the PK to exist on the referenced column.
    if (heavyAlter || defChanged) {
      this._pushAddDefault(up, tnArg, tn, newName, n.cdf);
    }

    // Re-add captured composite UQ constraints (heavyAlter path) with the
    // renamed column substituted. Single-col transitions handled separately
    // below.
    if (heavyAlter && uniqueConstraints.length > 0) {
      for (const uq of uniqueConstraints) {
        up.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
            tnArg,
            uq.name,
            uq.cols.map(rebindRename),
          ]),
        );
      }
    }

    // Single-col UNIQUE transition (was-not-unique → now-unique). Doesn't
    // re-cover the heavyAlter composite case (already handled above).
    // On soft-delete-aware tables emit a filtered unique INDEX (so trash rows
    // don't block the constraint); elsewhere use an unconditional UQ
    // constraint as before.
    if (
      uniqueChanged &&
      nUnique &&
      !(heavyAlter && uniqueConstraints.length > 0)
    ) {
      if (softDeleteColumnName) {
        up.push(
          this._createFilteredUniqueIndexStmt(
            tnArg,
            tn,
            newName,
            softDeleteColumnName,
          ),
        );
      } else {
        up.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? UNIQUE (??)`, [
            tnArg,
            this._safeName('UQ', tn, newName),
            newName,
          ]),
        );
      }
    }

    if (heavyAlter) {
      for (const idx of nonKeyIndexes) {
        up.push(
          this._addIndexStmt(tnArg, {
            ...idx,
            cols: idx.cols.map(rebindRename),
          }),
        );
      }
      // PK re-add — BEFORE outgoing / incoming FK re-adds because incoming
      // FKs need a PK (or UQ) on the referenced column to validate.
      if (pkName && pkCols.length > 0) {
        up.push(
          this.genQuery(`ALTER TABLE ?? ADD CONSTRAINT ?? PRIMARY KEY (??)`, [
            tnArg,
            pkName,
            pkCols.map(rebindRename),
          ]),
        );
      }
      for (const fk of outgoingFks) {
        up.push(
          this._addOutgoingFkStmt(tnArg, {
            ...fk,
            cols: fk.cols.map(rebindRename),
          }),
        );
      }
      for (const fk of incomingFks) {
        up.push(
          this._addIncomingFkStmt(
            schema,
            { ...fk, parentCols: fk.parentCols.map(rebindRename) },
            tn,
          ),
        );
      }
    }
    // CHECK re-add runs for heavyAlter AND for rename-only — same
    // condition as the drop side above. Uses renameCheckDefinition so the
    // re-added expression references the (post-sp_rename) column name.
    if (heavyAlter || renamed) {
      for (const ck of checks) {
        up.push(
          this.genQuery(
            `ALTER TABLE ?? ADD CONSTRAINT ?? CHECK ${renameCheckDefinition(
              ck.definition,
            )}`,
            [tnArg, ck.name],
          ),
        );
      }
    }

    return { up, down };

    // Helper closure — translate captured (pre-rename) column references
    // to the new name when rebuilding constraints / indexes.
    function rebindRename(c: string): string {
      return c === oldName ? newName : c;
    }
  }

  // Build a `COLLATE <name>` suffix for ALTER COLUMN on a string type.
  // Reads the current collation from sys.* when the column carries no
  // overriding collation. Returns "" for non-string types or when the
  // database default already applies.
  private async _buildCollateClause(
    schema: string,
    tn: string,
    cn: string,
    dt: string,
    providedCollation: string | null,
  ): Promise<string> {
    if (!this._isStringDataType(dt)) return '';
    const collation =
      providedCollation || (await this._getColumnCollation(schema, tn, cn));
    if (!collation) return '';
    // collation names are valid sysname identifiers — safe-name to be sure.
    return ` COLLATE ${this._safeName(collation)}`;
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

  // Resolve a unique enforcer on a column — either a `UQ`-type key constraint
  // (unconditional UNIQUE) OR a standalone unique INDEX (which is how we
  // emit the soft-delete-aware partial unique; sys.key_constraints doesn't
  // know about filtered indexes). Returned `kind` tells the caller which
  // DROP statement to emit.
  private async _findUniqueOnColumn(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<{ name: string; kind: 'constraint' | 'index' } | null> {
    const constraintName = await this._findUniqueConstraintName(schema, tn, cn);
    if (constraintName) return { name: constraintName, kind: 'constraint' };
    try {
      // Standalone unique indexes (filtered or not) live in sys.indexes but
      // are NOT backed by a UQ-type key constraint. Restrict to single-
      // column indexes to mirror the constraint side (composite UQs are
      // handled separately via _findUniqueConstraintsWithCols).
      const resp = await this.sqlClient.raw(
        `SELECT i.name AS name
           FROM sys.indexes i
           JOIN sys.index_columns ic
             ON ic.object_id = i.object_id AND ic.index_id = i.index_id
           JOIN sys.columns c
             ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           JOIN sys.tables t ON t.object_id = i.object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE i.is_unique = 1
            AND i.is_primary_key = 0
            AND i.is_unique_constraint = 0
            AND s.name = ? AND t.name = ? AND c.name = ?
            AND (SELECT COUNT(*) FROM sys.index_columns ic2
                  WHERE ic2.object_id = i.object_id
                    AND ic2.index_id = i.index_id) = 1`,
        [schema, tn, cn],
      );
      const indexName = this._rows(resp)[0]?.name ?? null;
      return indexName ? { name: indexName, kind: 'index' } : null;
    } catch (e) {
      log.api('Error finding unique index name:', e);
      return null;
    }
  }

  // Emit the right DROP for a unique enforcer resolved by _findUniqueOnColumn.
  private _dropUniqueStmt(
    tnArg: string,
    info: { name: string; kind: 'constraint' | 'index' },
  ): string {
    return info.kind === 'constraint'
      ? this.genQuery(`ALTER TABLE ?? DROP CONSTRAINT ??`, [tnArg, info.name])
      : this.genQuery(`DROP INDEX ?? ON ??`, [info.name, tnArg]);
  }

  // Soft-delete-aware unique enforcement: a filtered unique index that
  // excludes trash rows so a soft-deleted row holding the value doesn't
  // block restoring or inserting an active row with the same value.
  // Mirrors PG's `addUniqueConstraintToQuery` filtered-partial-index branch.
  private _createFilteredUniqueIndexStmt(
    tnArg: string,
    tn: string,
    cn: string,
    softDeleteColumnName: string,
  ): string {
    // T-SQL filtered-index predicates can't use `OR` (error 156), so the
    // pg-style `(?? IS NULL OR ?? = 0)` isn't valid here. The soft-delete
    // column is a `bit DEFAULT 0`, so every active row is `0` (1 = trashed) —
    // `?? = 0` matches exactly the active rows and is a legal filtered
    // predicate.
    //
    // `AND ?? IS NOT NULL` is required for pg/sqlite parity: a standard MSSQL
    // unique index treats NULLs as equal (only ONE NULL permitted), whereas
    // pg/sqlite allow any number of NULLs. Excluding NULLs from the index
    // restores that behaviour — multiple active NULLs are allowed, non-NULL
    // values are still enforced unique. (Without this, force-restoring two
    // trash rows that both null the unique column would collide on `<NULL>`.)
    return this.genQuery(
      `CREATE UNIQUE INDEX ?? ON ?? (??) WHERE (?? = 0 AND ?? IS NOT NULL)`,
      [
        this._safeName('UQ', tn, cn),
        tnArg,
        cn,
        softDeleteColumnName,
        cn,
      ],
    );
  }

  private _dropFilteredUniqueIndexStmt(
    tnArg: string,
    tn: string,
    cn: string,
  ): string {
    return this.genQuery(`DROP INDEX ?? ON ??`, [
      this._safeName('UQ', tn, cn),
      tnArg,
    ]);
  }

  // Resolve all UNIQUE constraints that include the given column, returning
  // each with its FULL column list (in key_ordinal order). Composite UQs
  // must be dropped and re-added as a multi-column constraint — single-col
  // re-adds would silently drop the other columns from the constraint.
  private async _findUniqueConstraintsWithCols(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<Array<{ name: string; cols: string[] }>> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT kc.name AS name, col.name AS cn, ic.key_ordinal AS pos
           FROM sys.key_constraints kc
           JOIN sys.tables t ON t.object_id = kc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
           JOIN sys.index_columns ic
             ON ic.object_id = kc.parent_object_id
            AND ic.index_id = kc.unique_index_id
           JOIN sys.columns col
             ON col.object_id = ic.object_id AND col.column_id = ic.column_id
          WHERE kc.type = 'UQ' AND s.name = ? AND t.name = ?
            AND kc.unique_index_id IN (
              SELECT ic2.index_id
                FROM sys.index_columns ic2
                JOIN sys.columns c2
                  ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
               WHERE ic2.object_id = t.object_id AND c2.name = ?
            )
          ORDER BY kc.name, ic.key_ordinal`,
        [schema, tn, cn],
      );
      const rows = this._rows(resp);
      const map = new Map<string, { name: string; cols: string[] }>();
      for (const r of rows) {
        const existing = map.get(r.name);
        if (existing) {
          existing.cols.push(r.cn);
        } else {
          map.set(r.name, { name: r.name, cols: [r.cn] });
        }
      }
      return Array.from(map.values());
    } catch (e) {
      log.api('Error finding unique constraints with cols:', e);
      return [];
    }
  }

  // All PK columns of a table (in key_ordinal order). Used to preserve the
  // composite-PK shape when altering one of the PK columns — re-adding
  // PRIMARY KEY (col) instead of PRIMARY KEY (a, b) would silently
  // change the constraint.
  private async _findPkColumns(schema: string, tn: string): Promise<string[]> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT col.name AS cn
           FROM sys.key_constraints kc
           JOIN sys.tables t ON t.object_id = kc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
           JOIN sys.index_columns ic
             ON ic.object_id = kc.parent_object_id
            AND ic.index_id = kc.unique_index_id
           JOIN sys.columns col
             ON col.object_id = ic.object_id AND col.column_id = ic.column_id
          WHERE kc.type = 'PK' AND s.name = ? AND t.name = ?
          ORDER BY ic.key_ordinal`,
        [schema, tn],
      );
      return this._rows(resp).map((r: any) => r.cn);
    } catch (e) {
      log.api('Error finding PK columns:', e);
      return [];
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

  // ---------------------------------------------------------------------------
  // Dependent-object introspection — used by _changeColumnStatements,
  // DROP COLUMN, and relationDelete to discover the objects T-SQL refuses
  // to alter through (bound default / unique / check / FK / non-key index).
  // Each returns a serialisable shape so the caller can rebuild it later.
  // ---------------------------------------------------------------------------

  // FKs whose FK side IS this column ("outgoing"). One row per FK (the FK can
  // span multiple columns — we collect the full key set so the re-add path
  // emits a matching multi-column constraint).
  private async _findOutgoingFks(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<
    Array<{
      name: string;
      cols: string[];
      parentSchema: string;
      parentTable: string;
      parentCols: string[];
      onUpdate: string;
      onDelete: string;
    }>
  > {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT fk.name AS name,
                sch.name AS schema_name, tab.name AS tn,
                rsch.name AS rschema, rtab.name AS rtn,
                col.name AS cn, rcol.name AS rcn,
                fkc.constraint_column_id AS pos,
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
          WHERE sch.name = ? AND tab.name = ?
            AND fk.object_id IN (
              SELECT fkc2.constraint_object_id
                FROM sys.foreign_key_columns fkc2
                JOIN sys.columns c2
                  ON c2.object_id = fkc2.parent_object_id AND c2.column_id = fkc2.parent_column_id
               WHERE fkc2.parent_object_id = tab.object_id AND c2.name = ?
            )
          ORDER BY fk.name, fkc.constraint_column_id`,
        [schema, tn, cn],
      );
      const rows = this._rows(resp);
      const map = new Map<string, any>();
      for (const r of rows) {
        const existing = map.get(r.name);
        if (existing) {
          existing.cols.push(r.cn);
          existing.parentCols.push(r.rcn);
        } else {
          map.set(r.name, {
            name: r.name,
            cols: [r.cn],
            parentSchema: r.rschema,
            parentTable: r.rtn,
            parentCols: [r.rcn],
            onUpdate: (r.ur || 'NO_ACTION').replace(/_/g, ' '),
            onDelete: (r.dr || 'NO_ACTION').replace(/_/g, ' '),
          });
        }
      }
      return Array.from(map.values());
    } catch (e) {
      log.api('Error finding outgoing FKs on column:', e);
      return [];
    }
  }

  // FKs whose REFERENCED side IS this column ("incoming"). When a column's
  // type / nullability changes, every FK that references it has to be dropped
  // and re-added because T-SQL ties the FK to the referenced column's type.
  private async _findIncomingFks(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<
    Array<{
      name: string;
      childSchema: string;
      childTable: string;
      cols: string[];
      parentCols: string[];
      onUpdate: string;
      onDelete: string;
    }>
  > {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT fk.name AS name,
                sch.name AS schema_name, tab.name AS tn,
                rsch.name AS rschema, rtab.name AS rtn,
                col.name AS cn, rcol.name AS rcn,
                fkc.constraint_column_id AS pos,
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
          WHERE rsch.name = ? AND rtab.name = ?
            AND fk.object_id IN (
              SELECT fkc2.constraint_object_id
                FROM sys.foreign_key_columns fkc2
                JOIN sys.columns c2
                  ON c2.object_id = fkc2.referenced_object_id AND c2.column_id = fkc2.referenced_column_id
               WHERE fkc2.referenced_object_id = rtab.object_id AND c2.name = ?
            )
          ORDER BY fk.name, fkc.constraint_column_id`,
        [schema, tn, cn],
      );
      const rows = this._rows(resp);
      const map = new Map<string, any>();
      for (const r of rows) {
        const existing = map.get(r.name);
        if (existing) {
          existing.cols.push(r.cn);
          existing.parentCols.push(r.rcn);
        } else {
          map.set(r.name, {
            name: r.name,
            childSchema: r.schema_name,
            childTable: r.tn,
            cols: [r.cn],
            parentCols: [r.rcn],
            onUpdate: (r.ur || 'NO_ACTION').replace(/_/g, ' '),
            onDelete: (r.dr || 'NO_ACTION').replace(/_/g, ' '),
          });
        }
      }
      return Array.from(map.values());
    } catch (e) {
      log.api('Error finding incoming FKs on column:', e);
      return [];
    }
  }

  // CHECK constraints whose definition mentions this column. We can't run
  // DDL with a referenced column being typed out from under a CHECK — drop
  // and re-create around the ALTER.
  private async _findCheckConstraints(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<Array<{ name: string; definition: string }>> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT cc.name AS name, cc.definition AS definition
           FROM sys.check_constraints cc
           JOIN sys.tables t ON t.object_id = cc.parent_object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE s.name = ? AND t.name = ?
            AND (
              cc.parent_column_id = (
                SELECT column_id FROM sys.columns
                 WHERE object_id = t.object_id AND name = ?
              )
              OR cc.definition LIKE '%' + QUOTENAME(?) + '%'
            )`,
        [schema, tn, cn, cn],
      );
      return this._rows(resp).map((r: any) => ({
        name: r.name,
        definition: r.definition,
      }));
    } catch (e) {
      log.api('Error finding check constraints on column:', e);
      return [];
    }
  }

  // Non-PK / non-UQ indexes that include this column. The PK and UQ
  // constraints are already dropped+re-added via the constraint-specific
  // paths; here we capture stand-alone CREATE INDEX rows so they survive
  // an ALTER COLUMN that would otherwise be blocked by the index.
  private async _findIndexesOnColumn(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<
    Array<{
      name: string;
      cols: string[];
      isUnique: boolean;
      filterDefinition: string | null;
    }>
  > {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT i.name AS name,
                col.name AS cn,
                ic.key_ordinal AS pos,
                i.is_unique AS is_unique,
                i.filter_definition AS filter_def
           FROM sys.indexes i
           JOIN sys.tables t ON t.object_id = i.object_id
           JOIN sys.schemas s ON s.schema_id = t.schema_id
           JOIN sys.index_columns ic
             ON ic.object_id = i.object_id AND ic.index_id = i.index_id
           JOIN sys.columns col
             ON col.object_id = ic.object_id AND col.column_id = ic.column_id
          WHERE s.name = ? AND t.name = ?
            AND i.is_primary_key = 0
            AND i.is_unique_constraint = 0
            AND i.type > 0
            AND i.index_id IN (
              SELECT ic2.index_id
                FROM sys.index_columns ic2
                JOIN sys.columns c2
                  ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
               WHERE ic2.object_id = t.object_id AND c2.name = ?
            )
          ORDER BY i.name, ic.key_ordinal`,
        [schema, tn, cn],
      );
      const rows = this._rows(resp);
      const map = new Map<string, any>();
      for (const r of rows) {
        const existing = map.get(r.name);
        if (existing) {
          existing.cols.push(r.cn);
        } else {
          map.set(r.name, {
            name: r.name,
            cols: [r.cn],
            isUnique: r.is_unique === true || r.is_unique === 1,
            filterDefinition: r.filter_def || null,
          });
        }
      }
      return Array.from(map.values());
    } catch (e) {
      log.api('Error finding indexes on column:', e);
      return [];
    }
  }

  // Current collation of a string column. Used to preserve comparison
  // semantics across ALTER COLUMN — without an explicit COLLATE clause
  // T-SQL inherits the database default, which on mixed-collation servers
  // silently changes equality / sort order.
  private async _getColumnCollation(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<string | null> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT COLLATION_NAME AS collation_name
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [schema, tn, cn],
      );
      return this._rows(resp)[0]?.collation_name ?? null;
    } catch (e) {
      log.api('Error reading column collation:', e);
      return null;
    }
  }

  // True when the column has any NULL rows currently — gates the
  // pre-backfill required by ALTER COLUMN … NOT NULL.
  private async _columnHasNulls(
    schema: string,
    tn: string,
    cn: string,
  ): Promise<boolean> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT TOP 1 1 AS has_null
           FROM ${this.genQuery('??', [`${schema}.${tn}`])}
          WHERE ${this.genQuery('??', [cn])} IS NULL`,
      );
      return this._rows(resp).length > 0;
    } catch (e) {
      log.api('Error checking column nulls:', e);
      return false;
    }
  }

  // Resolve a specific FK constraint by its child-side and parent-side
  // (schema, table, column) tuple — used by relationDelete to avoid relying
  // on knex's default name convention, which fails for FKs created outside
  // knex or under a different name pattern.
  private async _findFkConstraintNameByEnds(args: {
    childSchema: string;
    childTable: string;
    childColumn: string;
    parentSchema: string;
    parentTable: string;
    parentColumn: string;
  }): Promise<string | null> {
    try {
      const resp = await this.sqlClient.raw(
        `SELECT fk.name AS name
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
          WHERE sch.name = ? AND tab.name = ? AND col.name = ?
            AND rsch.name = ? AND rtab.name = ? AND rcol.name = ?`,
        [
          args.childSchema,
          args.childTable,
          args.childColumn,
          args.parentSchema,
          args.parentTable,
          args.parentColumn,
        ],
      );
      return this._rows(resp)[0]?.name ?? null;
    } catch (e) {
      log.api('Error resolving FK by ends:', e);
      return null;
    }
  }

  // ADD CONSTRAINT statement for an outgoing FK — used both inside ALTER
  // COLUMN dependent rewrap and by relationDelete's down-statement.
  private _addOutgoingFkStmt(
    childTnArg: string,
    fk: {
      name: string;
      cols: string[];
      parentSchema: string;
      parentTable: string;
      parentCols: string[];
      onUpdate: string;
      onDelete: string;
    },
  ): string {
    const parentArg = `${fk.parentSchema}.${fk.parentTable}`;
    let stmt = this.genQuery(
      `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??)`,
      [childTnArg, fk.name, fk.cols, parentArg, fk.parentCols],
    );
    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
      stmt += ` ON UPDATE ${fk.onUpdate}`;
    }
    if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
      stmt += ` ON DELETE ${fk.onDelete}`;
    }
    return stmt;
  }

  // ADD CONSTRAINT statement for an incoming FK — rebuild from sys.* info.
  private _addIncomingFkStmt(
    schema: string,
    fk: {
      name: string;
      childSchema: string;
      childTable: string;
      cols: string[];
      parentCols: string[];
      onUpdate: string;
      onDelete: string;
    },
    parentTn: string,
  ): string {
    const childArg = `${fk.childSchema}.${fk.childTable}`;
    const parentArg = `${schema}.${parentTn}`;
    let stmt = this.genQuery(
      `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ?? (??)`,
      [childArg, fk.name, fk.cols, parentArg, fk.parentCols],
    );
    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
      stmt += ` ON UPDATE ${fk.onUpdate}`;
    }
    if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
      stmt += ` ON DELETE ${fk.onDelete}`;
    }
    return stmt;
  }

  // CREATE INDEX statement that re-builds a non-key index from its captured
  // sys.* shape. Filtered indexes (sparse / partial) preserve their predicate.
  private _addIndexStmt(
    tnArg: string,
    idx: {
      name: string;
      cols: string[];
      isUnique: boolean;
      filterDefinition: string | null;
    },
  ): string {
    let stmt = this.genQuery(
      `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ?? ON ?? (??)`,
      [idx.name, tnArg, idx.cols],
    );
    if (idx.filterDefinition) {
      stmt += ` WHERE ${idx.filterDefinition}`;
    }
    return stmt;
  }

  // Build an explicitly schema/table/column-scoped name for a new index so
  // simultaneous indexes across schemas don't collide on the global name
  // map. Truncated to sysname's 128-char limit; safe-char filtered.
  private _indexName(
    schema: string,
    tn: string,
    cols: string[],
    unique: boolean,
  ): string {
    const prefix = unique ? 'UX' : 'IX';
    return this._safeName(prefix, schema, tn, ...cols);
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
