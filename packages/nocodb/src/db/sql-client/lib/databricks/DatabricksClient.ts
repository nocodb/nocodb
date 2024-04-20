import { nanoid } from 'nanoid';
import knex from 'knex';
import isEmpty from 'lodash/isEmpty';
import find from 'lodash/find';
import axios from 'axios';
import KnexClient from '~/db/sql-client/lib/KnexClient';
import Debug from '~/db/util/Debug';
import Result from '~/db/util/Result';
import { ExternalError } from '~/helpers/catchError';

const log = new Debug('DatabricksClient');

const isKnexWrapped = Symbol('isKnexWrapped');

async function runExternal(query: string, config: any) {
  const { dbMux, sourceId, ...rest } = config;

  try {
    const { data } = await axios.post(`${dbMux}/query/${sourceId}`, {
      query,
      config: rest,
      raw: true,
    });
    return data;
  } catch (e) {
    if (e.response?.data?.error) {
      throw new ExternalError(e.response.data.error);
    }
    throw e;
  }
}

class DatabricksClient extends KnexClient {
  protected queries: any;
  protected _version: any;
  constructor(connectionConfig) {
    super(connectionConfig);

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
              if (self.sqlClient && self.sqlClient.isExternal) {
                return runExternal(builder.toQuery(), self.sqlClient.extDb)
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
      result.data.list = [];
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
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      // send back original error message
      result.message = e.message;
    } finally {
      log.api(`${_func}:result:`, result);
    }

    return result;
  }

