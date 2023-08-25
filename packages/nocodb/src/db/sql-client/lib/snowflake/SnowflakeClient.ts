import { nanoid } from 'nanoid';
import find from 'lodash/find';
import isEmpty from 'lodash/isEmpty';
import KnexClient from '../KnexClient';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import queries from './snowflake.queries';

const log = new Debug('SnowflakeClient');

const rowsToLower = (arr) => {
  for (const a of arr) {
    for (const [k, v] of Object.entries(a)) {
      delete a[k];
      a[k.toLowerCase()] = v;
    }
  }
  return arr;
};

class SnowflakeClient extends KnexClient {
  private queries: any;
  private _version: any;
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

      // const connectionParamsWithoutDb = JSON.parse(
      //   JSON.stringify(this.connectionConfig)
      // );
      //
      // delete connectionParamsWithoutDb.connection.database;
      //
      // const tempSqlClient = knex(connectionParamsWithoutDb);

      const data = await this.sqlClient.raw('create schema ?', [args.schema]);

      // postgres=# create database mydb;
      // postgres=# create user myuser with encrypted password 'mypass';
      // postgres=# grant all privileges on database mydb to myuser;

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
      const query = `${this.querySeparator()}DROP SEQUENCE ${
        args.sequence_name
      }`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: `${this.querySeparator()}CREATE SEQUENCE ${
              args.sequence_name
            }`,
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
      args.databaseName = this.database;
      const { rows } = await this.raw(`select *
              from "${this.database}".information_schema.sequences;`);

