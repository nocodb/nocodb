import { nanoid } from 'nanoid';
import knex from 'knex';
import isEmpty from 'lodash/isEmpty';
import mapKeys from 'lodash/mapKeys';
import find from 'lodash/find';
import { UITypes } from 'nocodb-sdk';
import KnexClient from '~/db/sql-client/lib/KnexClient';
import Debug from '~/db/util/Debug';
import Result from '~/db/util/Result';
import queries from '~/db/sql-client/lib/pg/pg.queries';
import {
  formatColumn,
  generateCastQuery,
} from '~/db/sql-client/lib/pg/typeCast';
import pgQueries from '~/db/sql-client/lib/pg/pg.queries';
import deepClone from '~/helpers/deepClone';

const log = new Debug('PGClient');

class PGClient extends KnexClient {
  constructor(connectionConfig) {
    super(connectionConfig);
    // this.sqlClient = null;
    this.queries = queries;
    this._version = {};
  }

  /**
   *
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async schemaCreateWithCredentials(args) {
    const func = this.schemaCreateWithCredentials.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      if (!args.schema) {
        args.schema = `nc${nanoid(8)}`;
      }
      if (!args.user) {
        args.user = `nc${nanoid(8)}`;
      }
      if (!args.password) {
        args.password = nanoid(16);
      }

      // const connectionParamsWithoutDb = JSON.parse(
      //   JSON.stringify(this.connectionConfig)
      // );
      //
      // delete connectionParamsWithoutDb.connection.database;
      //
      // const tempSqlClient = knex(connectionParamsWithoutDb);

      const data = await this.sqlClient.raw('create database ?', [args.schema]);

      // postgres=# create database mydb;
      // postgres=# create user myuser with encrypted password 'mypass';
      // postgres=# grant all privileges on database mydb to myuser;

      await this.sqlClient.raw(`create user ? with encrypted password ?`, [
        args.user,
        args.password,
      ]);
      await this.sqlClient.raw(`grant all privileges on database ?? to ?`, [
        args.schema,
        args.user,
      ]);

      log.debug('Create database if not exists', data);

      // create new knex client
      // this.sqlClient = knex(this.connectionConfig);
      // tempSqlClient.destroy();
      result.object = args;
    } catch (e) {
      // log.ppe(e);
      result.code = -1;
      result.message = e.message;
      result.object = e;
    }
    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param args.sequence_name
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async sequenceDelete(args: any = {}) {
    const _func = this.sequenceDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const query = `${this.querySeparator()}DROP SEQUENCE ${this.genIdentifier(
        args.sequence_name,
      )}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: `${this.querySeparator()}CREATE SEQUENCE ${this.genIdentifier(
              args.sequence_name,
            )}`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - sequences
   * @property {String} - sequences[].sequence_name
   * @property {String} - sequences[].type
   * @property {String} - sequences[].definer
   * @property {String} - sequences[].modified
   * @property {String} - sequences[].created
   * @property {String} - sequences[].security_type
   * @property {String} - sequences[].comment
   * @property {String} - sequences[].character_set_client
   * @property {String} - sequences[].collation_connection
   * @property {String} - sequences[].database collation
   */
  async sequenceList(args: any = {}) {
    const _func = this.sequenceList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;
      const { rows } = await this.raw(`select *
              from INFORMATION_SCHEMA.sequences;`);

      result.data.list = rows.map((seq) => {
        return {
          ...seq,
          original_sequence_name: seq.sequence_name,
        };
      });
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.sequence_name
   * @param {String} - args.start_value
   * @param {String} - args.min_value
   * @param {String} - args.max_value
   * @param {String} - args.increment_by
   * @returns {Object} - result
   */
  async sequenceCreate(args: any = {}) {
    const func = this.sequenceCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query =
        this.querySeparator() +
        `CREATE SEQUENCE ${this.genIdentifier(args.sequence_name)}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP SEQUENCE ${this.genIdentifier(args.sequence_name)}`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.sequence_name
   * @param {String} - args.start_value
   * @param {String} - args.min_value
   * @param {String} - args.max_value
   * @param {String} - args.increment_by
   * @returns {Object} - result
   */
  async sequenceUpdate(args: any = {}) {
    const func = this.sequenceUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const upQuery =
        this.querySeparator() +
        `ALTER SEQUENCE ${this.genIdentifier(
          args.original_sequence_name,
        )} RENAME TO ${this.genIdentifier(args.sequence_name)};`;
      const downQuery =
        this.querySeparator() +
        `ALTER SEQUENCE ${this.genIdentifier(
          args.sequence_name,
        )} RENAME TO ${this.genIdentifier(args.original_sequence_name)};`;

      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async testConnection(args: any = {}) {
    const _func = this.testConnection.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.raw('SELECT 1+1 as data');
    } catch (e1) {
      const connectionParamsWithoutDb = deepClone(this.connectionConfig);
      connectionParamsWithoutDb.connection.password =
        this.connectionConfig.connection.password;
      connectionParamsWithoutDb.connection.database = 'postgres';
      const tempSqlClient = knex({
        ...connectionParamsWithoutDb,
        pool: { min: 0, max: 1 },
      });
      try {
        await tempSqlClient.raw('SELECT 1+1 as data');
        await tempSqlClient.destroy();
      } catch (e) {
        if (!/^database "[\w\d_]+" does not exist$/.test(e.message)) {
          log.ppe(e);
          result.code = -1;
          // send back original error message
          result.message = e1.message;
        }
      }
    } finally {
      log.api(`${_func}:result:`, result);
    }

    return result;
  }

  getKnexDataTypes() {
    const result = new Result();

    // result.data.list = [
    //   "integer",
    //   "bigInteger",
    //   "text",
    //   "string",
    //   "float",
    //   "decimal",
    //   "boolean",
    //   "date",
    //   // "datetime",
    //   "time",
    //   "timestamp",
    //   "binary",
    //   "enu",
    //   "json",
    //   "specificType"
    // ];

    result.data.list = [
      'int',
      'integer',
      'bigint',
      'bigserial',
      'char',
      'int2',
      'int4',
      'int8',
      'int4range',
      'int8range',
      'serial',
      'serial2',
      'serial8',
      'character',
      'bit',
      'bool',
      'boolean',
      'date',
      'double precision',
      'event_trigger',
      'fdw_handler',
      'float4',
      'float8',
      'uuid',
      'smallint',
      'smallserial',
      'character varying',
      'text',
      'real',
      'time',
      'time without time zone',
      'timestamp',
      'timestamp without time zone',
      'timestamptz',
      'timestamp with time zone',
      'timetz',
      'time with time zone',
      'daterange',
      'json',
      'jsonb',
      'gtsvector',
      'index_am_handler',
      'anyenum',
      'anynonarray',
      'anyrange',
      'box',
      'bpchar',
      'bytea',
      'cid',
      'cidr',
      'circle',
      'cstring',
      'inet',
      'internal',
      'interval',
      'language_handler',
      'line',
      'lsec',
      'macaddr',
      'money',
      'name',
      'numeric',
      'numrange',
      'oid',
      'opaque',
      'path',
      'pg_ddl_command',
      'pg_lsn',
      'pg_node_tree',
      'point',
      'polygon',
      'record',
      'refcursor',
      'regclass',
      'regconfig',
      'regdictionary',
      'regnamespace',
      'regoper',
      'regoperator',
      'regproc',
      'regpreocedure',
      'regrole',
      'regtype',
      'reltime',
      'smgr',
      'tid',
      'tinterval',
      'trigger',
      'tsm_handler',
      'tsquery',
      'tsrange',
      'tstzrange',
      'tsvector',
      'txid_snapshot',
      'unknown',
      'void',
      'xid',
      'xml',
    ];

    return result;
  }

  /**
   *
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   * @returns {Object} object - {version, primary, major, minor}
   */
  async version(args: any = {}) {
    const _func = this.version.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data.object = {};
      const data = await this.sqlClient.raw('SHOW server_version');
      log.debug(data.rows[0]);
      result.data.object.version = data.rows[0].server_version;
      const versions = data.rows[0].server_version.split('.');

      if (versions.length && (versions.length === 3 || versions.length === 2)) {
        result.data.object.primary = versions[0];
        result.data.object.major = versions[1];
        result.data.object.minor =
          versions.length > 2 ? versions[2] : versions[1];
        result.data.object.key = versions[0] + versions[1];
      } else {
        result.code = -1;
        result.message = `Invalid version : ${data.rows[0].server_version}`;
      }
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${_func} :result: %o`, result);
    }
    return result;
  }

  /**
   *
   * @param {Object} args
   * @param {String} args.database
   * @returns {Result}
   */
  async createDatabaseIfNotExists(args: any = {}) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    let tempSqlClient;

    try {
      const connectionParamsWithoutDb = deepClone(this.connectionConfig);
      connectionParamsWithoutDb.connection.password =
        this.connectionConfig.connection.password;
      let rows = [];
      try {
        connectionParamsWithoutDb.connection.database = 'postgres';
        tempSqlClient = knex({
          ...connectionParamsWithoutDb,
          pool: { min: 0, max: 1 },
        });

        log.debug('checking if db exists');
        rows = (
          await tempSqlClient.raw(
            `SELECT datname as database FROM pg_database WHERE datistemplate = false and datname = ?`,
            [args.database],
          )
        ).rows;
      } catch (e) {
        log.debug('checking if db exists');
        rows = (
          await this.sqlClient.raw(
            `SELECT datname as database FROM pg_database WHERE datistemplate = false and datname = ?`,
            [args.database],
          )
        ).rows;
      }
      if (rows.length === 0) {
        log.debug('creating database:', args);
        await tempSqlClient.raw(`CREATE DATABASE ?? ENCODING 'UTF8'`, [
          args.database,
        ]);
      }

      const schemaName = this.getEffectiveSchema(args);

      // Check schemaExists because `CREATE SCHEMA IF NOT EXISTS` requires permissions of `CREATE ON DATABASE`
      const schemaExists = !!(
        await this.sqlClient.raw(
          `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
          [schemaName],
        )
      ).rows?.[0];

      if (!schemaExists) {
        await this.sqlClient.raw(
          `CREATE SCHEMA IF NOT EXISTS ??  AUTHORIZATION ?? `,
          [schemaName, this.connectionConfig.connection.user],
        );
      }

      // this.sqlClient = knex(this.connectionConfig);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    } finally {
      if (tempSqlClient) {
        await tempSqlClient.destroy();
      }
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  protected getEffectiveSchema(args: { schema?: string } = {}) {
    return args?.schema || this.schema;
  }

  async dropDatabase(args) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const connectionParamsWithoutDb = deepClone(this.connectionConfig);
      connectionParamsWithoutDb.connection.password =
        this.connectionConfig.connection.password;
      connectionParamsWithoutDb.connection.database = 'postgres';
      const tempSqlClient = knex({
        ...connectionParamsWithoutDb,
        pool: { min: 0, max: 1 },
      });
      await this.sqlClient.destroy();
      this.sqlClient = tempSqlClient;

      await tempSqlClient.raw(
        `ALTER DATABASE ?? WITH CONNECTION LIMIT 0;
      SELECT pg_terminate_backend(sa.pid) FROM pg_stat_activity sa WHERE
      sa.pid <> pg_backend_pid() AND sa.datname = ?;`,
        [args.database, args.database],
      );

      log.debug('dropping database:', args);
      await tempSqlClient.raw(`DROP DATABASE ??;`, [args.database]);
      await tempSqlClient.destroy();
    } catch (e) {
      log.ppe(e, _func);
      // throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  /**
   *
   * @param args {tn}
   * @returns
   */
  async createTableIfNotExists(args) {
    const _func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      /** ************** START : create _evolution table if not exists *************** */
      const exists = await this.sqlClient.raw(
        `SELECT table_schema,table_name as tn, table_catalog FROM information_schema.tables where table_schema=? and
         table_name = ? and table_catalog = ?`,
        [
          this.getEffectiveSchema(args),
          args.tn,
          this.connectionConfig.connection.database,
        ],
      );

      if (exists.rows.length === 0) {
        const data = await this.sqlClient.raw(
          this.sqlClient.schema
            .createTable(args.tn, function (table) {
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
        log.debug('Table created:', `${args.tn}`, data);
      } else {
        log.debug(`${args.tn} tables exists`);
      }
      /** ************** END : create _evolution table if not exists *************** */
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  // async startTransaction() {
  //   let err = await this.sqlClient.raw("SET autocommit = 0");
  //   log.debug("SET autocommit = 0:", err);
  //   err = await this.sqlClient.raw("start transaction");
  //   log.debug("start transaction:", err);
  // }

  // async commit() {
  //   const err = await this.sqlClient.raw("commit");
  //   log.debug("commit:", err);
  //   await this.sqlClient.raw("SET autocommit = 1");
  //   log.debug("SET autocommit = 1:", err);
  // }

  // async rollback() {
  //   const err = await this.sqlClient.raw("rollback");
  //   log.debug("rollback:", err);
  //   await this.sqlClient.raw("SET autocommit = 1");
  //   log.debug("SET autocommit = 1:", err);
  // }

  async hasTable(args: any = {}) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT table_schema,table_name as tn, table_catalog FROM information_schema.tables where table_schema=? and table_name = ? and table_catalog = ?'`,
        [
          this.getEffectiveSchema(args),
          args.tn,
          this.connectionConfig.connection.database,
        ],
      );
      result.data.value = rows.length > 0;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasDatabase(args: any = {}) {
    const _func = this.hasDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT datname as database FROM pg_database WHERE datistemplate = false and datname = ?`,
        [args.databaseName],
      );

      result.data.value = rows.length > 0;

      if (result.data.value && args.schema) {
        const { rows: rows2 } = await this.sqlClient.raw(
          `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
          [args.schema],
        );
        result.data.value = rows2.length > 0;
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - databases
   * @property {String} - databases[].database_name
   */
  async databaseList(args: any = {}) {
    const _func = this.databaseList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT datname as database_name
           FROM pg_database
           WHERE datistemplate = false;`,
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - tables
   * @property {String} - tables[].tn
   */
  async tableList(args: any = {}) {
    const _func = this.tableList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.raw(
        `SELECT table_schema as ts, table_name as tn,table_type
              FROM information_schema.tables
              where table_schema = ?
              ORDER BY table_schema, table_name`,
        [this.getEffectiveSchema(args)],
      );

      result.data.list = rows.filter(
        ({ table_type }) => table_type.toLowerCase() === 'base table',
      );
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaList(args: any = {}) {
    const _func = this.schemaList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this
        .raw(`SELECT datname as schema_name FROM pg_database
                              WHERE 
                                  datistemplate = false 
                                      order by schema_name;`);

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - columns
   * @property {String} - columns[].tn
   * @property {String} - columns[].cn
   * @property {String} - columns[].dt
   * @property {String} - columns[].dtx
   * @property {String} - columns[].np
   * @property {String} - columns[].ns -
   * @property {String} - columns[].clen -
   * @property {String} - columns[].dp -
   * @property {String} - columns[].cop -
   * @property {String} - columns[].pk -
   * @property {String} - columns[].nrqd -
   * @property {String} - columns[].not_nullable -
   * @property {String} - columns[].ct -
   * @property {String} - columns[].un -
   * @property {String} - columns[].ai -
   * @property {String} - columns[].unique -
   * @property {String} - columns[].cdf -
   * @property {String} - columns[].cc -
   * @property {String} - columns[].csn -
   */

  async columnList(args: any = {}) {
    const _func = this.columnList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const versionQuery = await this.sqlClient.raw('SELECT version()');

      // Example output of `SELECT version()`
      // PostgreSQL 14.4 (Debian 14.4-1.pgdg110+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit
      const majorVersion = versionQuery.rows[0]?.version
        ?.split(' ')?.[1]
        ?.split('.')?.[0];

      // PostgreSQL 10 and above supports identity columns
      const identitySelector =
        +majorVersion >= 10 ? 'c.is_identity as ii,' : '';

      args.databaseName = this.connectionConfig.connection.database;
      const response = await this.sqlClient.raw(
        `select
                    c.table_name as tn, c.column_name as cn, c.data_type as dt,
                    (CASE WHEN  trg.trigger_name is NULL THEN false  else  true end) as au,
                    pk.constraint_type as ck,
                    c.character_maximum_length as clen,
                    c.numeric_precision as np,
                    c.numeric_scale as ns,
                    c.datetime_precision as dp,
                    c.ordinal_position as cop,
                    c.is_nullable as nrqd,
                    c.column_default as cdf,
                    c.generation_expression,
                    c.character_octet_length,
                    c.character_set_name as csn,
                    -- c.collation_name as clnn,
                    pk.ordinal_position as pk_ordinal_position, pk.constraint_name as pk_constraint_name,
                    c.udt_name,
                    ${identitySelector}

       (SELECT count(*)
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc1
                inner join INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cu
                    on cu.CONSTRAINT_NAME = tc1.CONSTRAINT_NAME
            where
                tc1.CONSTRAINT_TYPE = 'UNIQUE'
                and tc1.TABLE_NAME = c.TABLE_NAME
                and cu.COLUMN_NAME = c.COLUMN_NAME
                and tc1.TABLE_SCHEMA=c.TABLE_SCHEMA) IsUnique,
                (SELECT
        string_agg(enumlabel, ',')
        FROM "pg_enum" "e"
        INNER JOIN "pg_type" "t" ON "t"."oid" = "e"."enumtypid"
        INNER JOIN "pg_namespace" "n" ON "n"."oid" = "t"."typnamespace"
        WHERE "n"."nspname" = table_schema AND "t"."typname"=udt_name
                ) enum_values


            from information_schema.columns c
              left join
                ( select kc.constraint_name, kc.table_name,kc.column_name, kc.ordinal_position,tc.constraint_type
                  from information_schema.key_column_usage kc
                    inner join information_schema.table_constraints as tc
                      on kc.constraint_name = tc.constraint_name 
                      and kc.constraint_schema = tc.constraint_schema and tc.constraint_type in ('PRIMARY KEY')
                  where kc.table_catalog = :database and kc.table_schema= :schema
                  order by table_name,ordinal_position ) pk
                on
                pk.table_name = c.table_name and pk.column_name=c.column_name
                left join information_schema.triggers trg on trg.event_object_table = c.table_name and trg.trigger_name = CONCAT('xc_trigger_' , :table::text , '_' , c.column_name)
              where c.table_catalog=:database and c.table_schema=:schema and c.table_name=:table
              order by c.table_name, c.ordinal_position`,
        {
          schema: this.getEffectiveSchema(args),
          database: args.databaseName,
          table: args.tn,
        },
      );

      const columns = [];

      for (let i = 0; i < response.rows.length; ++i) {
        const column: any = {};

        column.tn = response.rows[i].tn;
        column.cn = response.rows[i].cn;
        column.cno = response.rows[i].cn;
        column.dt = response.rows[i].dt;
        column.np = response.rows[i].np;
        column.ns = response.rows[i].ns;
        column.clen = response.rows[i].clen;
        column.dp = response.rows[i].dp;
        column.cop = response.rows[i].cop;

        // todo : there are lot of types in pg - handle them
        //column.dtx = this.getKnexDataType(column.dt);
        column.dtx = response.rows[i].dt;
        column.pk = response.rows[i].pk_constraint_name !== null;

        column.nrqd = response.rows[i].nrqd !== 'NO';
        column.not_nullable = !column.nrqd;
        column.rqd = !column.nrqd;

        // todo: there is no type of unsigned in postgres
        response.rows[i].ct = response.rows[i].dt || '';
        column.un = response.rows[i].ct.indexOf('unsigned') !== -1;

        column.ai = false;
        if (response.rows[i].cdf) {
          column.ai = response.rows[i].cdf.indexOf('nextval') !== -1;
        }

        // todo : need to find if column is unique or not
        // column['unique'] = response.rows[i]['cst'].indexOf('UNIQUE') === -1 ? false : true;

        column.cdf = response.rows[i].cdf
          ? response.rows[i].cdf
              .replace(/::[\w (),]+$/, '')
              .replace(/^'|'$/g, '')
          : response.rows[i].cdf;

        // todo : need to find column comment
        column.cc = response.rows[i].cc;

        column.csn = response.rows[i].csn;
        column.dtxp =
          response.rows[i].clen || response.rows[i].np || response.rows[i].dp;
        column.dtxs = response.rows[i].ns;
        column.au = response.rows[i].au;
        column.data_type_custom = response.rows[i].udt_name;
        if (column.dt === 'USER-DEFINED') {
          column.dtxp = response.rows[i].enum_values;
        }

        // handle identity column
        if (+majorVersion >= 10) {
          if (response.rows[i].ii === 'YES') {
            column.ai = true;
          }
        }

        columns.push(column);
      }

      result.data.list = columns;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }
  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - indexes
   * @property {String} - indexes[].table -
   * @property {String} - indexes[].cn -
   * @property {String} - indexes[].key_name -
   * @property {String} - indexes[].non_unique -
   * @property {String} - indexes[].seq_in_index -
   * @property {String} - indexes[].collation -
   * @property {String} - indexes[].cardinality -
   * @property {String} - indexes[].sub_part -
   * @property {String} - indexes[].packed -
   * @property {String} - indexes[].null -
   * @property {String} - indexes[].index_type -
   * @property {String} - indexes[].comment -
   * @property {String} - indexes[].index_comment -
   * @property {String} - indexes[].cstn -
   * @property {String} - indexes[].cst - c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint
   */
  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT
      f.attname AS cn,
      i.relname as key_name,
      ix.indnatts, ix.indkey, f.attnum as seq_in_index,
      pg_catalog.format_type(f.atttypid,f.atttypmod) AS type,
      f.attnotnull as rqd,
      p.contype as cst,
      p.conname as cstn,
      ix.indisprimary as primarykey,
      not ix.indisunique as non_unique_original,
      not ix.indisunique as non_unique,
      CASE
          WHEN i.oid<>0 THEN true
          ELSE false
      END AS is_index,
      CASE
          WHEN f.atthasdef = 't' THEN pg_get_expr(d.adbin, d.adrelid)
      END AS default  FROM pg_attribute f
      JOIN pg_class c ON c.oid = f.attrelid
      JOIN pg_type t ON t.oid = f.atttypid
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_constraint p ON p.conrelid = c.oid AND f.attnum = ANY (p.conkey)
      LEFT JOIN pg_class AS g ON p.confrelid = g.oid
      LEFT JOIN pg_index AS ix ON f.attnum = ANY(ix.indkey) and c.oid = f.attrelid and c.oid = ix.indrelid
      LEFT JOIN pg_class AS i ON ix.indexrelid = i.oid
      WHERE
        c.relkind = 'r'::char
      AND n.nspname = ?
      AND c.relname = ?
      and i.oid<>0
      AND f.attnum > 0
      ORDER BY i.relname, f.attnum;`,
        [this.getEffectiveSchema(args), args.tn],
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.parentTable
   * @param {String} - args.parentColumn
   * @param {String} - args.childColumn
   * @param {String} - args.childTable
   * @param {String} - args.foreignKeyName
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async relationDelete(args) {
    const _func = this.relationDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const foreignKeyName = args.foreignKeyName || null;

    args.childTableWithSchema = args.schema
      ? `${args.schema}.${args.childTable}`
      : args.childTable;

    args.parentTableWithSchema = args.schema
      ? `${args.schema}.${args.parentTable}`
      : args.parentTable;

    try {
      // const self = this;

      await this.sqlClient.raw(
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery(),
      );

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table
              .foreign(args.childColumn, foreignKeyName)
              .references(args.parentColumn)
              .on(args.parentTableWithSchema);
          })
          .toQuery();

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

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - indexes
   * @property {String} - indexes[].cstn -
   * @property {String} - indexes[].cn -
   * @property {String} - indexes[].op -
   * @property {String} - indexes[].puc -
   * @property {String} - indexes[].cst -
   */
  async constraintList(args: any = {}) {
    const _func = this.constraintList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const response = await this.sqlClient.raw(
        `
      SELECT c.conname AS cstn,
          CASE
              WHEN c.contype = 'u' THEN 'UNIQUE'
          WHEN c.contype = 'p' THEN 'PRIMARY KEY'
              ELSE 'FOREIGN KEY'
          END AS cst,
           col.attnum,
           sch.nspname                                   AS "schema",
           tbl.relname                                   AS "table",
           ARRAY_AGG(col.attname ORDER BY u.attposition) AS columns,
           pg_get_constraintdef(c.oid)                   AS definition
        FROM pg_constraint c
           JOIN LATERAL UNNEST(c.conkey) WITH ORDINALITY AS u(attnum, attposition) ON TRUE
           JOIN pg_class tbl ON tbl.oid = c.conrelid
           JOIN pg_namespace sch ON sch.oid = tbl.relnamespace
           JOIN pg_attribute col ON (col.attrelid = tbl.oid AND col.attnum = u.attnum)
        where tbl.relname=?
        GROUP BY constraint_name, col.attnum, constraint_type, "schema", "table", definition
        ORDER BY "schema", "table"; `,
        [args.tn],
      );

      const rows = [];
      for (let i = 0, rowCount = 0; i < response.rows.length; ++i, ++rowCount) {
        response.rows[i].columns = response.rows[i].columns.replace('{', '');
        response.rows[i].columns = response.rows[i].columns.replace('}', '');
        response.rows[i].columns = response.rows[i].columns.split(',');

        if (response.rows[i].columns.length === 1) {
          rows[rowCount] = response.rows[i];
          rows[rowCount].columns = response.rows[i].columns[0];
          rows[rowCount].seq_in_index = 1;
        } else {
          const cols = response.rows[i].columns.slice();
          for (let j = 0; j < cols.length; ++j, ++rowCount) {
            rows[rowCount] = JSON.parse(JSON.stringify(response.rows[i]));
            rows[rowCount].columns = cols[j];
            rows[rowCount].seq_in_index = j;
          }
          rowCount--;
        }
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - relations
   * @property {String} - relations[].tn
   * @property {String} - relations[].cstn -
   * @property {String} - relations[].tn -
   * @property {String} - relations[].cn -
   * @property {String} - relations[].rtn -
   * @property {String} - relations[].rcn -
   * @property {String} - relations[].puc -
   * @property {String} - relations[].ur -
   * @property {String} - relations[].dr -
   * @property {String} - relations[].mo -
   */
  async relationList(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // The relationList & relationListAll queries is may look needlessly long, but it is a way
      // to get relationships without the `information_schema.constraint_column_usage` table (view).
      // As that view only returns fk relations if the pg user is the table owner.
      // Resource: https://dba.stackexchange.com/a/218969
      // Remove clause `WHERE clause: AND f_sch.nspname = sch.nspname` for x-schema relations.
      const { rows } = await this.sqlClient.raw(
        `SELECT 
          sch.nspname    AS ts,
          pc.conname     AS cstn,
          tbl.relname    AS tn,
          col.attname    AS cn,
          f_sch.nspname  AS foreign_table_schema,
          f_tbl.relname  AS rtn,
          f_col.attname  AS rcn,
          pc.confupdtype AS ur,
          pc.confdeltype AS dr
        FROM pg_constraint pc
          LEFT JOIN LATERAL UNNEST(pc.conkey)  WITH ORDINALITY AS u(attnum, attposition)   ON TRUE
          LEFT JOIN LATERAL UNNEST(pc.confkey) WITH ORDINALITY AS f_u(attnum, attposition) ON f_u.attposition = u.attposition
          JOIN pg_class tbl ON tbl.oid = pc.conrelid
          JOIN pg_namespace sch ON sch.oid = tbl.relnamespace
          LEFT JOIN pg_attribute col ON (col.attrelid = tbl.oid AND col.attnum = u.attnum)
          LEFT JOIN pg_class f_tbl ON f_tbl.oid = pc.confrelid
          LEFT JOIN pg_namespace f_sch ON f_sch.oid = f_tbl.relnamespace
          LEFT JOIN pg_attribute f_col ON (f_col.attrelid = f_tbl.oid AND f_col.attnum = f_u.attnum)
        WHERE pc.contype = 'f' AND sch.nspname = :schema AND f_sch.nspname = sch.nspname AND tbl.relname = :table ;`,
        { schema: this.getEffectiveSchema(args), table: args.tn },
      );

      const ruleMapping = {
        a: 'NO ACTION',
        c: 'CASCADE',
        r: 'RESTRICT',
        n: 'SET NULL',
        d: 'SET DEFAULT',
      };

      for (const row of rows) {
        row.ur = ruleMapping[row.ur];
        row.dr = ruleMapping[row.dr];
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.parentTable
   * @param {String} - args.parentColumn
   * @param {String} - args.childColumn
   * @param {String} - args.childTable
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async relationCreate(args) {
    const _func = this.relationCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const foreignKeyName = args.foreignKeyName || null;

    args.childTableWithSchema = args.schema
      ? `${args.schema}.${args.childTable}`
      : args.childTable;

    args.parentTableWithSchema = args.schema
      ? `${args.schema}.${args.parentTable}`
      : args.parentTable;

    try {
      const upQb = this.sqlClient.schema.table(
        args.childTableWithSchema,
        function (table) {
          table = table
            .foreign(args.childColumn, foreignKeyName)
            .references(args.parentColumn)
            .on(args.parentTableWithSchema);

          if (args.onUpdate) {
            table = table.onUpdate(args.onUpdate);
          }
          if (args.onDelete) {
            table.onDelete(args.onDelete);
          }
        },
      );

      await this.sqlClient.raw(upQb.toQuery());

      const upStatement = this.querySeparator() + upQb.toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

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

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - relations
   * @property {String} - relations[].tn
   * @property {String} - relations[].cstn -
   * @property {String} - relations[].tn -
   * @property {String} - relations[].cn -
   * @property {String} - relations[].rtn -
   * @property {String} - relations[].rcn -
   * @property {String} - relations[].puc -
   * @property {String} - relations[].ur -
   * @property {String} - relations[].dr -
   * @property {String} - relations[].mo -
   */
  async relationListAll(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT 
          sch.nspname    AS ts,
          pc.conname     AS cstn,
          tbl.relname    AS tn,
          col.attname    AS cn,
          f_sch.nspname  AS foreign_table_schema,
          f_tbl.relname  AS rtn,
          f_col.attname  AS rcn,
          pc.confupdtype AS ur,
          pc.confdeltype AS dr
        FROM pg_constraint pc
          LEFT JOIN LATERAL UNNEST(pc.conkey)  WITH ORDINALITY AS u(attnum, attposition)   ON TRUE
          LEFT JOIN LATERAL UNNEST(pc.confkey) WITH ORDINALITY AS f_u(attnum, attposition) ON f_u.attposition = u.attposition
          JOIN pg_class tbl ON tbl.oid = pc.conrelid
          JOIN pg_namespace sch ON sch.oid = tbl.relnamespace
          LEFT JOIN pg_attribute col ON (col.attrelid = tbl.oid AND col.attnum = u.attnum)
          LEFT JOIN pg_class f_tbl ON f_tbl.oid = pc.confrelid
          LEFT JOIN pg_namespace f_sch ON f_sch.oid = f_tbl.relnamespace
          LEFT JOIN pg_attribute f_col ON (f_col.attrelid = f_tbl.oid AND f_col.attnum = f_u.attnum)
        WHERE pc.contype = 'f' AND sch.nspname = ?
        ORDER BY tn;`,
        [this.getEffectiveSchema(args)],
      );

      const ruleMapping = {
        a: 'NO ACTION',
        c: 'CASCADE',
        r: 'RESTRICT',
        n: 'SET NULL',
        d: 'SET DEFAULT',
      };

      for (const row of rows) {
        row.ur = ruleMapping[row.ur];
        row.dr = ruleMapping[row.dr];
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - triggers
   * @property {String} - triggers[].trigger
   * @property {String} - triggers[].event
   * @property {String} - triggers[].table
   * @property {String} - triggers[].statement
   * @property {String} - triggers[].timing
   * @property {String} - triggers[].created
   * @property {String} - triggers[].sql_mode
   * @property {String} - triggers[].definer
   * @property {String} - triggers[].character_set_client
   * @property {String} - triggers[].collation_connection
   * @property {String} - triggers[].database collation
   */
  async triggerList(args: any = {}) {
    const _func = this.triggerList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `select * from information_schema.triggers where trigger_schema=? and event_object_table=?`,
        [this.getEffectiveSchema(args), args.tn],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].statement = rows[i].action_statement;
        rows[i].table = rows[i].event_object_table;
        rows[i].trigger = rows[i].trigger_name;
        rows[i].event = rows[i].event_manipulation;
        rows[i].timing = rows[i].action_timing;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - functions
   * @property {String} - functions[].function_name
   * @property {String} - functions[].type
   * @property {String} - functions[].definer
   * @property {String} - functions[].modified
   * @property {String} - functions[].created
   * @property {String} - functions[].security_type
   * @property {String} - functions[].comment
   * @property {String} - functions[].character_set_client
   * @property {String} - functions[].collation_connection
   * @property {String} - functions[].database collation
   */
  async functionList(args: any = {}) {
    const _func = this.functionList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `SELECT *
              FROM pg_catalog.pg_namespace n
                     JOIN pg_catalog.pg_proc p
                          ON pronamespace = n.oid
              WHERE nspname = ?;`,
        [this.getEffectiveSchema(args)],
      );
      const functionRows = [];
      for (let i = 0; i < rows.length; ++i) {
        if (!('prokind' in rows[i]) || rows[i].prokind !== 'p')
          functionRows.push({
            create_function: rows[i].prosrc,
            function_name: rows[i].proname,
          });
      }

      result.data.list = functionRows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   * @todo Remove the function - pg doesn't support procedure
   *
   * @param {Object} - args - For future reasons
   * @returns {Object[]} - procedures
   * @property {String} - procedures[].procedure_name
   * @property {String} - procedures[].type
   * @property {String} - procedures[].definer
   * @property {String} - procedures[].modified
   * @property {String} - procedures[].created
   * @property {String} - procedures[].security_type
   * @property {String} - procedures[].comment
   * @property {String} - procedures[].definer
   * @property {String} - procedures[].character_set_client
   * @property {String} - procedures[].collation_connection
   * @property {String} - procedures[].database collation
   */
  async procedureList(args: any = {}) {
    const _func = this.procedureList.name;
    const result = new Result();
    result.data.list = [];
    log.api(`${_func}:args:`, args);

    // todo: update query - https://dataedo.com/kb/query/postgresql/list-stored-procedures
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `SELECT *
              FROM pg_catalog.pg_namespace n
                     JOIN pg_catalog.pg_proc p
                          ON pronamespace = n.oid
              WHERE nspname = ?;`,
        [this.getEffectiveSchema(args)],
      );
      const procedureRows = [];
      for (let i = 0; i < rows.length; ++i) {
        if ('prokind' in rows[i] && rows[i].prokind === 'p')
          procedureRows.push({
            create_procedure: rows[i].prosrc,
            procedure_name: rows[i].proname,
          });
      }

      result.data.list = procedureRows;
    } catch (e) {
      // todo: enable log
      // log.ppe(e, _func);
      // throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - views
   * @property {String} - views[].sql_mode
   * @property {String} - views[].create_function
   * @property {String} - views[].database collation
   * @property {String} - views[].collation_connection
   * @property {String} - views[].character_set_client
   */
  async viewList(args: any = {}) {
    const _func = this.viewList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.sqlClient.raw(
        `select *
           from INFORMATION_SCHEMA.views
           WHERE table_schema = ?;`,
        [this.getEffectiveSchema(args)],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].view_name = rows[i].tn || rows[i].table_name;
        // rows[i].view_definition = rows[i].view_definition;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.function_name -
   * @returns {Object[]} - functions
   * @property {String} - create_function
   * @property {String} - function_declaration
   */
  async functionRead(args: any = {}) {
    const _func = this.functionRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `SELECT format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)) as function_declaration, pg_get_functiondef(p.oid) as create_function
                FROM pg_proc p INNER JOIN pg_namespace ns ON (p.pronamespace = ns.oid)
            WHERE ns.nspname = ? and p.proname = ?;`,
        [this.getEffectiveSchema(args), args.function_name],
      );

      // log.debug(response);

      for (let i = 0; i < rows.length; ++i) {
        rows[i].function_name = args.function_name;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   * @todo Remove the function - pg doesn't support procedure
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.procedure_name -
   * @returns {Object[]} - functions
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async procedureRead(args: any = {}) {
    const _func = this.procedureRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(`show create procedure ?;`, [
        args.procedure_name,
      ]);
      const rows = [];

      if (response.length === 2) {
        for (let i = 0; i < response[0].length; ++i) {
          let procedure = response[0][i];
          procedure = mapKeys(procedure, (_v, k) => k.toLowerCase());
          procedure.create_procedure = procedure['create procedure'];
          rows.push(procedure);
        }
      } else log.debug('Unknown response for tableList:', response);

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.view_name -
   * @returns {Object[]} - views
   * @property {String} - views[].tn
   */
  async viewRead(args: any = {}) {
    const _func = this.viewRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `select * from INFORMATION_SCHEMA.views WHERE table_name=? and table_schema = ANY (current_schemas(false));`,
        [args.view_name],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].view_name = rows[i].tn;
        // rows[i].view_definition = rows[i].view_definition;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async triggerRead(args: any = {}) {
    const _func = this.triggerRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SHOW FULL TABLES IN ?? WHERE TABLE_TYPE LIKE 'VIEW';`,
        [args.databaseName],
      );
      let rows = [];

      if (response.length === 2) {
        const views = [];

        for (let i = 0; i < response[0].length; ++i) {
          const view = response[0][i];
          view.view_name = view[`Tables_in_${args.databaseName}`];
          views.push(view);
        }

        rows = views;
      } else log.debug('Unknown response for tableList:', response);

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaCreate(args: any = {}) {
    const _func = this.schemaCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.sqlClient.raw(`create database ??`, [args.database_name]);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaDelete(args: any = {}) {
    const _func = this.schemaDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.sqlClient.raw(`drop database ??`, [args.database_name]);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async triggerDelete(args: any = {}) {
    const _func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const upQuery = this.genQuery(`DROP TRIGGER IF EXISTS ?? ON ??`, [
        args.trigger_name,
        args.tn,
      ]);
      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upQuery }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              this.genQuery(
                `CREATE TRIGGER ?? \n${args.timing} ${args.event}\nON ?? FOR EACH ROW\n${args.statement}`,
                [args.trigger_name, args.tn],
              ),
          },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.function_name
   * @param {String} - args.function_declaration
   * @param {String} - args.create_function
   * @returns {Object[]} - result rows
   */
  async functionDelete(args: any = {}) {
    const _func = this.functionDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    const upQuery =
      this.querySeparator() +
      `DROP FUNCTION IF EXISTS ${this.genIdentifier(
        args.function_declaration,
      )}`;
    const downQuery = this.querySeparator() + args.create_function;
    try {
      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  // @todo Remove the function - pg doesn't support procedure
  async procedureDelete(args: any = {}) {
    const _func = this.procedureDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.sqlClient.raw(
        `DROP PROCEDURE IF EXISTS ${this.genIdentifier(args.procedure_name)}`,
      );
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} args
   * @param {String} func : function name
   * @returns {Result}
   * @returns {Object} - Result.data
   * @returns {String} - Result.data.value - sql query
   */
  async _getQuery(args) {
    try {
      if (isEmpty(this._version)) {
        const result = await this.version();
        this._version = result.data.object;
        log.debug(
          `Version was empty for ${args.func}: population version for database as`,
          this._version,
        );
      }

      // log.debug(this._version, args);

      if (this._version.key in this.queries[args.func]) {
        return this.queries[args.func][this._version.key].sql;
      }
      return this.queries[args.func].default.sql;
    } catch (error) {
      log.ppe(error, this._getQuery.name);
      throw error;
    }
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.function_name
   * @param {String} - args.create_function
   * @returns {Object[]} - result rows
   */
  async functionCreate(args: any = {}) {
    const func = this.functionCreate.name;
    const result = new Result();

    log.api(`${func}:args:`, args);

    try {
      const upQuery = this.querySeparator() + args.create_function;

      await this.sqlClient.raw(upQuery);

      const functionCreated = await this.functionRead({
        function_name: args.function_name,
      });

      const downQuery =
        this.querySeparator() +
        `DROP FUNCTION IF EXISTS ${this.genIdentifier(
          functionCreated.data.list[0].function_declaration,
        )}`;

      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.function_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async functionUpdate(args: any = {}) {
    const func = this.functionUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const upQuery = this.querySeparator() + args.create_function;
      let downQuery = this.querySeparator() + args.oldCreateFunction;

      await this.sqlClient.raw(
        `DROP FUNCTION IF EXISTS ${this.genIdentifier(
          args.function_declaration,
        )};`,
      );
      await this.sqlClient.raw(upQuery);

      const functionCreated = await this.functionRead({
        function_name: args.function_name,
      });

      downQuery =
        `DROP FUNCTION IF EXISTS ${this.genIdentifier(
          functionCreated.data.list[0].function_declaration,
        )};` + downQuery;

      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   * @todo Remove the function - pg doesn't support procedure
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.procedure_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   *
   */
  async procedureCreate(args: any = {}) {
    const func = this.procedureCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER ${this.genIdentifier(args.procedure_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`;
      await this.sqlClient.raw(upQuery);
      const downQuery =
        this.querySeparator() +
        `DROP PROCEDURE IF EXISTS ${this.genIdentifier(args.procedure_name)}`;
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   * @todo Remove the function - pg doesn't support procedure
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.procedure_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async procedureUpdate(args: any = {}) {
    const func = this.procedureUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query =
        this.querySeparator() + `DROP TRIGGER ${args.procedure_name}`;
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER ${this.genIdentifier(args.procedure_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`;

      await this.sqlClient.raw(query);
      await this.sqlClient.raw(upQuery);

      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: ';' }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.trigger_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async triggerCreate(args: any = {}) {
    const func = this.triggerCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`;
      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP TRIGGER ${this.genIdentifier(args.trigger_name)}`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.trigger_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @param {String} - args.oldStatement
   * @returns {Object[]} - result rows
   */
  async triggerUpdate(args: any = {}) {
    const func = this.triggerUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(
        `DROP TRIGGER ${this.genIdentifier(
          args.trigger_name,
        )} ON ${this.genIdentifier(args.tn)}`,
      );
      await this.sqlClient.raw(
        `CREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );

      result.data.object = {
        upStatement:
          this.querySeparator() +
          `DROP TRIGGER ${this.genIdentifier(
            args.trigger_name,
          )} ON ${this.genIdentifier(
            args.tn,
          )};${this.querySeparator()}CREATE TRIGGER ${this.genIdentifier(
            args.trigger_name,
          )} \n${args.timing} ${args.event}\nON ${this.genIdentifier(
            args.tn,
          )} FOR EACH ROW\n${args.statement}`,
        downStatement:
          this.querySeparator() +
          `CREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
            args.timing
          } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
            args.oldStatement
          }`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @returns {Object} - up and down statements
   */
  async viewCreate(args: any = {}) {
    const func = this.viewCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = args.view_definition;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP VIEW ${this.genIdentifier(args.view_name)}`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @param {String} - args.oldViewDefination
   * @returns {Object} - up and down statements
   */
  async viewUpdate(args: any = {}) {
    const func = this.viewUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = `CREATE OR REPLACE VIEW ${this.genIdentifier(
        args.view_name,
      )} AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: this.querySeparator() + query,
        downStatement:
          this.querySeparator() +
          `CREATE VIEW ${this.genIdentifier(args.view_name)} AS \n${
            args.oldViewDefination
          }`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @param {String} - args.oldViewDefination
   * @returns {Object} - up and down statements
   */
  async viewDelete(args: any = {}) {
    const func = this.viewDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    // `DROP TRIGGER ${args.view_name}`
    try {
      const query = `DROP VIEW ${this.genIdentifier(args.view_name)}`;

      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `CREATE VIEW ${this.genIdentifier(args.view_name)} AS \n${
                args.oldViewDefination
              }`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {Object[]} - args.columns
   * @param {String} - args.columns[].tn
   * @param {String} - args.columns[].cn
   * @param {String} - args.columns[].dt
   * @param {String} - args.columns[].np
   * @param {String} - args.columns[].ns -
   * @param {String} - args.columns[].clen -
   * @param {String} - args.columns[].dp -
   * @param {String} - args.columns[].cop -
   * @param {String} - args.columns[].pk -
   * @param {String} - args.columns[].nrqd -
   * @param {String} - args.columns[].not_nullable -
   * @param {String} - args.columns[].ct -
   * @param {String} - args.columns[].un -
   * @param {String} - args.columns[].ai -
   * @param {String} - args.columns[].unique -
   * @param {String} - args.columns[].cdf -
   * @param {String} - args.columns[].cc -
   * @param {String} - args.columns[].csn -
   * @param {String} - args.columns[].dtx
   *                     - value will be 'specificType' for all cols except ai
   *                     - for ai it will be integer, bigInteger
   *                     - tiny, small and medium Int auto increement is not supported
   * @param {String} - args.columns[].dtxp - to use in UI
   * @param {String} - args.columns[].dtxs - to use in UI
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableCreate(args) {
    const _func = this.tableCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;
      args.sqlClient = this.sqlClient;

      /**************** create table ****************/
      const upQuery = this.querySeparator() + this.createTable(args.tn, args);
      await this.sqlClient.raw(upQuery);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(args.table).toString();

      this.emit(`Success : ${upQuery}`);

      const triggerStatements = await this.afterTableCreate(args);

      /**************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upQuery }, ...triggerStatements.upStatement],
        downStatement: [
          ...triggerStatements.downStatement,
          { sql: downStatement },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async afterTableCreate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au) {
        const triggerFnName = args.schema
          ? `xc_au_${args.schema}_${args.tn}_${column.cn}`
          : `xc_au_${args.tn}_${column.cn}`;
        const triggerName = args.schema
          ? `xc_trigger_${args.schema}_${args.tn}_${column.cn}`
          : `xc_trigger_${args.tn}_${column.cn}`;

        const triggerFnQuery = this.genQuery(
          `CREATE OR REPLACE FUNCTION ??()
                          RETURNS TRIGGER AS $$
                          BEGIN
                            NEW.?? = NOW();
                            RETURN NEW;
                          END;
                          $$ LANGUAGE plpgsql;`,
          [triggerFnName, column.cn],
        );

        upQuery +=
          this.querySeparator() +
          triggerFnQuery +
          this.querySeparator() +
          this.genQuery(
            `CREATE TRIGGER ??
            BEFORE UPDATE ON ??
            FOR EACH ROW
            EXECUTE PROCEDURE ??();`,
            [
              triggerName,
              args.schema ? `${args.schema}.${args.tn}` : args.tn,
              triggerFnName,
            ],
          );

        downQuery +=
          this.querySeparator() +
          this.genQuery(`DROP TRIGGER IF EXISTS ?? ON ??;`, [
            triggerName,
            args.schema ? `${args.schema}.${args.tn}` : args.tn,
          ]) +
          this.querySeparator() +
          this.genQuery(`DROP FUNCTION IF EXISTS ??()`, [triggerFnName]);
      }
    }
    if (upQuery !== '') await this.sqlClient.raw(upQuery);
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };

    return result;
  }

  async afterTableUpdate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au && column.altered === 1) {
        const triggerFnName = args.schema
          ? `xc_au_${args.schema}_${args.tn}_${column.cn}`
          : `xc_au_${args.tn}_${column.cn}`;
        const triggerName = args.schema
          ? `xc_trigger_${args.schema}_${args.tn}_${column.cn}`
          : `xc_trigger_${args.tn}_${column.cn}`;

        const triggerFnQuery = this.genQuery(
          `CREATE OR REPLACE FUNCTION ??()
                          RETURNS TRIGGER AS $$
                          BEGIN
                            NEW.?? = NOW();
                            RETURN NEW;
                          END;
                          $$ LANGUAGE plpgsql;`,
          [triggerFnName, column.cn],
        );

        upQuery +=
          this.querySeparator() +
          triggerFnQuery +
          this.querySeparator() +
          this.genQuery(
            `CREATE TRIGGER ??
            BEFORE UPDATE ON ??
            FOR EACH ROW
            EXECUTE PROCEDURE ??();`,
            [
              triggerName,
              args.schema ? `${args.schema}.${args.tn}` : args.tn,
              triggerFnName,
            ],
          );

        downQuery +=
          this.querySeparator() +
          this.genQuery(`DROP TRIGGER IF EXISTS ?? ON ??;`, [
            triggerName,
            args.tn,
          ]) +
          this.querySeparator() +
          this.genQuery(`DROP FUNCTION IF EXISTS ??()`, [triggerFnName]);
      }
    }
    if (upQuery !== '') await this.sqlClient.raw(upQuery);
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.table
   * @param {String} - args.table
   * @param {Object[]} - args.columns
   * @param {String} - args.columns[].tn
   * @param {String} - args.columns[].cn
   * @param {String} - args.columns[].dt
   * @param {String} - args.columns[].np
   * @param {String} - args.columns[].ns -
   * @param {String} - args.columns[].clen -
   * @param {String} - args.columns[].dp -
   * @param {String} - args.columns[].cop -
   * @param {String} - args.columns[].pk -
   * @param {String} - args.columns[].nrqd -
   * @param {String} - args.columns[].not_nullable -
   * @param {String} - args.columns[].ct -
   * @param {String} - args.columns[].un -
   * @param {String} - args.columns[].ai -
   * @param {String} - args.columns[].unique -
   * @param {String} - args.columns[].cdf -
   * @param {String} - args.columns[].cc -
   * @param {String} - args.columns[].csn -
   * @param {Number} - args.columns[].altered - 1,2,4 = addition,edited,deleted
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableUpdate(args) {
    const _func = this.tableUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;
      const originalColumns = args.originalColumns;
      args.connectionConfig = this._connectionConfig;
      args.sqlClient = this.sqlClient;

      let upQuery = '';
      let downQuery = '';

      for (let i = 0; i < args.columns.length; ++i) {
        const oldColumn = find(originalColumns, {
          cn: args.columns[i].cno,
        });

        if (args.columns[i].altered & 4) {
          // col remove
          upQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableAddColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
          // col edit
          upQuery += this.alterTableChangeColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableChangeColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += this.alterTableAddColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            downQuery,
          );
        }
      }

      upQuery +=
        (upQuery ? ';' : '') +
        this.alterTablePK(
          args.table,
          args.columns,
          args.originalColumns,
          upQuery,
        );
      downQuery +=
        (downQuery ? ';' : '') +
        this.alterTablePK(
          args.table,
          args.originalColumns,
          args.columns,
          downQuery,
        );

      if (upQuery) {
        //upQuery = `ALTER TABLE "${args.columns[0].tn}" ${upQuery};`;
        //downQuery = `ALTER TABLE "${args.columns[0].tn}" ${downQuery};`;
      }

      if (upQuery !== '') await this.sqlClient.raw(upQuery);

      // console.log(upQuery);

      const afterUpdate = await this.afterTableUpdate(args);

      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + upQuery },
          ...afterUpdate.upStatement,
        ],
        downStatement: [
          ...afterUpdate.downStatement,
          { sql: this.querySeparator() + downQuery },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param args.tn
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableDelete(args) {
    const _func = this.tableDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // const { columns } = args;
      args.sqlClient = this.sqlClient;

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .dropTable(args.schema ? `${args.schema}.${args.tn}` : args.tn)
          .toString();
      let downQuery = this.createTable(args.tn, args);

      /**

       columnList
       relationList
       indexesList
       createAggregatedIndexes
       filterOutPkAndFk

       downQuery
       create table    - via columnList - we are doing this
       + create fks      - via relationList
       + create indexes  - slightly tricky

       */

      let relationsList: any = await this.relationList(args);

      relationsList = relationsList.data.list;

      for (const relation of relationsList) {
        const query = this.sqlClient.raw(
          this.sqlClient.schema
            .table(relation.tn, function (table) {
              table = table
                .foreign(relation.cn, null)
                .references(relation.rcn)
                .on(relation.rtn);

              if (relation.ur) {
                table = table.onUpdate(relation.ur);
              }
              if (relation.dr) {
                table.onDelete(relation.dr);
              }
            })
            .toQuery(),
        );

        downQuery += this.querySeparator() + query;

        await query;
      }

      let indexList: any = await this.indexList(args);

      indexList = indexList.data.list.filter(
        ({ cst }) => cst !== 'p' && cst !== 'f',
      );

      const indexesMap: { [key: string]: any } = {};

      for (const { key_name, non_unique, cn } of indexList) {
        if (!(key_name in indexesMap)) {
          indexesMap[key_name] = {
            tn: args.tn,
            indexName: key_name,
            non_unique,
            columns: [],
          };
        }
        indexesMap[key_name].columns.push(cn);
      }

      for (const { non_unique, tn, columns, indexName } of Object.values(
        indexesMap,
      )) {
        downQuery +=
          this.querySeparator() +
          this.sqlClient.schema
            .table(tn, function (table) {
              if (non_unique) {
                table.index(columns, indexName);
              } else {
                table.unique(columns, indexName);
              }
            })
            .toQuery();
      }

      this.emit(`Success : ${upStatement}`);

      /** ************** drop tn *************** */
      await this.sqlClient.raw(
        this.sqlClient.schema
          .dropTable(args.schema ? `${args.schema}.${args.tn}` : args.tn)
          .toQuery(),
      );

      /** ************** return files *************** */
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
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableCreateStatement(args) {
    const _func = this.tableCreateStatement.name;
    let result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result = await this.columnList(args);
      const upQuery = this.createTable(args.tn, {
        tn: args.tn,
        columns: result.data.list,
      });
      result.data = upQuery;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableInsertStatement(args) {
    const _func = this.tableCreateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `INSERT INTO \`${args.tn}\` (`;
      let values = ' VALUES (';
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\n"${response.data.list[i].cn}"\n\t`;
            values += `\n<${response.data.list[i].cn}>\n\t`;
          } else {
            result.data += `, \`"${response.data.list[i].cn}"\`\n\t`;
            values += `, <${response.data.list[i].cn}>\n\t`;
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

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableUpdateStatement(args) {
    const _func = this.tableUpdateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data = `UPDATE "${args.tn}" \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `"${response.data.list[i].cn}" = <\`${response.data.list[i].cn}\`>\n\t`;
          } else {
            result.data += `,"${response.data.list[i].cn}" = <\`${response.data.list[i].cn}\`>\n\t`;
          }
        }
      }

      result.data += ';';
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableDeleteStatement(args) {
    const _func = this.tableDeleteStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `DELETE FROM "${args.tn}" where ;`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableTruncateStatement(args) {
    const _func = this.tableTruncateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `TRUNCATE TABLE "${args.tn}";`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableSelectStatement(args) {
    const _func = this.tableSelectStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data = `SELECT `;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `"${response.data.list[i].cn}"\n\t`;
          } else {
            result.data += `, "${response.data.list[i].cn}"\n\t`;
          }
        }
      }

      result.data += ` FROM "${args.tn}";`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   * Generates SQL query to modify primary key constraints for a table
   * @param {string} tableName - Full table name (can include schema)
   * @param {Array<ColumnType>} newColumns - New column definitions
   * @param {Array<ColumnType>} originalColumns - Original column definitions
   * @param {string} _existingQuery - Existing SQL query (unused parameter)
   * @param {boolean} [createTable=false] - Whether this is part of a CREATE TABLE statement
   * @returns {string} SQL query for primary key modifications
   */
  alterTablePK(
    tableName,
    newColumns,
    originalColumns,
    _existingQuery,
    createTable = false,
  ) {
    const originalPrimaryKeys = [];
    const newPrimaryKeys = [];
    let primaryKeyChanges = 0;

    // Handle schema-qualified table names by extracting just the table name
    const tableNameWithoutSchema = tableName.includes('.')
      ? tableName.split('.')[1]
      : tableName;

    // Collect new primary key columns (excluding dropped columns)
    for (let i = 0; i < newColumns.length; ++i) {
      if (newColumns[i].pk) {
        if (newColumns[i].altered !== 4) newPrimaryKeys.push(newColumns[i].cn);
      }
    }

    // Collect original primary key columns
    for (let i = 0; i < originalColumns.length; ++i) {
      if (originalColumns[i].pk) {
        originalPrimaryKeys.push(originalColumns[i].cn);
      }
    }

    // Determine if primary keys have changed
    if (newPrimaryKeys.length === originalPrimaryKeys.length) {
      for (let i = 0; i < newPrimaryKeys.length; ++i) {
        if (originalPrimaryKeys[i] !== newPrimaryKeys[i]) {
          primaryKeyChanges = 1;
          break;
        }
      }
    } else {
      primaryKeyChanges = newPrimaryKeys.length - originalPrimaryKeys.length;
    }

    let query = '';
    if (!newPrimaryKeys.length && !originalPrimaryKeys.length) {
      // No primary keys in either version, no changes needed
    } else if (primaryKeyChanges) {
      // Drop existing primary key if it exists
      query += originalPrimaryKeys.length
        ? this.genQuery(`alter TABLE ?? drop constraint IF EXISTS ??;`, [
            tableName,
            `${tableNameWithoutSchema}_pkey`,
          ])
        : '';

      // Add new primary key if specified
      if (newPrimaryKeys.length) {
        if (createTable) {
          query += this.genQuery(`, PRIMARY KEY(??)`, [newPrimaryKeys]);
        } else {
          query += this.genQuery(
            `alter TABLE ?? add constraint ?? PRIMARY KEY(??);`,
            [tableName, `${tableNameWithoutSchema}_pkey`, newPrimaryKeys],
          );
        }
      }
    }

    return query;
  }

  alterTableRemoveColumn(t, n, _o, existingQuery) {
    const shouldSanitize = true;
    let query = existingQuery ? ',' : '';
    query += this.genQuery(
      `ALTER TABLE ?? DROP COLUMN ??`,
      [t, n.cn],
      shouldSanitize,
    );
    return query;
  }

  createTableColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 0);
  }

  alterTableAddColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 1);
  }

  alterTableChangeColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 2);
  }

  createTable(table, args) {
    let query = '';

    for (let i = 0; i < args.columns.length; ++i) {
      query += this.createTableColumn(table, args.columns[i], null, query);
    }

    query += this.alterTablePK(table, args.columns, [], query, true);

    query = this.genQuery(`CREATE TABLE ?? (${query});`, [
      args.schema ? `${args.schema}.${args.tn}` : args.tn,
    ]);

    return query;
  }

  alterTableColumn(t, n, o, existingQuery, change = 2) {
    let query = '';

    const defaultValue = this.sanitiseDefaultValue(n.cdf);
    const shouldSanitize = true;

    if (change === 0) {
      query = existingQuery ? ',' : '';
      if (n.ai) {
        if (n.dt === 'int8' || n.dt.indexOf('bigint') > -1) {
          query += this.genQuery(` ?? bigserial`, [n.cn], shouldSanitize);
        } else if (n.dt === 'int2' || n.dt.indexOf('smallint') > -1) {
          query += this.genQuery(` ?? smallserial`, [n.cn], shouldSanitize);
        } else {
          query += this.genQuery(` ?? serial`, [n.cn], shouldSanitize);
        }
      } else {
        query += this.genQuery(
          ` ?? ${this.sanitiseDataType(n.dt)}`,
          [n.cn],
          shouldSanitize,
        );
        query += n.rqd ? ' NOT NULL' : ' NULL';
        query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
        query += n.unique ? ` UNIQUE` : '';
      }
    } else if (change === 1) {
      query += this.genQuery(
        ` ADD ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      query += n.rqd ? ' NOT NULL' : ' NULL';
      query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
      query += n.unique ? ` UNIQUE` : '';
      query = this.genQuery(`ALTER TABLE ?? ${query};`, [t], shouldSanitize);
    } else {
      if (n.cn !== o.cn) {
        query += this.genQuery(
          `\nALTER TABLE ?? RENAME COLUMN ?? TO ?? ;\n`,
          [t, o.cn, n.cn],
          shouldSanitize,
        );
      }

      if (n.dt !== o.dt) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? DROP DEFAULT;\n`,
          [t, n.cn],
          shouldSanitize,
        );

        if (
          [
            UITypes.Date,
            UITypes.DateTime,
            UITypes.Time,
            UITypes.Duration,
          ].includes(n.uidt)
        ) {
          query += pgQueries.dateConversionFunction.default.sql;
        }

        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? TYPE ${this.sanitiseDataType(
            n.dt,
          )} USING `,
          [t, n.cn],
          shouldSanitize,
        );

        const castedColumn = formatColumn(
          this.genQuery('??', [n.cn], shouldSanitize),
          o.uidt,
        );
        const limit = typeof n.dtxp === 'number' ? n.dtxp : null;
        const castQuery = generateCastQuery(
          n.uidt,
          n.dt,
          castedColumn,
          limit,
          n.meta?.date_format || 'YYYY-MM-DD',
        );

        query += this.genQuery(castQuery, [], shouldSanitize);
      }

      if (n.rqd !== o.rqd) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? `,
          [t, n.cn],
          shouldSanitize,
        );
        query += n.rqd ? ` SET NOT NULL;\n` : ` DROP NOT NULL;\n`;
      }

      if (n.cdf !== o.cdf) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? `,
          [t, n.cn],
          shouldSanitize,
        );
        query += n.cdf
          ? ` SET DEFAULT ${this.sanitiseDefaultValue(n.cdf)};\n`
          : ` DROP DEFAULT;\n`;
      }
    }
    return query;
  }

  get schema() {
    return this.connectionConfig?.searchPath?.[0] || 'public';
  }

  /**
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async totalRecords(args: any = {}) {
    const func = this.totalRecords.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const data = await this.sqlClient.raw(
        `SELECT SUM(n_live_tup) as TotalRecords FROM pg_stat_user_tables;`,
      );
      result.data = data.rows[0];
    } catch (e) {
      result.code = -1;
      result.message = e.message;
      result.object = e;
    } finally {
      log.api(`${func} :result: ${result}`);
    }
    return result;
  }

  // get default bytea output format
  async getDefaultByteaOutputFormat() {
    const func = this.getDefaultByteaOutputFormat.name;
    const result = new Result<'hex' | 'escape'>();
    log.api(`${func}:args:`, {});

    try {
      const data = await this.sqlClient.raw(`SHOW bytea_output;`);
      result.data = data.rows?.[0]?.bytea_output;
    } catch (e) {
      result.data = 'escape';
    } finally {
      log.api(`${func} :result: ${result}`);
    }
    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String} - args.tn_old
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableRename(args) {
    const _func = this.tableCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;

      /** ************** create table *************** */
      await this.sqlClient.raw(
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [
              this.getEffectiveSchema(args),
              args.tn_old,
            ]),
            args.tn,
          )
          .toQuery(),
      );

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [
              this.getEffectiveSchema(args),
              args.tn,
            ]),
            args.tn_old,
          )
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [
              this.getEffectiveSchema(args),
              args.tn_old,
            ]),
            args.tn,
          )
          .toQuery();

      /** ************** return files *************** */
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

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String} - args.indexName
   * @param {String} - args.non_unique
   * @param {String[]} - args.columns
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async indexCreate(args) {
    const _func = this.indexCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const indexName = args.indexName || null;

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      await this.sqlClient.raw(
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique) {
              table.index(args.columns, indexName);
            } else {
              table.unique(args.columns, indexName);
            }
          })
          .toQuery(),
      );

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique) {
              table.index(args.columns, indexName);
            } else {
              table.unique(args.columns, indexName);
            }
          })
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique) {
              table.dropIndex(args.columns, indexName);
            } else {
              table.dropUnique(args.columns, indexName);
            }
          })
          .toQuery();

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };

      // result.data.object = {
      //   upStatement,
      //   downStatement
      // };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String[]} - args.columns
   * @param {String} - args.indexName
   * @param {String} - args.non_unique
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async indexDelete(args) {
    const _func = this.indexDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const indexName = args.indexName || null;

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      await this.sqlClient.raw(
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique_original) {
              table.dropIndex(args.columns, indexName);
            } else {
              table.dropUnique(args.columns, indexName);
            }
          })
          .toQuery(),
      );

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique_original) {
              table.dropIndex(args.columns, indexName);
            } else {
              table.dropUnique(args.columns, indexName);
            }
          })
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique_original) {
              table.index(args.columns, indexName);
            } else {
              table.unique(args.columns, indexName);
            }
          })
          .toQuery();

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
}

export default PGClient;
