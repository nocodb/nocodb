import path from 'path';
import { promisify } from 'util';
import knex from 'knex';
import isEmpty from 'lodash/isEmpty';
import mapKeys from 'lodash/mapKeys';
import find from 'lodash/find';
import jsonfile from 'jsonfile';
import mkdirp from 'mkdirp';
import { nanoid } from 'nanoid';
import levenshtein from 'fast-levenshtein';
import Debug from '../../../util/Debug';
import Emit from '../../../util/emit';
import Result from '../../../util/Result';
import KnexClient from '../KnexClient';
import queries from './mysql.queries';
import fakerFunctionList from './fakerFunctionList';
import * as findDataType from './findDataTypeMapping';

const log = new Debug('MysqlClient');
const evt = new Emit();

class MysqlClient extends KnexClient {
  private queries: any;
  private _version: any;
  private types: any;

  constructor(connectionConfig) {
    super(connectionConfig);
    this.queries = queries;
    this._version = {};
  }

  emit(data) {
    log.api(data);
    evt.evt.emit('UI', {
      status: 0,
      data: `SQL : ${data}`,
    });
  }

  emitW(data) {
    log.warn(data);
    evt.evt.emit('UI', {
      status: 1,
      data: `SQL : ${data}`,
    });
  }

  emitE(data) {
    log.error(data);
    evt.evt.emit('UI', {
      status: -1,
      data: `SQL : ${data}`,
    });
  }