      result.data.list = rowsToLower(rows).map((seq) => {
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
        this.querySeparator() + `CREATE SEQUENCE ${args.sequence_name}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: this.querySeparator() + `DROP SEQUENCE ${args.sequence_name}`,
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
        `ALTER SEQUENCE ${args.original_sequence_name} RENAME TO ${args.sequence_name};`;
      const downQuery =
        this.querySeparator() +
        `ALTER SEQUENCE ${args.sequence_name} RENAME TO ${args.original_sequence_name};`;

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
    const func = this.testConnection.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      await this.sqlClient.raw('SELECT 1+1 as data');
    } catch (e) {
      // log.ppe(e);
      result.code = -1;
      result.message = e.message;
      result.object = e;
    } finally {
      if (result.code) {
        this.emitE(`TestConnection result: ${result.message}`);
      } else {
        this.emit(`TestConnection result: ${result.code}`);
      }
    }
    return result;
  }

  getKnexDataTypes() {
    const result = new Result();

    result.data.list = [
      'NUMBER',
      'DECIMAL',
      'NUMERIC',
      'INT',
      'INTEGER',
      'BIGINT',
      'SMALLINT',
      'TINYINT',
      'BYTEINT',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'DOUBLE',
      'DOUBLE PRECISION',
      'REAL',
      'VARCHAR',
      'CHAR',
      'CHARACTER',
      'STRING',
      'TEXT',
      'BINARY',
      'VARBINARY',
      'BOOLEAN',
      'DATE',
      'DATETIME',
      'TIME',
      'TIMESTAMP',
      'TIMESTAMP_LTZ',
      'TIMESTAMP_NTZ',
      'TIMESTAMP_TZ',
      'VARIANT',
      'OBJECT',
      'ARRAY',
      'GEOGRAPHY',
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
      const data = await this.sqlClient.raw(
        'SELECT CURRENT_VERSION() as "server_version"',
      );
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
      let rows = [];
      try {
        log.debug('checking if db exists');
        rows = (
          await this.sqlClient.raw(
            `SELECT DATABASE_NAME as database FROM SNOWFLAKE.information_schema.DATABASES WHERE DATABASE_NAME = ??`,
            [args.database],
          )
        ).rows;
      } catch (e) {
        log.debug('db does not exist');
      }
      if (rows.length === 0) {
        log.debug('creating database:', args);
        await this.sqlClient.raw(`CREATE DATABASE ??`, [args.database]);
      }

      await this.sqlClient.raw(`CREATE SCHEMA IF NOT EXISTS ??.??`, [
        args.database,
        this.schema,
      ]);
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

  async dropDatabase(args) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.sqlClient.raw(`DROP DATABASE ${args.database};`);
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
        `SELECT table_schema,table_name as "tn", table_catalog
          FROM "${this.database}".information_schema.tables
          where table_schema=? and table_name = ?`,
        [this.schema, args.tn],
      );

      if (exists.rows.length === 0) {
        const data = await this.sqlClient.schema.createTable(
          args.tn,
          function (table) {
            table.increments();
            table.string('title').notNullable();
            table.string('titleDown').nullable();
            table.string('description').nullable();
            table.integer('batch').nullable();
            table.string('checksum').nullable();
            table.integer('status').nullable();
            table.dateTime('created');
            table.timestamps();
          },
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

  async hasTable(args: any = {}) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT table_schema,table_name as "tn", table_catalog FROM "${this.database}".information_schema.tables where table_schema = ? and table_name = ? and table_catalog = ?`,
        [this.schema, args.tn, this.database],
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
        `SELECT DATABASE_NAME as database FROM SNOWFLAKE.information_schema.DATABASES WHERE DATABASE_NAME = ?`,
        [args.databaseName],
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
      const { rows } = await this.sqlClient.raw(
        `SELECT DATABASE_NAME as database_name FROM SNOWFLAKE.information_schema.DATABASES;`,
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
        `SELECT table_schema as "ts", table_name as "tn", table_type as "table_type"
              FROM "${this.database}".information_schema.tables
              where table_schema = ?
              ORDER BY table_schema, table_name`,
        [this.schema],
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
      const { rows } = await this.raw(
        `SELECT SCHEMA_NAME as "schema_name" FROM "${this.database}".information_schema.SCHEMATA order by schema_name;`,
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
      args.databaseName = this.database;
      await this.sqlClient.raw(
        `SHOW PRIMARY KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );
      await this.sqlClient.raw(
        `SHOW UNIQUE KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );

      const lastQueries = await this.sqlClient.raw(`
        select * from table("${this.database}".information_schema.query_history())
        WHERE query_text like 'SHOW%'
        ORDER BY start_time DESC
        LIMIT 30;`);

      let pk_query_id, uq_query_id;
      for (const r of lastQueries.rows) {
        if (
          r.QUERY_TEXT ===
          `SHOW PRIMARY KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          pk_query_id = r.QUERY_ID;
        } else if (
          r.QUERY_TEXT ===
          `SHOW UNIQUE KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          uq_query_id = r.QUERY_ID;
        }
        if (pk_query_id && uq_query_id) {
          break;
        }
      }

      const response = await this.sqlClient.raw(
        `SELECT
            cl.table_name as "tn",
            column_name as "cn",
            data_type as "dt",
            is_identity as "au",
            tc.constraint_type as "ck",
            character_maximum_length as "clen",
            numeric_precision as "np",
            numeric_scale as "ns",
            ordinal_position as "cop",
            is_nullable as "nrqd",
            column_default as "cdf",
            identity_generation as "generation_expression",
            character_octet_length as "character_octet_length",
            character_set_name as "csn",
            "PK"."key_sequence" as "pk_ordinal_position",
            "PK"."constraint_name" as "pk_constraint_name",
            udt_name
        FROM "${this.database}".information_schema.COLUMNS cl
        LEFT JOIN (select * from table(result_scan('${pk_query_id}')) UNION select * from table(result_scan('${uq_query_id}'))) pk
        LEFT JOIN "${this.database}".information_schema.table_constraints tc ON tc.constraint_name = "PK"."constraint_name" 
        ON "PK"."schema_name" = cl.table_schema and "PK"."table_name" = cl.table_name and pk."column_name" = cl.column_name
        WHERE cl.table_catalog = ? and cl.table_schema = ? and cl.table_name = ?;`,
        [this.database, this.schema, args.tn],
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
        if (response.rows[i].au) {
          column.ai = response.rows[i].au === 'YES';
        }

        // todo : need to find if column is unique or not
        // column['unique'] = response.rows[i]['cst'].indexOf('UNIQUE') === -1 ? false : true;

        column.cdf = response.rows[i].cdf;
        // ? response.rows[i].cdf.split("::")[0].replace(/'/g, "")
        // : response.rows[i].cdf;

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
      // TODO indexList
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
      await this.sqlClient.raw(
        `SHOW PRIMARY KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );
      await this.sqlClient.raw(
        `SHOW UNIQUE KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );

      const lastQueries = await this.sqlClient.raw(`
        select * from table("${this.database}".INFORMATION_SCHEMA.query_history())
        WHERE query_text like 'SHOW%'
        ORDER BY start_time DESC
        LIMIT 30;`);

      let pk_query_id, uq_query_id;
      for (const r of lastQueries.rows) {
        if (
          r.QUERY_TEXT ===
          `SHOW PRIMARY KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          pk_query_id = r.QUERY_ID;
        } else if (
          r.QUERY_TEXT ===
          `SHOW UNIQUE KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          uq_query_id = r.QUERY_ID;
        }
        if (pk_query_id && uq_query_id) {
          break;
        }
      }

      const { rows } = await this.sqlClient.raw(
        `SELECT
            constraint_name as "cstn",
            "PK"."column_name" as "cn",
            constraint_type as "cst"
        FROM "${this.database}".information_schema.table_constraints tc
        LEFT JOIN (select * from table(result_scan('${pk_query_id}')) UNION select * from table(result_scan('${uq_query_id}'))) pk
        ON "PK"."constraint_name" = tc.constraint_name
        WHERE tc.table_catalog = ? and tc.table_schema = ? and tc.table_name = ?;`,
        [this.database, this.schema, args.tn],
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
      await this.sqlClient.raw(
        `SHOW IMPORTED KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );

      const lastQueries = await this.sqlClient.raw(`
        select * from table("${this.database}".information_schema.query_history())
        WHERE query_text like 'SHOW%'
        ORDER BY start_time DESC
        LIMIT 30;`);

      let ik_query_id;
      for (const r of lastQueries.rows) {
        if (
          r.QUERY_TEXT ===
          `SHOW IMPORTED KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          ik_query_id = r.QUERY_ID;
          break;
        }
      }

      const { rows } = await this.sqlClient.raw(
        `SELECT
            constraint_name as "cstn",
            "PK"."fk_table_name" as "tn",
            "PK"."fk_column_name" as "cn",
            "PK"."pk_schema_name" as "foreign_table_schema",
            "PK"."pk_table_name" as "rtn",
            "PK"."pk_column_name" as "rcn",
            "PK"."update_rule" as "ur",
            "PK"."delete_rule" as "dr"
        FROM "${this.database}".information_schema.table_constraints tc
        LEFT JOIN (select * from table(result_scan('${ik_query_id}'))) pk
        ON "PK"."fk_name" = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' and tc.table_catalog = ? and tc.table_schema = ? and tc.table_name = ?;`,
        [this.database, this.schema, args.tn],
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
    const _func = this.relationListAll.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.sqlClient.raw(
        `SHOW IMPORTED KEYS IN SCHEMA "${this.database}"."${this.schema}";`,
      );

      const lastQueries = await this.sqlClient.raw(`
        select * from table("${this.database}".information_schema.query_history())
        WHERE query_text like 'SHOW%'
        ORDER BY start_time DESC
        LIMIT 30;`);

      let ik_query_id;
      for (const r of lastQueries.rows) {
        if (
          r.QUERY_TEXT ===
          `SHOW IMPORTED KEYS IN SCHEMA "${this.database}"."${this.schema}";`
        ) {
          ik_query_id = r.QUERY_ID;
          break;
        }
      }

      const { rows } = await this.sqlClient.raw(
        `SELECT
            constraint_name as "cstn",
            "PK"."fk_table_name" as "tn",
            "PK"."fk_column_name" as "cn",
            "PK"."pk_schema_name" as "foreign_table_schema",
            "PK"."pk_table_name" as "rtn",
            "PK"."pk_column_name" as "rcn",
            "PK"."update_rule" as "ur",
            "PK"."delete_rule" as "dr"
        FROM "${this.database}".information_schema.table_constraints tc
        LEFT JOIN (select * from table(result_scan('${ik_query_id}'))) pk
        ON "PK"."fk_name" = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' and tc.table_catalog = ? and tc.table_schema = ?;`,
        [this.database, this.schema],
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

    // todo: update query - https://dataedo.com/kb/query/postgresql/list-stored-procedures
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
      const { rows } = await this.sqlClient.raw(
        `select * from "${this.database}".INFORMATION_SCHEMA.views WHERE table_schema = ?;`,
        [this.schema],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].view_name = rows[i].TABLE_NAME;
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
      args.databaseName = this.database;

      const { rows } = await this.sqlClient.raw(
        `select * from "${this.database}".INFORMATION_SCHEMA.views WHERE table_name='${args.view_name}' and table_schema = '${this.schema}';`,
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].view_name = rows[i].TABLE_NAME;
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
      await this.sqlClient.raw(`create schema ${args.database_name}`);
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
      await this.sqlClient.raw(`drop schema ${args.database_name}`);
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
      throw new Error('Function not supported for Snowflake yet');
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
      `DROP FUNCTION IF EXISTS ${args.function_declaration}`;
    const downQuery = this.querySeparator() + args.create_function;
    try {
      throw new Error('Function not supported for Snowflake yet');
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
      throw new Error('Function not supported for Snowflake yet');
      await this.sqlClient.raw(
        `DROP PROCEDURE IF EXISTS ${args.procedure_name}`,
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
      throw new Error('Function not supported for Snowflake yet');
      const upQuery = this.querySeparator() + args.create_function;

      await this.sqlClient.raw(upQuery);

      const functionCreated = await this.functionRead({
        function_name: args.function_name,
      });

      const downQuery =
        this.querySeparator() +
        `DROP FUNCTION IF EXISTS ${functionCreated.data.list[0].function_declaration}`;

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
      throw new Error('Function not supported for Snowflake yet');
      const upQuery = this.querySeparator() + args.create_function;
      let downQuery = this.querySeparator() + args.oldCreateFunction;

      await this.sqlClient.raw(
        `DROP FUNCTION IF EXISTS ${args.function_declaration};`,
      );
      await this.sqlClient.raw(upQuery);

      const functionCreated = await this.functionRead({
        function_name: args.function_name,
      });

      downQuery =
        `DROP FUNCTION IF EXISTS ${functionCreated.data.list[0].function_declaration};` +
        downQuery;

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
      throw new Error('Function not supported for Snowflake yet');
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER \`${args.procedure_name}\` \n${args.timing} ${
          args.event
        }\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${args.statement}`;
      await this.sqlClient.raw(upQuery);
      const downQuery =
        this.querySeparator() +
        `DROP PROCEDURE IF EXISTS ${args.procedure_name}`;
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
      throw new Error('Function not supported for Snowflake yet');
      const query =
        this.querySeparator() + `DROP TRIGGER ${args.procedure_name}`;
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER \`${args.procedure_name}\` \n${args.timing} ${
          args.event
        }\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${args.statement}`;

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
      throw new Error('Function not supported for Snowflake yet');
      const upQuery =
        this.querySeparator() +
        `CREATE TRIGGER ${args.trigger_name} \n${args.timing} ${
          args.event
        }\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${args.statement}`;
      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [
          { sql: this.querySeparator() + `DROP TRIGGER ${args.trigger_name}` },
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
      throw new Error('Function not supported for Snowflake yet');
      await this.sqlClient.raw(
        `DROP TRIGGER ${args.trigger_name} ON ${args.tn}`,
      );
      await this.sqlClient.raw(
        `CREATE TRIGGER ${args.trigger_name} \n${args.timing} ${
          args.event
        }\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${args.statement}`,
      );

      result.data.object = {
        upStatement:
          this.querySeparator() +
          `DROP TRIGGER ${args.trigger_name} ON ${
            args.tn
          };${this.querySeparator()}CREATE TRIGGER ${args.trigger_name} \n${
            args.timing
          } ${args.event}\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${
            args.statement
          }`,
        downStatement:
          this.querySeparator() +
          `CREATE TRIGGER ${args.trigger_name} \n${args.timing} ${
            args.event
          }\nON ${this.getTnPath(args.tn)} FOR EACH ROW\n${args.oldStatement}`,
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
          { sql: this.querySeparator() + `DROP VIEW "${args.view_name}"` },
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
      const query = `CREATE OR REPLACE VIEW "${args.view_name}" AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: this.querySeparator() + query,
        downStatement:
          this.querySeparator() +
          `CREATE VIEW "${args.view_name}" AS \n${args.oldViewDefination}`,
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
      const query = `DROP VIEW ${args.view_name}`;

      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `CREATE VIEW "${args.view_name}" AS \n${args.oldViewDefination}`,
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
      await this.sqlClient.schema.raw(upQuery);

      const downStatement =
        this.querySeparator() +
        this.sqlClient
          .raw(`DROP TABLE ??`, [this.getTnPath(args.table)])
          .toString();

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

      for (const q of upQuery.split(';')) {
        if (q && q.trim() !== '') {
          await this.sqlClient.raw(q);
        }
      }

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
        this.sqlClient
          .raw(`DROP TABLE ??`, [this.getTnPath(args.tn)])
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
        const downQb = this.sqlClient.schema.table(
          relation.tn,
          function (table) {
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
          },
        );
        await downQb;
        downQuery += this.querySeparator() + downQb.toQuery();
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
      await this.sqlClient.raw(`DROP TABLE ??`, [this.getTnPath(args.tn)]);

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

    try {
      await this.sqlClient.schema.table(args.childTable, (table) => {
        table = table
          .foreign(args.childColumn, foreignKeyName)
          .references(args.parentColumn)
          .on(this.getTnPath(args.parentTable));

        if (args.onUpdate) {
          table = table.onUpdate(args.onUpdate);
        }
        if (args.onDelete) {
          table.onDelete(args.onDelete);
        }
      });

      const upQb = this.sqlClient.schema.table(args.childTable, (table) => {
        table = table
          .foreign(args.childColumn, foreignKeyName)
          .references(args.parentColumn)
          .on(this.getTnPath(args.parentTable));

        if (args.onUpdate) {
          table = table.onUpdate(args.onUpdate);
        }
        if (args.onDelete) {
          table.onDelete(args.onDelete);
        }
      });

      await upQb;

      const upStatement = this.querySeparator() + upQb.toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTable, (table) => {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      // let files = this.evolutionFilesCreate(args, upStatement, downStatement);
      //
      // // create a migration file
      // //let files = this.evolutionForCreateRel(args);
      //
      // await this.sqlClient('xc_evolutions').insert({
      //   title: files.up,
      //   titleDown: files.down,
      //   description: '',
      //   status: 0
      //   //created: Date.now()
      // })

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

    try {
      // const self = this;

      await this.sqlClient.schema.table(args.childTable, function (table) {
        table.dropForeign(args.childColumn, foreignKeyName);
      });

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTable, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      const downStatement =
        this.querySeparator() +
        (await this.sqlClient.schema
          .table(args.childTable, (table) => {
            table
              .foreign(args.childColumn, foreignKeyName)
              .references(args.parentColumn)
              .on(this.getTnPath(args.parentTable));
          })
          .toQuery());

      // let files = this.evolutionFilesCreate(args, upStatement, downStatement);
      //
      // // create a migration file
      // //let files = this.evolutionForCreateRel(args);
      //
      // await this.sqlClient('xc_evolutions').insert({
      //   title: files.up,
      //   titleDown: files.down,
      //   description: '',
      //   status: 0
      //   //created: Date.now()
      // })

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
    const _func = this.tableInsertStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `INSERT INTO ?? (`;
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
      result.data = this.genQuery(result.data, [this.getTnPath(args.tn)]);
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
      result.data = `UPDATE ?? \nSET\n`;
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
      result.data = this.genQuery(result.data, [this.getTnPath(args.tn)]);
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
      result.data = `DELETE FROM ?? where ;`;
      result.data = this.genQuery(result.data, [this.getTnPath(args.tn)]);
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
      result.data = `TRUNCATE TABLE ??`;
      result.data = this.genQuery(result.data, [this.getTnPath(args.tn)]);
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

      result.data += ` FROM ??;`;
      result.data = this.genQuery(result.data, [this.getTnPath(args.tn)]);
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
          query += this.genQuery(`, constraint ?? PRIMARY KEY (??)`, [
            `${t}_pkey`,
            numOfPksInNew,
          ]);
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
      [this.getTnPath(t), n.cn],
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
      this.getTnPath(args.tn),
    ]);

    return query;
  }

  alterTableColumn(t, n, o, existingQuery, change = 2) {
    let query = '';

    const defaultValue = this.sanitiseDefaultValue(n);
    const shouldSanitize = true;

    if (change === 0) {
      query = existingQuery ? ',' : '';
      if (n.ai) {
        query += this.genQuery(
          ` ?? NUMBER(38,0) NOT NULL autoincrement UNIQUE`,
          [n.cn],
          shouldSanitize,
        );
      } else {
        query += this.genQuery(
          ` ?? ${this.sanitiseDataType(n.dt)}`,
          [n.cn],
          shouldSanitize,
        );
        query += n.dtxp && n.dt !== 'text' ? `(${n.dtxp})` : '';
        query += n.rqd ? ' NOT NULL' : ' NULL';
        query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
      }
    } else if (change === 1) {
      query += this.genQuery(
        ` ADD ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      query += n.dtxp && n.dt !== 'text' ? `(${n.dtxp})` : '';
      query += n.rqd ? ' NOT NULL' : ' NULL';
      query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
      query = this.genQuery(
        `ALTER TABLE ?? ${query};`,
        [this.getTnPath(t)],
        shouldSanitize,
      );
    } else {
      if (n.cn !== o.cn) {
        query += this.genQuery(
          `\nALTER TABLE ?? RENAME COLUMN ?? TO ?? ;\n`,
          [this.getTnPath(t), o.cn, n.cn],
          shouldSanitize,
        );
      }

      if (n.dt !== o.dt) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? SET DATA TYPE ${this.sanitiseDataType(
            n.dt,
          )}`,
          [this.getTnPath(t), n.cn],
          shouldSanitize,
        );
        query += n.dtxp && n.dt !== 'text' ? `(${n.dtxp});\n` : ';\n';
      }

      if (n.rqd !== o.rqd) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? `,
          [this.getTnPath(t), n.cn],
          shouldSanitize,
        );
        query += n.rqd ? ` SET NOT NULL;\n` : ` DROP NOT NULL;\n`;
      }

      if (n.cdf !== o.cdf) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? `,
          [this.getTnPath(t), n.cn],
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
    return this.connectionConfig && this.connectionConfig.connection.schema;
  }

  get database() {
    return this.connectionConfig && this.connectionConfig.connection.database;
  }

  getTnPath(t) {
    return `${this.database}.${this.schema}.${t}`;
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
        `SELECT SUM(record_count) as "TotalRecords" FROM 
        (SELECT t.table_schema || '.' ||  t.table_name as "table_name",t.row_count as record_count
          FROM "${this.database}".information_schema.tables t
          WHERE t.table_type = 'BASE TABLE and table_schema = ?'
        )`,
        [this.schema],
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

  // Todo: error handling
  async insert(args) {
    const { tn, data } = args;
    const res = await this.sqlClient(tn).insert(data);
    log.debug(res);
    return res;
  }

  async update(args) {
    const { tn, data, whereConditions } = args;
    const res = await this.sqlClient(tn).where(whereConditions).update(data);
    return res;
  }

  async delete(args) {
    const { tn, whereConditions } = args;
    const res = await this.sqlClient(tn).where(whereConditions).del();
    log.debug(res);
    return res;
  }
}

export default SnowflakeClient;