  getKnexDataTypes() {
    const result = new Result();

    result.data.list = [
      'BIGINT',
      'BINARY',
      'BOOLEAN',
      'DATE',
      'DECIMAL',
      'DOUBLE',
      'FLOAT',
      'INT',
      'INTERVAL',
      'VOID',
      'SMALLINT',
      'STRING',
      'TIMESTAMP',
      'TIMESTAMP_NTZ',
      'TINYINT',
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

    try {
      // check if catalog exists
      const catalogs = await this.sqlClient.raw(`SHOW CATALOGS LIKE ?`, [
        args.database,
      ]);

      if (catalogs.length === 0) {
        throw new Error(
          'We do not support creating catalogs yet, please use an existing catalog',
        );
      }

      // check if database exists
      const databases = await this.sqlClient.raw(`SHOW DATABASES LIKE ?`, [
        args.schema,
      ]);

      if (databases.length === 0) {
        await this.sqlClient.raw(`CREATE DATABASE ${args.schema}`);
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  async dropDatabase(args) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig),
      );
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
        [this.schema, args.tn, this.connectionConfig.connection.database],
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
      const rows = await this.sqlClient.raw(
        `SELECT table_schema,table_name as tn, table_catalog FROM information_schema.tables where table_schema=? and table_name = ?'`,
        [this.schema, args.tn],
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
      const rows = await this.sqlClient.raw(
        `SELECT schema_name FROM schemata WHERE schema_name = ?`,
        [args.database],
      );
      result.data.value = rows.length > 0;
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
      const rows = await this.sqlClient.raw(
        `SELECT datname as schema_name
           FROM schemata;`,
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
      const rows = await this.raw(
        `SELECT table_schema as ts, table_name as tn,table_type
              FROM information_schema.tables
              where table_schema = ?
              ORDER BY table_schema, table_name`,
        [this.schema],
      );

      result.data.list = rows;
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
      const rows = await this.raw(
        `SELECT schema_name FROM schemata WHERE order by schema_name;`,
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
      let response = await this.sqlClient.raw(
        `SELECT 
        c.table_name as tn,
        c.column_name as cn,
        c.full_data_type as dt,
        c.numeric_precision as np,
        c.numeric_scale as ns,
        c.character_maximum_length as clen,
        c.datetime_precision as dp,
        c.column_default as cdf,
        c.is_nullable as nrqd,
        c.is_identity as ii,
        c.ordinal_position as cop,
        c.generation_expression,
        c.character_octet_length,
        pk.constraint_type as ck,
        pk.constraint_name as pk_constraint_name,
        c.comment as cc
        FROM information_schema.columns c
          left join
          ( select kc.constraint_name, kc.table_name,kc.column_name, kc.ordinal_position,tc.constraint_type
            from information_schema.key_column_usage kc
              inner join information_schema.table_constraints as tc
                on kc.constraint_name = tc.constraint_name 
                and kc.constraint_schema = tc.constraint_schema and tc.constraint_type in ('PRIMARY KEY')
            order by table_name,ordinal_position ) pk
          on
          pk.table_name = c.table_name and pk.column_name=c.column_name
        WHERE c.table_name = ?`,
        [args.tn],
      );

      const columns = [];

      // TODO: fix in driver
      response = {
        rows: response,
      };

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
        column.dtx = response.rows[i].dt;

        column.ai = false;

        column.pk = response.rows[i].ck === 'PRIMARY KEY';

        if (column.pk && column.cn === 'id') {
          column.meta = {
            ag: 'nc',
          };
        } else if (
          column.pk &&
          column.cdf === null &&
          column.generation_expression === null
        ) {
          column.meta = {
            ag: 'nc',
          };
        }

        column.nrqd = response.rows[i].nrqd !== 'NO';
        column.not_nullable = !column.nrqd;
        column.rqd = !column.nrqd;

        // todo: there is no type of unsigned in postgres
        response.rows[i].ct = response.rows[i].dt || '';
        column.un = response.rows[i].ct.indexOf('unsigned') !== -1;

        column.cdf = response.rows[i].cdf
          ? response.rows[i].cdf
              .replace(/::[\w (),]+$/, '')
              .replace(/^'|'$/g, '')
          : response.rows[i].cdf;

        column.cc = response.rows[i].cc;

        column.dtxp =
          response.rows[i].clen || response.rows[i].np || response.rows[i].dp;
        column.dtxs = response.rows[i].ns;

        if (response.rows[i].ii === 'YES') {
          column.ai = true;
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
      result.data.list = [];
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

    args.childTableWithSchema = args.childTable;

    args.parentTableWithSchema = args.parentTable;

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
      const rows = await this.sqlClient.raw(
        `SELECT DISTINCT
          tc.table_schema AS ts,
          tc.constraint_name AS cstn,
          tc.table_name AS tn,
          kcu.column_name AS cn,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS rtn,
          ccu.column_name AS rcn
        FROM
          INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE
          tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema=:schema
          AND tc.table_name=:table;`,
        {
          schema: this.schema.toLowerCase(),
          table: (args.tn as string).toLowerCase(),
        },
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
      const rows = await this.sqlClient.raw(
        `SELECT DISTINCT
          tc.table_schema AS ts,
          tc.constraint_name AS cstn,
          tc.table_name AS tn,
          kcu.column_name AS cn,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS rtn,
          ccu.column_name AS rcn
        FROM
          INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE
          tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema=?;`,
        [this.schema.toLowerCase()],
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
      result.data.list = [];
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
      result.data.list = [];
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

    try {
      result.data.list = [];
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
      const rows = await this.sqlClient.raw(
        `select *
           from INFORMATION_SCHEMA.views
           WHERE table_schema = ?;`,
        [this.schema],
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
      result.data.list = [];
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
      result.data.list = [];
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
      result.data.list = [];
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
      result.data.list = [];
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
      await this.executeRawQuery(upQuery);

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

  async afterTableCreate(_args) {
    const result = { upStatement: [], downStatement: [] };
    return result;
  }

  async afterTableUpdate(_args) {
    const result = { upStatement: [], downStatement: [] };
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
      args.table = args.tn;
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

      if (upQuery !== '') await this.executeRawQuery(upQuery);

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
        this.sqlClient.schema.dropTable(args.tn).toString();
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
        this.sqlClient.schema.dropTable(args.tn).toQuery(),
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

  alterTablePK(t, n, o, _existingQuery, createTable = false) {
    const numOfPksInOriginal = [];
    const numOfPksInNew = [];
    let pksChanged = 0;

    for (let i = 0; i < n.length; ++i) {
      if (n[i].pk) {
        if (n[i].altered !== 4) numOfPksInNew.push(n[i].cn);
      }
    }

    for (let i = 0; i < o.length; ++i) {
      if (o[i].pk) {
        numOfPksInOriginal.push(o[i].cn);
      }
    }

    if (numOfPksInNew.length === numOfPksInOriginal.length) {
      for (let i = 0; i < numOfPksInNew.length; ++i) {
        if (numOfPksInOriginal[i] !== numOfPksInNew[i]) {
          pksChanged = 1;
          break;
        }
      }
    } else {
      pksChanged = numOfPksInNew.length - numOfPksInOriginal.length;
    }

    let query = '';
    if (!numOfPksInNew.length && !numOfPksInOriginal.length) {
      // do nothing
    } else if (pksChanged) {
      query += numOfPksInOriginal.length
        ? this.genQuery(`alter TABLE ?? drop constraint IF EXISTS ??;`, [
            t,
            `${t}_pkey`,
          ])
        : '';
      if (numOfPksInNew.length) {
        if (createTable) {
          query += this.genQuery(`, PRIMARY KEY(??)`, [numOfPksInNew]);
        } else {
          query += this.genQuery(
            `alter TABLE ?? add constraint ?? PRIMARY KEY(??);`,
            [t, `${t}_pkey`, numOfPksInNew],
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
    query = this.genQuery(
      `CREATE TABLE ?? (${query}) TBLPROPERTIES('delta.columnMapping.mode' = 'name', 'delta.minReaderVersion' = '2', 'delta.minWriterVersion' = '5');`,
      [args.tn],
    );

    return query;
  }

  alterTableColumn(t, n, o, existingQuery, change = 2) {
    let query = '';

    const defaultValue = this.sanitiseDefaultValue(n.cdf);
    const shouldSanitize = true;

    if (change === 0) {
      query = existingQuery ? ',' : '';
      if (n.ai) {
        query += this.genQuery(
          ` ?? VARCHAR(255) PRIMARY KEY`,
          [n.cn],
          shouldSanitize,
        );
      } else {
        query += this.genQuery(
          ` ?? ${this.sanitiseDataType(n.dt)}`,
          [n.cn],
          shouldSanitize,
        );
        query += n.rqd ? ' NOT NULL' : '';
        query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
      }
    } else if (change === 1) {
      query += this.genQuery(
        ` ADD COLUMN ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      query += n.rqd ? ' NOT NULL' : '';
      query = this.genQuery(`ALTER TABLE ?? ${query};`, [t], shouldSanitize);

      if (defaultValue) {
        query += this.genQuery(
          `ALTER TABLE ?? ALTER COLUMN ?? SET DEFAULT ${defaultValue};`,
          [t, n.cn],
          shouldSanitize,
        );
      }
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
          `\nALTER TABLE ?? ALTER COLUMN ?? TYPE ${this.sanitiseDataType(
            n.dt,
          )};\n`,
          [t, n.cn],
          shouldSanitize,
        );
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

  get schema(): string {
    return (
      (this.connectionConfig &&
        this.connectionConfig.connection &&
        this.connectionConfig.connection.schema) ||
      'default'
    );
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
            this.sqlClient.raw('??.??', [this.schema, args.tn_old]),
            args.tn,
          )
          .toQuery(),
      );

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [this.schema, args.tn]),
            args.tn_old,
          )
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [this.schema, args.tn_old]),
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

  async executeRawQuery(query) {
    const queries = query.split(';');
    const response = [];

    for (const q of queries) {
      if (q.trim()) {
        response.push(await this.sqlClient.raw(q));
      }
    }

    return response.length === 1 ? response[0] : response;
  }
}
export default DatabricksClient;