  /**
   *
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async schemaCreateWithCredentials(args): Promise<any> {
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

      const data = await this.sqlClient.raw(
        'create database if not exists ??',
        [args.schema],
      );

      await this.sqlClient.raw(
        `CREATE USER ?@'localhost' IDENTIFIED WITH mysql_native_password BY ?`,
        [args.user, args.password],
      );
      await this.sqlClient.raw(
        `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, DROP, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES PRIVILEGES ON ??.* TO ?@'localhost'`,
        [args.schema, args.user],
      );
      await this.sqlClient.raw(`FLUSH PRIVILEGES`);

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
   *
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
      // await this.sqlClient.raw(this.getQuery(_func))
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
      'tinyint',
      'smallint',
      'mediumint',
      'bigint',
      'float',
      'decimal',
      'double',
      'real',
      'bit',
      'boolean',
      'serial',
      'date',
      'datetime',
      'timestamp',
      'time',
      'year',
      'char',
      'varchar',
      'nchar',
      // "nvarchar",
      'text',
      'tinytext',
      'mediumtext',
      'longtext',
      'binary',
      'varbinary',
      'blob',
      'tinyblob',
      'mediumblob',
      'longblob',
      'enum',
      'set',
      'time',
      'geometry',
      'point',
      'linestring',
      'polygon',
      'multipoint',
      'multilinestring',
      'multipolygon',
      // "geometrycollection",
      'json',
    ];

    return result;
  }

  /**
   * Returns mysql version
   *
   * @param {Object} args - for future reasons
   * @returns {Object} result
   * @returns {Number} result.code
   * @returns {String} result.message
   * @returns {Object} result.data
   * @returns {Object} result.data.object - {version, primary, major, minor,key}
   */
  async version(args?: any) {
    const func = this.version.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      result.data.object = {};
      const data = await this.sqlClient.raw('select version() as version');
      log.debug(data[0][0]);
      result.data.object.version = data[0][0].version;
      const versions = data[0][0].version.split('.');

      if (versions.length && versions.length === 3) {
        result.data.object.primary = versions[0];
        result.data.object.major = versions[1];
        result.data.object.minor = versions[2];
        result.data.object.key = versions[0] + versions[1];
      } else {
        result.code = -1;
        result.message = `Invalid version : ${data[0][0].version}`;
      }
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${func} :result: %o`, result);
    }
    return result;
  }

  /**
   *
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   * @returns {String[]} list
   */
  async getDataTypes(args: any = {}) {
    const func = this.getDataTypes.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      await this.version();
      if (this._version.key in this.types) {
        result.data.list = this.types[this._version.key];
      } else {
        result.data.list = this.types.default;
      }
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${func} :result: ${result}`);
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
    const func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${func}:args:`, args, this.connectionConfig);

    try {
      // create a new knex client without database param
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig),
      );

      delete connectionParamsWithoutDb.connection.database;

      const tempSqlClient = knex(connectionParamsWithoutDb);

      const data = await tempSqlClient.raw(this.queries[func].default.sql, [
        args.database,
      ]);

      log.debug('Create database if not exists', data);

      // create new knex client
      this.sqlClient = knex(this.connectionConfig);
      await tempSqlClient.destroy();
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  async dropDatabase(args: any = {}) {
    const func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      log.api('dropping database:', args);
      await this.sqlClient.raw(this.queries[func].default.sql, [args.database]);
    } catch (e) {
      if (e) log.ppe(e.message, func);
    }
    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param args {tn}
   * @returns
   */
  async createTableIfNotExists(args: any = {}) {
    const func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      /** ************** START : create _evolution table if not exists *************** */
      const exists = await this.sqlClient.schema.hasTable(args.tn);

      if (!exists) {
        await this.sqlClient.schema.createTable(args.tn, function (table) {
          table.increments();
          table.string('title').notNullable();
          table.string('titleDown').nullable();
          table.string('description').nullable();
          table.integer('batch').nullable();
          table.string('checksum').nullable();
          table.integer('status').nullable();
          table.dateTime('created');
          table.timestamps();
        });
        log.debug('Table created:', `${args.tn}`);
      } else {
        log.debug(`${args.tn} tables exists`);
      }
      /** ************** END : create _evolution table if not exists *************** */
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);

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

  async hasTable(args) {
    const func = this.hasTable.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.schema.hasTable(args.tn);
      result.data.value = response;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  async hasDatabase(args) {
    const func = this.hasDatabase.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const rows = await this.sqlClient.raw(this.queries[func].default.sql, [
        `${args.databaseName}`,
      ]);
      result.data.value = rows.length > 0;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - databases
   * @property {String} - databases[].database_name
   */
  async databaseList(args: any = {}) {
    const func = this.databaseList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw('SHOW databases');

      log.debug(response.length);

      if (response.length === 2) {
        for (let i = 0; i < response[0].length; ++i) {
          response[0][i].database_name = response[0][i].Database;
        }
        result.data.list = response[0];
      } else {
        log.debug(
          'Unknown response for databaseList:',
          result.data.list.length,
        );
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result.data.list.length);

    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - tables
   * @property {String} - tables[].tn
   */
  async tableList(args?: any) {
    const func = this.tableList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw(
        `SHOW FULL TABLES WHERE TABLE_TYPE NOT LIKE 'VIEW'`,
      );
      // const keyInResponse = `Tables_in_${
      //   this.connectionConfig.connection.database.toLowerCase()
      // }`;
      let keyInResponse;

      if (response.length === 2) {
        for (let i = 0; i < response[0].length; ++i) {
          if (!keyInResponse) {
            keyInResponse = Object.keys(response[0][i]).find((k) =>
              /^Tables_in_/i.test(k),
            );
          }
          response[0][i].tn = response[0][i][keyInResponse];
        }
        result.data.list = response[0];
      } else {
        log.debug(
          'Unknown response for databaseList:',
          result.data.list.length,
        );
        result.data.list = [];
      }

      this.emitTele({
        mysql: 1,
        table_count: result.data.list.length,
        api_count: result.data.list.length * 10,
      });
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result.data.list);

    return result;
  }

  async schemaList(args) {
    const func = this.schemaList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw(
        `select schema_name 
                    from 
                        information_schema.schemata 
                            where 
                                schema_name not in ('information_schema','performance_schema','sys','mysql') 
                                order by schema_name;`,
      );
      if (response.length === 2) {
        result.data.list = response[0].map((v) =>
          mapKeys(v, (_, k) => k.toLowerCase()),
        );
      } else {
        log.debug('Unknown response for schemaList:', result.data.list.length);
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result.data.list);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - columns
   * @returns {string} - columns[].ai,
   * @returns {string} - columns[].clen,
   * @returns {string} - columns[].csn,
   * @returns {string} - columns[].cc,
   * @returns {string} - columns[].cdf,
   * @returns {string} - columns[].cn,
   * @returns {string} - columns[].cop,
   * @returns {string} - columns[].ct,
   * @returns {string} - columns[].dt,
   * @returns {string} - columns[].dtx,
   * @returns {string} - columns[].dtxp,
   * @returns {string} - columns[].dtxs,
   * @returns {string} - columns[].nrqd,
   * @returns {string} - columns[].rqd,
   * @returns {string} - columns[].np,
   * @returns {string} - columns[].ns,
   * @returns {string} - columns[].cno,
   * @returns {string} - columns[].pk,
   * @returns {string} - columns[].tn,
   * @returns {string} - columns[].unique,
   * @returns {string} - columns[].un
   */
  async columnList(args: any = {}) {
    const func = this.columnList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        await this._getQuery({
          func,
        }),
        [args.databaseName, args.tn, args.databaseName, args.tn],
      );

      if (response.length === 2) {
        const columns = [];

        if (!response[0].length) {
          result.code = -1;
          result.message = 'Table not found or Invalid table name';
        }

        for (let i = 0; i < response[0].length; ++i) {
          const column: any = {};

          response[0][i] = mapKeys(response[0][i], (_v, k) => k.toLowerCase());

          if (this._version.key === '57' || this._version.key === '80') {
            column.dp = response[0][i].dp;
            column.generated_expression = response[0][i].generated_expression;
          }

          column.tn = response[0][i].tn;
          column.cn = response[0][i].cn;
          column.cno = response[0][i].cn;
          column.dt = response[0][i].dt;
          column.np = response[0][i].np;
          column.ns = response[0][i].ns;
          column.clen = response[0][i].clen;
          // column.dp = response[0][i].dp;
          column.cop = response[0][i].cop;

          column.pk = response[0][i].ck === 'PRI';

          column.nrqd = response[0][i].nrqd !== 'NO';
          column.rqd = !column.nrqd;

          response[0][i].ct = response[0][i].ct || '';
          column.un = response[0][i].ct.indexOf('unsigned') !== -1;

          column.ct = response[0][i].ct || '';
          response[0][i].ext = response[0][i].ext || '';
          column.ai = response[0][i].ext.indexOf('auto_increment') !== -1;

          response[0][i].cst = response[0][i].cst || ' ';
          column.unique = response[0][i].cst.indexOf('UNIQUE') !== -1;

          if (column.dt === 'timestamp' || column.dt === 'datetime') {
            if (response[0][i].cdf && response[0][i].ext) {
              const str = response[0][i].ext;
              if (str.includes('DEFAULT_GENERATED')) {
                // column.cdf_sequelize = response[0][i].cdf;
                column.cdf =
                  response[0][i].cdf +
                  str.substring(
                    str.lastIndexOf('DEFAULT_GENERATED') +
                      'DEFAULT_GENERATED'.length,
                  );
              } else {
                column.cdf = `${response[0][i].cdf} ${str}`;
              }
            } else {
              column.cdf = response[0][i].cdf;
            }
          } else {
            column.cdf = response[0][i].cdf;
          }

          // Reference: https://github.com/nocodb/nocodb/issues/4625
          // There is an information_schema difference on MariaDB and MySQL
          // while MySQL keeps NULL as default value if no value provided
          // MariaDB keeps NULL as string (if you provide a string NULL it is wrapped by single-quotes)
          // so we check if database is MariaDB and if so we convert the string NULL to null
          if (this._version?.version) {
            if (this._version.version.includes('Maria')) {
              if (column.cdf === 'NULL') {
                column.cdf = null;
              }
            }
          }

          column.cc = response[0][i].cc;

          column.csn = response[0][i].csn;

          // knex specific
          column.dtx = 'specificType';
          //column.data_type_x_specific = response[0][i].dt;
          if (
            column.dt === 'int' ||
            column.dt === 'tinyint' ||
            column.dt === 'mediumint' ||
            column.dt === 'bigint' ||
            column.dt === 'enum' ||
            column.dt === 'set'
          ) {
            column.dtxp = column.ct.substring(
              column.ct.lastIndexOf('(') + 1,
              column.ct.lastIndexOf(')'),
            );
            column.dtxs = response[0][i].ns;
          } else {
            column.dtxp =
              response[0][i].clen || response[0][i].np || response[0][i].dp;
            column.dtxs = response[0][i].ns;
          }

          column.au = false;
          columns.push(column);

          // column['dtx'] = response[0][i]['dt'];
        }

        result.data.list = columns;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result list length = `, result.data.list.length);

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
   */
  async indexList(args: any = {}) {
    const func = this.indexList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.tn],
      );

      if (response.length === 2) {
        const indexes = [];

        for (let i = 0; i < response[0].length; ++i) {
          let index = response[0][i];
          index = mapKeys(index, function (_v, k) {
            return k.toLowerCase();
          });
          index.cn = index.column_name;
          delete index.column_name;
          index.tn = index.table;
          delete index.table;
          index.non_unique_original = index.non_unique;
          indexes.push(index);
        }

        result.data.list = indexes;
      } else {
        log.debug(
          'Unknown response for databaseList:',
          result.data.list.length,
        );
        result.data.list = [];
      }
      log.api(`${func}: result %O`, result.data.list);
    } catch (e) {
      log.ppe(e, func);
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
    const func = this.constraintList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw(
        await this._getQuery({
          func,
        }),
        [this.connectionConfig.connection.database, args.tn],
      );

      if (response.length === 2) {
        const indexes = [];

        for (let i = 0; i < response[0].length; ++i) {
          let index = response[0][i];
          index = mapKeys(index, function (_v, k) {
            return k.toLowerCase();
          });
          indexes.push(index);
        }

        result.data.list = indexes;
      } else {
        log.debug(
          'Unknown response for databaseList:',
          result.data.list.length,
        );
        result.data.list = [];
      }
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
    const func = this.relationList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.databaseName, args.tn],
      );

      if (response.length === 2) {
        const relations = [];

        for (let i = 0; i < response[0].length; ++i) {
          let relation = response[0][i];
          relation = mapKeys(relation, function (_v, k) {
            return k.toLowerCase();
          });
          relations.push(relation);
        }

        result.data.list = relations;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
    const func = this.relationListAll.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        { databaseName: args.databaseName },
      );

      if (response.length === 2) {
        const relations = [];

        for (let i = 0; i < response[0].length; ++i) {
          let relation = response[0][i];
          relation = mapKeys(relation, function (_v, k) {
            return k.toLowerCase();
          });
          relations.push(relation);
        }

        result.data.list = relations;

        this.emitTele({
          mysql: 1,
          relation_count: result.data.list.length,
          api_count: result.data.list.length * 10,
        });
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
    const func = this.triggerList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [`%${args.tn}%`],
      );

      if (response.length === 2) {
        const triggers = [];

        for (let i = 0; i < response[0].length; ++i) {
          let trigger = response[0][i];
          trigger = mapKeys(trigger, function (_v, k) {
            return k.toLowerCase();
          });
          trigger.trigger_name = trigger.trigger;
          triggers.push(trigger);
        }

        result.data.list = triggers;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
    const func = this.functionList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.databaseName],
      );

      if (response.length === 2) {
        const functions = [];

        for (let i = 0; i < response[0].length; ++i) {
          let fn = response[0][i];
          fn = mapKeys(fn, function (_v, k) {
            return k.toLowerCase();
          });
          fn.function_name = fn.name;
          functions.push(fn);
        }

        result.data.list = functions;
      } else {
        log.debug(
          'Unknown response for databaseList:',
          result.data.list.length,
        );
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);

    return result;
  }

  /**
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
    const func = this.procedureList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `show procedure status where db='${args.databaseName}'`,
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.databaseName],
      );

      if (response.length === 2) {
        const procedures = [];

        for (let i = 0; i < response[0].length; ++i) {
          let procedure = response[0][i];
          procedure = mapKeys(procedure, function (_v, k) {
            return k.toLowerCase();
          });
          procedure.procedure_name = procedure.name;
          procedures.push(procedure);
        }

        result.data.list = procedures;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
   * @returns {Object[]} - views
   * @property {String} - views[].sql_mode
   * @property {String} - views[].create_function
   * @property {String} - views[].database collation
   * @property {String} - views[].collation_connection
   * @property {String} - views[].character_set_client
   */
  async viewList(args: any = {}) {
    const func = this.viewList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `SHOW FULL TABLES IN ${args.databaseName} WHERE TABLE_TYPE LIKE 'VIEW';`
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [],
      );

      let keyInResponse;

      if (response.length === 2) {
        const views = [];

        for (let i = 0; i < response[0].length; ++i) {
          if (!keyInResponse) {
            keyInResponse = Object.keys(response[0][i]).find((k) =>
              /^Tables_in_/i.test(k),
            );
          }
          const view = response[0][i];
          view.view_name = view[keyInResponse];
          views.push(view);
        }

        result.data.list = views;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result.data.list.length);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.function_name -
   * @returns {Object[]} - functions
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async functionRead(args: any = {}) {
    const func = this.functionRead.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `SHOW CREATE FUNCTION ${args.function_name};`
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.function_name],
      );

      if (response.length === 2) {
        const _functions = [];

        for (let i = 0; i < response[0].length; ++i) {
          let _function = response[0][i];

          _function = mapKeys(_function, function (_v, k) {
            return k.toLowerCase();
          });

          _function.create_function = _function['create function'];

          _functions.push(_function);
        }

        result.data.list = _functions;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
   * @param {Object} - args.procedure_name -
   * @returns {Object[]} - functions
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async procedureRead(args: any = {}) {
    const func = this.procedureRead.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `show create procedure ${args.procedure_name};`
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.procedure_name],
      );

      if (response.length === 2) {
        const procedures = [];

        for (let i = 0; i < response[0].length; ++i) {
          let procedure = response[0][i];

          procedure = mapKeys(procedure, function (_v, k) {
            return k.toLowerCase();
          });

          procedure.create_procedure = procedure['create procedure'];

          procedures.push(procedure);
        }

        result.data.list = procedures;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
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
   * @param {Object} - args.view_name -
   * @returns {Object[]} - views
   * @property {String} - views[].tn
   */
  async viewRead(args: any = {}) {
    const func = this.viewRead.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `SELECT  * FROM    INFORMATION_SCHEMA.VIEWS
      // WHERE   TABLE_SCHEMA    = '${args.databaseName}'
      // AND     TABLE_NAME      = '${args.view_name}';`
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.databaseName, args.view_name],
      );

      if (response.length === 2) {
        const views = [];

        for (let i = 0; i < response[0].length; ++i) {
          let view = response[0][i];

          view = mapKeys(view, function (_v, k) {
            return k.toLowerCase();
          });

          views.push(view);
        }

        result.data.list = views;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);

    return result;
  }

  async triggerRead(args: any = {}) {
    const func = this.triggerRead.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;
      // `SHOW FULL TABLES IN ${args.databaseName} WHERE TABLE_TYPE LIKE 'VIEW';`;
      const response = await this.sqlClient.raw(
        this.queries[func].default.sql,
        [args.databaseName],
      );

      if (response.length === 2) {
        const views = [];

        for (let i = 0; i < response[0].length; ++i) {
          const view = response[0][i];
          view.view_name = view[`Tables_in_${args.databaseName}`];
          views.push(view);
        }

        result.data.list = views;
      } else {
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
      }
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);

    return result;
  }

  async schemaCreate(args: any = {}) {
    const func = this.triggerList.name;
    log.api(`${func}:args:`, args);
    // `create database ${args.database_name}`
    const rows = await this.sqlClient.raw(this.queries[func].default.sql, [
      args.database_name,
    ]);
    return rows;
  }

  async schemaDelete(args: any = {}) {
    const func = this.schemaDelete.name;
    log.api(`${func}:args:`, args);
    // `drop database ${args.database_name}`
    const rows = await this.sqlClient.raw(this.queries[func].default.sql, [
      args.database_name,
    ]);
    return rows;
  }

  /** ************** END : sql queries *************** */

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
      const query =
        this.querySeparator() +
        `CREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
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
      await this.sqlClient.raw(`DROP TRIGGER ??`, [args.trigger_name]);
      await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );

      result.data.object = {
        upStatement: [
          {
            sql: `${this.querySeparator()}DROP TRIGGER ${
              args.trigger_name
            };\n${this.querySeparator()}CREATE TRIGGER \`${
              args.trigger_name
            }\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${
              args.statement
            }`,
          },
        ],
        downStatement: [
          {
            sql: `${this.querySeparator()}CREATE TRIGGER \`${
              args.trigger_name
            }\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${
              args.oldStatement
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

  async triggerDelete(args: any = {}) {
    const func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    // `DROP TRIGGER ${args.trigger_name}`
    try {
      const query = `${this.querySeparator()}DROP TRIGGER ${args.trigger_name}`;
      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: `${this.querySeparator()}CREATE TRIGGER \`${
              args.trigger_name
            }\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${
              args.oldStatement
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
      const query =
        this.querySeparator() +
        `CREATE VIEW ${args.view_name} AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          { sql: this.querySeparator() + `DROP VIEW ${args.view_name}` },
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
      const query =
        this.querySeparator() +
        `CREATE OR REPLACE VIEW ${args.view_name} AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `CREATE VIEW ${args.view_name} AS \n${args.oldViewDefination}`,
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
  async viewDelete(args: any = {}) {
    const func = this.viewDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    // `DROP TRIGGER ${args.view_name}`
    try {
      const query = this.querySeparator() + `DROP VIEW ${args.view_name}`;

      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `CREATE VIEW ${args.view_name} AS \n${args.oldViewDefination}`,
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
   * @param {String} - args.function_name
   * @param {String} - args.create_function
   * @returns {Object} - up and down statements
   */
  async functionCreate(args: any = {}) {
    const func = this.functionCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`${args.create_function}`);
      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + `${args.create_function}` },
        ],
        downStatement: [
          {
            sql: this.querySeparator() + `DROP FUNCTION ${args.function_name}`,
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
   * @param {String} - args.function_name
   * @param {String} - args.create_function
   * @param {String} - args.oldCreateFunction
   * @returns {Object} - up and down statements
   */
  async functionUpdate(args: any = {}) {
    const func = this.functionUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP FUNCTION IF EXISTS ${args.function_name}`);
      await this.sqlClient.raw(`${args.create_function}`);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${
                args.function_name
              };${this.querySeparator()}\n${args.create_function}`,
          },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${
                args.function_name
              };${this.querySeparator()}${args.oldCreateFunction}`,
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
   * @param {String} - args.function_name
   * @param {String} - args.create_function
   * @returns {Object} - up and down statements
   */
  async functionDelete(args: any = {}) {
    const func = this.functionDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP FUNCTION IF EXISTS ${args.function_name}`);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${args.function_name}`,
          },
        ],
        downStatement: [
          { sql: this.querySeparator() + `${args.create_function}` },
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
   * @param {String} - args.procedure_name
   * @param {String} - args.create_procedure
   * @returns {Object} - up and down statements
   */
  async procedureCreate(args: any = {}) {
    const func = this.procedureCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`${args.create_procedure}`);
      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + `${args.create_procedure}` },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() + `DROP PROCEDURE ${args.procedure_name}`,
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
   * @param {String} - args.procedure_name
   * @param {String} - args.create_procedure
   * @param {String} - args.oldCreateProcedure
   * @returns {Object} - up and down statements
   */
  async procedureUpdate(args: any = {}) {
    const func = this.procedureUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP PROCEDURE IF EXISTS ??`, [
        args.procedure_name,
      ]);
      await this.sqlClient.raw(`${args.create_procedure}`);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${
                args.procedure_name
              }; ${this.querySeparator()} \n${args.create_procedure}`,
          },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${
                args.procedure_name
              }; ${this.querySeparator()} ${args.oldCreateProcedure}`,
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
   * @param {String} - args.procedure_name
   * @param {String} - args.create_procedure
   * @returns {Object} - up and down statements
   */
  async procedureDelete(args: any = {}) {
    const func = this.procedureDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP PROCEDURE IF EXISTS ??`, [
        args.procedure_name,
      ]);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${args.procedure_name}`,
          },
        ],
        downStatement: [
          { sql: this.querySeparator() + `${args.create_procedure}` },
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

  mapFieldWithSuggestedFakerFn(cols) {
    const newCols = cols.map((col) => {
      let suggestion = null;
      let l_score = Infinity;
      const nativeType = findDataType.mapDataType(col.dt);
      fakerFunctionList.forEach((fakerFn, i) => {
        if (nativeType !== 'string' && nativeType !== fakerFn.type) return;

        if (i) {
          const ls = levenshtein.get(
            col.cn.toLowerCase(),
            fakerFn.name.toLowerCase(),
          );
          if (l_score > ls) {
            l_score = ls;
            suggestion = fakerFn;
          }
        } else {
          suggestion = fakerFn;
          l_score = levenshtein.get(
            col.cn.toLowerCase(),
            fakerFn.name.toLowerCase(),
          );
        }
      });

      if (l_score < 3) {
        return { ...col, fakerFunction: suggestion.value };
      }
      return col;
    });

    return newCols;
  }

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @returns {Promise<Result>}
   * @returns {result.data} - __xseeds.json file content
   */
  async seedInit(args) {
    const _func = this.seedInit.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    console.log('in mysql SeedInit');

    try {
      await mkdirp(args.seedsFolder);

      const seedSettings = path.join(args.seedsFolder, '__xseeds.json');
      await promisify(jsonfile.writeFile)(
        seedSettings,
        {
          rows: { value: 8, description: 'Maximum number of records' },
          foreign_key_rows: {
            value: 2,
            description: '1:n - Total number foreign key per relation',
          },
        },
        { spaces: 2 },
      );

      let tables: any = await this.tableList();

      tables = tables.data.list;

      for (const table of tables) {
        let columns: any = await this.columnList({ tn: table.tn });
        columns = columns.data.list;

        for (let i = 0; i < columns.length; ++i) {
          columns[i]['fakerFunction'] = null;
        }

        columns = this.mapFieldWithSuggestedFakerFn(columns);

        let relations: any = await this.relationList({ tn: table.tn });
        relations = relations.data.list;

        for (let i = 0; i < relations.length; i++) {
          const relation = relations[i];
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            if (column.cn === relation.cn) {
              columns[i] = { ...column, ...relation };
            }
          }
        }

        // let fakerColumnPath = path.join(args.seedsFolder, `${table.tn}.json`);
        //
        // await promisify(jsonfile.writeFile)(fakerColumnPath,
        //   columns,
        //   {spaces: 2});

        await this.fakerColumnsCreate({
          seedsFolder: args.seedsFolder,
          tn: table.tn,
          fakerColumns: columns,
        });
      }

      result.data = await promisify(jsonfile.readFile)(seedSettings);
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
      const upQuery = this.querySeparator() + this.createTable(args);
      await this.sqlClient.raw(upQuery);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(args.table).toString();

      this.emit(`Success : ${upQuery}`);

      /**************** return files *************** */
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
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableAddColumn(
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
          // col edit
          upQuery += this.alterTableChangeColumn(
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableChangeColumn(
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += this.alterTableAddColumn(
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableRemoveColumn(
            args.columns[i],
            oldColumn,
            downQuery,
          );
        }
      }

      upQuery += this.alterTablePK(args.columns, args.originalColumns, upQuery);
      downQuery += this.alterTablePK(
        args.originalColumns,
        args.columns,
        downQuery,
      );

      if (upQuery) {
        upQuery = this.genQuery(`ALTER TABLE ?? ${this.sanitize(upQuery)};`, [
          args.tn,
        ]);
        downQuery = this.genQuery(
          `ALTER TABLE ?? ${this.sanitize(downQuery)};`,
          [args.tn],
        );
      }

      await this.sqlClient.raw(upQuery);

      console.log(upQuery);

      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + upQuery }],
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
   * @param args.table_name
   * @param args.ignore
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableDelete(args) {
    const _func = this.tableDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.sqlClient = this.sqlClient;

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(args.table_name).toString();

      let createStatement = await this.sqlClient.raw(`show create table ??`, [
        args.table_name,
      ]);
      createStatement = Object.entries(createStatement[0][0]).find(
        ([k]) => k.toLowerCase() === 'create table',
      )[1];

      const downQuery = this.querySeparator() + createStatement; //createTable(args);

      this.emit(`Success : ${upStatement}`);

      /** ************** drop table_name *************** */
      await this.sqlClient.schema.dropTable(args.table_name);

      /** ************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downQuery }],
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
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = ';';
      const response = await this.sqlClient.raw(`show create table ??;`, [
        args.tn,
      ]);
      if (response.length === 2) {
        result.data = response[0][0]['Create Table'];
      }
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
      let values = ' VALUES (';
      result.data = `INSERT INTO \`${args.tn}\` (`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\n\`${response.data.list[i].cn}\`\n\t`;
            values += `\n<${response.data.list[i].cn}>\n\t`;
          } else {
            result.data += `, \`${response.data.list[i].cn}\`\n\t`;
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
      result.data = `UPDATE \`${args.tn}\` \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\`${response.data.list[i].cn}\` = <\`${response.data.list[i].cn}\`>\n\t`;
          } else {
            result.data += `,\`${response.data.list[i].cn}\` = <\`${response.data.list[i].cn}\`>\n\t`;
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
      result.data = `DELETE FROM ${args.tn};`;
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
      result.data = `TRUNCATE TABLE ${args.tn};`;
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
            result.data += `${response.data.list[i].cn}\n\t`;
          } else {
            result.data += `, ${response.data.list[i].cn}\n\t`;
          }
        }
      }

      result.data += ` FROM ${args.tn};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

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

  alterTableRemoveColumn(n, _o, existingQuery) {
    let query = existingQuery ? ',' : '';
    query += this.genQuery(` DROP COLUMN ??`, [n.cn]);
    return query;
  }

  createTableColumn(n, o, existingQuery) {
    return this.alterTableColumn(n, o, existingQuery, 0);
  }

  alterTableAddColumn(n, o, existingQuery) {
    return this.alterTableColumn(n, o, existingQuery, 1);
  }

  alterTableChangeColumn(n, o, existingQuery) {
    return this.alterTableColumn(n, o, existingQuery, 2);
  }

  createTable(args) {
    let query = '';

    for (let i = 0; i < args.columns.length; ++i) {
      query += this.createTableColumn(args.columns[i], null, query);
    }

    query += this.alterTablePK(args.columns, [], query, true);
    query = this.genQuery(`CREATE TABLE ?? (${this.sanitize(query)});`, [
      args.tn,
    ]);

    return query;
  }

  alterTableColumn(n, o, existingQuery, change = 2) {
    let query = existingQuery ? ',' : '';

    const scale = parseInt(n.dtxs) ? parseInt(n.dtxs) : null;
    if (change === 2) {
      query += this.genQuery(
        `
    CHANGE
    COLUMN ?? ?? ${this.sanitiseDataType(n.dt)}`,
        [o.cn, n.cn],
      );
    } else if (change === 1) {
      query += this.genQuery(
        `
    ADD
    COLUMN ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
      );
    } else {
      query += this.genQuery(` ?? ${this.sanitiseDataType(n.dt)}`, [n.cn]);
    }
    if (!n.dt.endsWith('text')) {
      query += n.dtxp && n.dtxp !== ' ' ? `(${n.dtxp}` : '';
      query += scale ? `,${scale}` : '';
      query += n.dtxp && n.dtxp !== ' ' ? ')' : '';
    }
    query += n.un ? ' UNSIGNED' : '';
    query += n.rqd ? ' NOT NULL' : ' NULL';
    query += n.ai ? ' auto_increment' : '';
    const defaultValue = this.sanitiseDefaultValue(n.cdf);
    query += defaultValue
      ? `
    DEFAULT ${defaultValue}`
      : '';

    return query;
  }

  alterTablePK(n, o, _existingQuery, createTable = false) {
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
      query += numOfPksInOriginal.length ? ',DROP PRIMARY KEY' : '';

      if (numOfPksInNew.length) {
        if (createTable) {
          query += this.genQuery(
            `, PRIMARY
    KEY(??)`,
            [numOfPksInNew],
          );
        } else {
          query += this.genQuery(
            `, ADD
    PRIMARY
    KEY(??)`,
            [numOfPksInNew],
          );
        }
      }
    }

    return query;
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
        `SELECT SUM(table_rows) as TotalRecords FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?;`,
        [this.connectionConfig.connection.database],
      );
      result.data = data[0][0];
    } catch (e) {
      result.code = -1;
      result.message = e.message;
      result.object = e;
    } finally {
      log.api(`${func} :result: ${result}`);
    }
    return result;
  }
}

export default MysqlClient;
