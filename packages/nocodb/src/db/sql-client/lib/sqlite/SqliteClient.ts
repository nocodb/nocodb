import { promisify } from 'util';
import fs from 'fs';
import knex from 'knex';
import isEmpty from 'lodash/isEmpty';
import mapKeys from 'lodash/mapKeys';
import find from 'lodash/find';
import { customAlphabet } from 'nanoid';
import KnexClient from '../KnexClient';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import queries from './sqlite.queries';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 6);

const log = new Debug('SqliteClient');

class SqliteClient extends KnexClient {
  constructor(connectionConfig) {
    // sqlite does not support inserting default values and knex fires a warning without this flag
    connectionConfig.connection.useNullAsDefault = true;
    super(connectionConfig);
    this.sqlClient =
      connectionConfig?.knex || knex(connectionConfig.connection);
    this.queries = queries;
    this._version = {};
  }

  getKnexDataTypes() {
    const result = new Result();

    result.data.list = [
      'int',
      'integer',
      'tinyint',
      'smallint',
      'mediumint',
      'bigint',
      'int2',
      'int8',
      'character',
      'blob sub_type text',
      'numeric',
      'blob',
      'real',
      'double',
      'double precision',
      'float',
      'numeric',
      'boolean',
      'date',
      'datetime',
      'text',
      'varchar',
      'timestamp',
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
      result.message = e.message;
    } finally {
      log.api(`${_func} :result: ${result}`);
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
   * @returns {Object} object - {version, primary, major, minor}
   */
  async version(args?: any) {
    const _func = this.version.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data.object = {};
      const data = await this.raw('select sqlite_version() as version');
      log.debug(data[0]);
      result.data.object.version = data[0].version;
      const versions = data[0].version.split('.');

      if (versions.length && versions.length === 3) {
        result.data.object.primary = versions[0];
        result.data.object.major = versions[1];
        result.data.object.minor = versions[2];
        result.data.object.key = versions[0] + versions[1];
      } else {
        result.code = -1;
        result.message = `Invalid version : ${data[0].version}`;
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

  async createDatabaseIfNotExists(args) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const exists = await promisify(fs.exists)(args.database);

      if (!exists) {
        log.debug('sqlite file do no exists - create one');
        const fd = await promisify(fs.open)(args.database, 'w');
        const close = await promisify(fs.close)(fd);
        log.debug('sqlite file is created', fd, close);
        // create new knex client
        this.sqlClient = knex(this.connectionConfig.connection);
        // set encoding to utf8
        await this.sqlClient.raw('PRAGMA encoding = "UTF-8"');
      } else {
        // create new knex client
        this.sqlClient = knex(this.connectionConfig.connection);
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
      log.debug('dropping database:', args);
      await promisify(fs.unlink)(args.database);
      log.debug('dropped database:');
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
  async createTableIfNotExists(args: any = {}) {
    const _func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      /** ************** START : create _evolution table if not exists *************** */
      const exists = await this.hasTable({ tn: args.tn });

      if (!exists.data.value) {
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

  // async startTransaction() {
  //   // let err = await this.sqlClient.raw("SET autocommit = 0");
  //   // log.debug("SET autocommit = 0:", err);
  //   // err = await this.sqlClient.raw("start transaction");
  //   // log.debug("start transaction:", err);
  // }

  // async commit() {
  //   // const err = await this.sqlClient.raw("commit");
  //   // log.debug("commit:", err);
  //   // await this.sqlClient.raw("SET autocommit = 1");
  //   // log.debug("SET autocommit = 1:", err);
  // }

  // async rollback() {
  //   // const err = await this.sqlClient.raw("rollback");
  //   // log.debug("rollback:", err);
  //   // await this.sqlClient.raw("SET autocommit = 1");
  //   // log.debug("SET autocommit = 1:", err);
  // }

  async hasTable(args) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      // let query = `SELECT name FROM sqlite_master WHERE type='${tn}'`
      // log.debug(query,this.connectionConfig,this.sqlClient);
      // let tables = await this.sqlClient.raw(query);
      await this.sqlClient.raw(`select * from ??`, [args.tn]);
      result.data.value = true;
    } catch (e) {
      // log.ppe(e,  _func);
      result.data.value = false;
      // throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasDatabase(args: any = {}) {
    const _func = this.hasDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    let exists = false;
    log.debug('sqlite databaseName:', args.databaseName);
    exists = await promisify(fs.exists)(args.databaseName);
    result.data.value = exists;
    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - databases
   * @property {String} - databases[].database_name
   */
  async databaseList(_args: any) {
    return [];
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
      const response = await this.sqlClient.raw(
        `SELECT name as tn FROM sqlite_master where type = 'table'`,
      );

      result.data.list = [];

      for (let i = 0; i < response.length; ++i) {
        if (response[i].tn.toLocaleLowerCase() !== 'sqlite_sequence') {
          result.data.list.push(response[i]);
        }
      }

      //result.data.list = response;
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

    throw new Error('SchemaList : Not supported for sqlite');

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
      const response = await this.sqlClient.raw(`PRAGMA table_info(??)`, [
        args.tn,
      ]);

      const triggerList = (await this.triggerList(args)).data.list;

      for (let i = 0; i < response.length; ++i) {
        response[i].cn = response[i].name;
        response[i].cno = response[i].cn;
        response[i].dt = response[i].type.toLocaleLowerCase();
        switch (response[i].dt) {
          case 'integer':
          case 'int':
          case 'text':
          case 'varchar':
          case 'numeric':
          case 'blob':
          case 'blob sub_type text':
          case 'real':
          case 'timestamp':
          case 'tinyint':
          case 'smallint':
          case 'mediumint':
          case 'bigint':
          case 'int2':
          case 'int8':
          case 'character':
          case 'double':
          case 'double precision':
          case 'float':
          case 'boolean':
          case 'date':
          case 'datetime':
          case 'time':
            break;

          default:
            /* there is length info available within () - we are extracting this*/
            if (response[i].dt[0] === 't' || response[i].dt[0] === 'i') {
              const matches = /(\w+)\(([^)]+)\)/.exec(response[i].dt);
              if (matches && matches.length && matches.length > 1) {
                response[i].dtxp = matches[2];
                response[i].dt = matches[1];
              }
            }
            break;
        }
        response[i].nrqd = response[i].notnull !== 1;
        response[i].not_nullable = response[i].notnull === 1;
        response[i].rqd = response[i].notnull === 1;
        response[i].cdf = response[i].dflt_value;
        response[i].pk = response[i].pk > 0;
        response[i].cop = response[i].cid;

        // https://stackoverflow.com/a/7906029
        response[i].ai = response[i].pk && response[i].dt === 'integer';
        response[i].dtx = this.getKnexDataType(response[i].dt);

        response[i].dtxp = '';
        response[i].dtxs = '';

        response[i].au = !!triggerList.find(
          ({ trigger }) =>
            trigger === `xc_trigger_${args.tn}_${response[i].cn}`,
        );
      }

      result.data.list = response;
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
   */
  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      // PRAGMA index_list('film')
      //
      // PRAGMA index_info('idx_fk_original_language_id');
      //
      // PRAGMA index_xinfo('idx_fk_original_language_id');

      const response = await this.sqlClient.raw(`PRAGMA index_list(??)`, [
        args.tn,
      ]);

      const rows = [];

      for (let i = 0, rowCount = 0; i < response.length; ++i, ++rowCount) {
        response[i].key_name = response[i].name;
        response[i].non_unique = response[i].unique === 0 ? 1 : 0;
        response[i].non_unique_original = response[i].unique === 0 ? 1 : 0;
        response[i].unique = response[i].unique === 1 ? 1 : 0;

        const colsInIndex = await this.sqlClient.raw(`PRAGMA index_info(??)`, [
          response[i].key_name,
        ]);

        if (colsInIndex.length === 1) {
          rows[rowCount] = response[i];

          rows[rowCount].cn = colsInIndex[0].name;
          rows[rowCount].seq_in_index = 1;
        } else {
          for (let j = 0; j < colsInIndex.length; ++j, ++rowCount) {
            rows[rowCount] = JSON.parse(JSON.stringify(response[i]));
            rows[rowCount].cn = colsInIndex[j].name;
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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(`PRAGMA foreign_key_list(??)`, [
        args.tn,
      ]);

      for (let i = 0; i < response.length; ++i) {
        response[i].tn = args.tn;
        response[i].cn = response[i].from;
        response[i].rtn = response[i].table;
        response[i].rcn = response[i].to;
        response[i].ur = response[i].on_update;
        response[i].dr = response[i].on_delete;
        response[i].mo = response[i].match;
      }

      result.data.list = response;
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
      let tables: any = await this.tableList();
      tables = tables.data.list;
      const fks = [];

      for (let i = 0; i < tables.length; ++i) {
        const response = await this.sqlClient.raw(
          `PRAGMA foreign_key_list(??)`,
          [tables[i].tn],
        );

        for (let j = 0; j < response.length; ++j) {
          response[j].tn = tables[i].tn;
          response[j].cn = response[j].from;
          response[j].rtn = response[j].table;
          response[j].rcn = response[j].to;
          response[j].ur = response[j].on_update;
          response[j].dr = response[j].on_delete;
          response[j].mo = response[j].match;
          fks.push(response[j]);
        }
      }

      result.data.list = fks;
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

      const response = await this.sqlClient.raw(
        `select *, name as trigger_name from sqlite_master where type = 'trigger' and tbl_name=?;`,
        [args.tn],
      );

      for (let i = 0; i < response.length; ++i) {
        response[i].trigger = response[i].name;
        response[i].table = response[i].tbl_name;
        response[i].statement = response[i].sql;
      }

      result.data.list = response;
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

      const response = await this.sqlClient.raw(
        `show function status where db=?`,
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
        log.debug('Unknown response for databaseList:', response);
        result.data.list = [];
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
    log.api(`${_func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `show procedure status where db=?`,
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
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - views
   * @property {String} - views[].view_name
   * @property {String} - views[].view_definition
   */
  async viewList(args: any = {}) {
    const _func = this.viewList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SELECT * FROM sqlite_master WHERE type = 'view'`,
      );

      for (let i = 0; i < response.length; ++i) {
        response[i].view_name = response[i].name;
        response[i].view_definition = response[i].sql;
      }

      result.data.list = response;
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
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async functionRead(args: any = {}) {
    const _func = this.functionRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(`SHOW CREATE FUNCTION ??;`, [
        args.function_name,
      ]);

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
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
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
    const _func = this.procedureRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(`show create procedure ??;`, [
        args.procedure_name,
      ]);

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
      const response = await this.sqlClient.raw(
        `SELECT * FROM sqlite_master WHERE type = 'view' AND name = ?`,
        [args.view_name],
      );

      for (let i = 0; i < response.length; ++i) {
        response[i].view_name = response[i].name;
        response[i].view_definition = response[i].sql;
      }

      result.data.list = response;
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
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  async schemaCreate(args: any = {}) {
    const _func = this.schemaCreate.name;
    // const result = new Result();
    log.api(`${_func}:args:`, args);

    const rows = await this.sqlClient.raw(`create database ??`, [
      args.database_name,
    ]);
    return rows;
  }

  async schemaDelete(args: any = {}) {
    const _func = this.schemaDelete.name;
    // const result = new Result();
    log.api(`${_func}:args:`, args);

    const rows = await this.sqlClient.raw(`drop database ??`, [
      args.database_name,
    ]);
    return rows;
  }

  /** ************** END : sql queries *************** */
  async triggerDelete(args: any = {}) {
    const _func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const query = this.querySeparator() + `DROP TRIGGER ??`;
      await this.sqlClient.raw(query, [args.trigger_name]);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [{ sql: `;` }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }
    return result;
  }

  async functionDelete(args: any = {}) {
    const _func = this.functionDelete.name;
    // const result = new Result();
    log.api(`${_func}:args:`, args);

    const rows = await this.sqlClient.raw(`DROP FUNCTION IF EXISTS ??`, [
      args.function_name,
    ]);
    return rows;
  }

  async procedureDelete(args: any = {}) {
    const _func = this.procedureDelete.name;
    // const result = new Result();
    log.api(`${_func}:args:`, args);

    const rows = await this.sqlClient.raw(`DROP PROCEDURE IF EXISTS ??`, [
      args.procedure_name,
    ]);
    return rows;
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
   * @param {String} - args.tn
   * @param {String} - args.function_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async functionCreate(args: any = {}) {
    const func = this.functionCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER ${this.genIdentifier(args.function_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );
      result.data.list = rows;
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
      await this.sqlClient.raw(
        `DROP TRIGGER ${this.genIdentifier(args.function_name)}`,
      );
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER ${this.genIdentifier(args.function_name)}\` \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );
      result.data.list = rows;
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
   * @param {String} - args.procedure_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async procedureCreate(args: any = {}) {
    const func = this.procedureCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER ${this.genIdentifier(args.procedure_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );
      result.data.list = rows;
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
      await this.sqlClient.raw(`DROP TRIGGER ${args.procedure_name}`);
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER ${this.genIdentifier(args.procedure_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );
      result.data.list = rows;
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
      const query =
        this.querySeparator() +
        `CREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
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
        `CREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
          args.timing
        } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
          args.statement
        }`,
      );

      const upQuery = `DROP TRIGGER ${this.genIdentifier(
        args.trigger_name,
      )};\nCREATE TRIGGER ${this.genIdentifier(args.trigger_name)} \n${
        args.timing
      } ${args.event}\nON ${this.genIdentifier(args.tn)} FOR EACH ROW\n${
        args.statement
      }`;

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
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @returns {Object} - up and down statements
   */
  async viewCreate(args: any = {}) {
    const func = this.viewCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = args.view_definition + ';';

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [{ sql: `;` }],
        //downStatement: [{sql:`DROP VIEW ${args.view_name}`}]
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
      const query = args.view_definition;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [{ sql: ';' }],
        // downStatement: [{`CREATE VIEW ${args.view_name} AS \n${
        //   args.oldViewDefination
        // }`}]
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
      await this.sqlClient.raw(`DROP VIEW ??;`, [args.view_name]);

      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + `DROP VIEW ${args.view_name};` },
        ],
        downStatement: [{ sql: ';' }],
        // downStatement: `CREATE VIEW ${args.view_name} AS \n${
        //   args.oldViewDefination
        // }`
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

      //const downStatement = this.sqlClient.schema.dropTable(args.table).toSQL();
      const downStatement = [{ sql: ';' }];

      this.emit(`Success : ${upQuery}`);

      const triggerStatements = await this.afterTableCreate(args);

      /**************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upQuery }, ...triggerStatements.upStatement],
        downStatement: downStatement,
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
    const downQuery = '';

    const pk = args.columns.find((c) => c.pk);
    if (!pk) return result;

    const tn = this.genIdentifier(args.tn);

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au) {
        const triggerName = this.genIdentifier(`xc_trigger_${tn}_${column.cn}`);
        const triggerCreateQuery = `${this.querySeparator()}CREATE TRIGGER ${triggerName}
            AFTER UPDATE
            ON "${tn}" FOR EACH ROW
            BEGIN
              UPDATE "${tn}" SET ${this.genIdentifier(
          column.cn,
        )} = current_timestamp
                WHERE ${this.genIdentifier(pk.cn)} = old.${this.genIdentifier(
          pk.cn,
        )};
            END;`;

        upQuery += triggerCreateQuery;

        await this.sqlClient.raw(triggerCreateQuery);
      }
    }
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };

    return result;
  }

  async afterTableUpdate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    const downQuery = '';

    const pk = args.columns.find((c) => c.pk);
    if (!pk) return result;

    const tn = this.genIdentifier(args.tn);

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au && column.altered === 1) {
        const triggerName = this.genIdentifier(
          `xc_trigger_${args.tn}_${column.cn}`,
        );
        const triggerCreateQuery = `${this.querySeparator()}CREATE TRIGGER ${triggerName}
            AFTER UPDATE
            ON "${tn}" FOR EACH ROW
            BEGIN
              UPDATE "${tn}" SET ${this.genIdentifier(
          column.cn,
        )} = current_timestamp
                WHERE ${this.genIdentifier(pk.cn)} = old.${this.genIdentifier(
          pk.cn,
        )};
            END;`;

        upQuery += triggerCreateQuery;

        await this.sqlClient.raw(triggerCreateQuery);
      }
    }
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

        if (!args.columns[i].pk && args.columns[i].altered & 4) {
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
          downQuery += ';';
          // downQuery += this.alterTableChangeColumn(
          //   args.table,
          //   oldColumn,
          //   args.columns[i],
          //   downQuery,
          //             this.sqlClient
          // );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += this.alterTableAddColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += ';';
          // downQuery += alterTableRemoveColumn(
          //   args.table,
          //   args.columns[i],
          //   oldColumn,
          //   downQuery,
          //             this.sqlClient
          // );
        }
      }

      const pkQuery = this.alterTablePK(
        args.columns,
        args.originalColumns,
        upQuery,
      );

      const fkCheckEnabled = (
        await this.sqlClient.raw('PRAGMA foreign_keys;')
      )?.[0]?.foreign_keys;

      if (fkCheckEnabled)
        await this.sqlClient.raw('PRAGMA foreign_keys = OFF;');

      await this.sqlClient.raw('PRAGMA legacy_alter_table = ON;');

      /*
        This is a hack to avoid the following error:
        - SQLITE_ERROR: duplicate column name: column_name

        Somehow this error is thrown when we drop a column and add a new column with the same name right after it.
        TODO - Find a better solution for this.
      */
      await this.sqlClient.raw('SELECT * FROM ?? LIMIT 1', [args.table]);

      const trx = await this.sqlClient.transaction();

      const splitQueries = (query) => {
        const queries = [];
        let quotationCount = 0;
        let quotationMode: 'double' | 'single' | undefined = undefined;
        let currentQuery = '';

        for (let i = 0; i < query.length; i++) {
          if (!quotationMode && (query[i] === '"' || query[i] === "'")) {
            quotationMode = query[i] === '"' ? 'double' : 'single';
          }

          if (
            (quotationMode === 'double' && query[i] === '"') ||
            (quotationMode === 'single' && query[i] === "'")
          ) {
            // Ignore if quotation is escaped
            if (i > 0 && query[i - 1] !== '\\') {
              quotationCount++;
            }
          }

          if (query[i] === ';' && quotationCount % 2 === 0) {
            queries.push(currentQuery);
            currentQuery = '';
            quotationMode = undefined;
          } else {
            currentQuery += query[i];
          }
        }

        if (currentQuery.trim() !== '') {
          queries.push(currentQuery);
        }

        return queries;
      };

      try {
        const queries = splitQueries(upQuery);
        for (let i = 0; i < queries.length; i++) {
          if (queries[i].trim() !== '') {
            await trx.raw(queries[i]);
          }
        }

        if (pkQuery) {
          await trx.schema.alterTable(args.table, (table) => {
            for (const pk of pkQuery.oldPks.filter(
              (el) => !pkQuery.newPks.includes(el),
            )) {
              table.dropPrimary(pk);
            }

            for (const pk of pkQuery.dropPks) {
              table.dropColumn(pk);
            }

            if (pkQuery.newPks.length) {
              table.primary(pkQuery.newPks);
            }
          });
        }

        await trx.commit();
      } catch (e) {
        await trx.rollback();
        // log.ppe(e, _func);
        throw e;
      } finally {
        if (fkCheckEnabled)
          await this.sqlClient.raw('PRAGMA foreign_keys = ON;');
        await this.sqlClient.raw('PRAGMA legacy_alter_table = OFF;');
      }

      // console.log(upQuery);

      const afterUpdate = await this.afterTableUpdate(args);

      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + upQuery },
          ...afterUpdate.upStatement,
        ],
        downStatement: [{ sql: ';' }],
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
      //const downQuery = createTable(args.tn, args);
      const downStatement = [{ sql: ';' }];
      this.emit(`Success : ${upStatement}`);

      /** ************** drop tn *************** */
      await this.sqlClient.schema.dropTable(args.tn);

      /** ************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement,
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
      result.data = `INSERT INTO "${args.tn}" (`;
      let values = ' VALUES (';
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\n${response.data.list[i].cn}\n\t`;
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
      result.data = `UPDATE "${args.tn}" \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `${response.data.list[i].cn} = <\`${response.data.list[i].cn}\`>\n\t`;
          } else {
            result.data += `,${response.data.list[i].cn} = <\`${response.data.list[i].cn}\`>\n\t`;
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
            result.data += `${response.data.list[i].cn}\n\t`;
          } else {
            result.data += `, ${response.data.list[i].cn}\n\t`;
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
   * @param args
   * @param args.tn
   * @param args.folder
   * @returns {Object} Result
   * @returns {Promise<void>}
   */
  async sequelizeModelCreate(args) {
    const _func = this.sequelizeModelCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      console.time(_func);

      /* Get tables */
      let tables: any = [];
      if (!args.tn) {
        tables = await this.tableList(args);
        tables = tables.data.list;
      } else {
        tables.push({ tn: args.tn });
      }

      /* Get all relations */
      let relations: any = await this.relationList(args);
      relations = relations.data.list;

      /* Filter relations for current table */
      if (args.tn) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        relations = relations.filter(
          (r) => r.tn === args.tn || r.rtn === args.tn,
        );
      }

      /* Get Columnlist for each table */
      for (let i = 0; i < tables.length; ++i) {
        let columns: any = await this.columnList({ tn: tables[i].tn });
        columns = columns.data.list;
        console.log(
          `Sequelize model created: ${tables[i].tn}(${columns.length})\n`,
        );

        // let SqliteSequelizeRender = require('./SqliteSequelizeRender');
        //
        // let modelRenderer = new SqliteSequelizeRender({
        //   dir: path.join(args.folder,'models','sqlite','sequelize','xc'),
        //   filename: `${tables[i].tn}.model.js`,
        //   ctx: {tn: tables[i].tn, columns, relations}
        // })
        //
        // await modelRenderer.render();

        // /**************** START : Model render sequelize ****************/
        // let SqliteTypeormRender = require('./SqliteTypeormRender');
        //
        // let modelTypeormRenderer = new SqliteTypeormRender({
        //   dir: path.join(args.folder,'models','sqlite','sequelize','xc'),
        //   filename: `${tables[i].tn}.typeorm.js`,
        //   ctx: {tn: tables[i].tn, columns, relations}
        // });
        //
        // await modelTypeormRenderer.render();
        // /**************** END : Model render sequelize ****************/

        console.log('\n\n- - - - - - - - - - - - - ');
      }

      console.timeEnd(_func);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  createTablePK(n, _existingQuery) {
    const newPks = [];

    for (let i = 0; i < n.length; ++i) {
      if (n[i].pk) {
        if (n[i].altered !== 4) newPks.push(n[i].cn);
      }
    }

    let query = '';
    if (newPks.length) {
      query += this.genQuery(`, PRIMARY KEY(??)`, [newPks]);
    }

    return query;
  }

  alterTablePK(n, o, _existingQuery) {
    const newPks = [];
    const oldPks = [];
    const dropPks = [];
    let pksChanged = false;

    for (let i = 0; i < n.length; ++i) {
      if (n[i].pk) {
        if (n[i].altered !== 4) {
          newPks.push(n[i].cn);
        } else {
          dropPks.push(n[i].cn);
        }
        pksChanged = true;
      }
    }

    for (let i = 0; i < o.length; ++i) {
      if (o[i].pk) {
        oldPks.push(o[i].cn);
      }
    }

    if (newPks.length === oldPks.length) {
      if (newPks.every((pk) => oldPks.includes(pk)) && dropPks.length === 0) {
        pksChanged = false;
      }
    }

    if (pksChanged) {
      return {
        newPks,
        oldPks,
        dropPks,
      };
    } else {
      return false;
    }
  }

  alterTableRemoveColumn(t, n, _o, existingQuery) {
    const shouldSanitize = true;
    let query = existingQuery ? ';' : '';
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

    query += this.createTablePK(args.columns, query);

    query = this.genQuery(`CREATE TABLE ?? (${query});`, [args.tn]);

    return query;
  }

  alterTableColumn(t, n, o, existingQuery, change = 2) {
    let query = '';
    let shouldSanitize = true;
    if (change === 2) {
      const suffix = nanoid();

      const backupOldColumnQuery = this.genQuery(
        `ALTER TABLE ?? RENAME COLUMN ?? TO ??;`,
        [t, o.cn, `${o.cno}_nc_${suffix}`],
        shouldSanitize,
      );

      let addNewColumnQuery = '';
      addNewColumnQuery += this.genQuery(
        ` ADD ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      addNewColumnQuery +=
        n.dtxp && n.dt !== 'text' ? `(${this.genRaw(n.dtxp)})` : '';
      addNewColumnQuery += n.cdf
        ? ` DEFAULT ${this.genValue(n.cdf)}`
        : !n.rqd
        ? ' '
        : ` DEFAULT ''`;
      addNewColumnQuery += n.rqd ? ` NOT NULL` : ' ';
      query += n.unique ? ` UNIQUE` : '';
      addNewColumnQuery = this.genQuery(
        `ALTER TABLE ?? ${addNewColumnQuery};`,
        [t],
        shouldSanitize,
      );

      const updateNewColumnQuery = this.genQuery(
        `UPDATE ?? SET ?? = ??;`,
        [t, n.cn, `${o.cno}_nc_${suffix}`],
        shouldSanitize,
      );

      const dropOldColumnQuery = this.genQuery(
        `ALTER TABLE ?? DROP COLUMN ??;`,
        [t, `${o.cno}_nc_${suffix}`],
        shouldSanitize,
      );

      query = `${backupOldColumnQuery}${addNewColumnQuery}${updateNewColumnQuery}${dropOldColumnQuery}`;
    } else if (change === 0) {
      query = existingQuery ? ',' : '';
      query += this.genQuery(
        `?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      query += n.dtxp && n.dt !== 'text' ? `(${this.genRaw(n.dtxp)})` : '';
      query += n.cdf ? ` DEFAULT ${this.genValue(n.cdf)}` : ' ';
      query += n.rqd ? ` NOT NULL` : ' ';
      // todo: unique constraint should be added using index
      // query += n.unique ? ` UNIQUE` : '';
    } else if (change === 1) {
      shouldSanitize = true;
      query += this.genQuery(
        ` ADD ?? ${this.sanitiseDataType(n.dt)}`,
        [n.cn],
        shouldSanitize,
      );
      query += n.dtxp && n.dt !== 'text' ? `(${this.genRaw(n.dtxp)})` : '';
      query += n.cdf
        ? ` DEFAULT ${this.genValue(n.cdf)}`
        : !n.rqd
        ? ' '
        : ` DEFAULT ''`;
      query += n.rqd ? ` NOT NULL` : ' ';
      // todo: unique constraint should be added using index
      // query += n.unique ? ` UNIQUE` : '';
      query = this.genQuery(`ALTER TABLE ?? ${query};`, [t], shouldSanitize);
    } else {
      // if(n.cn!==o.cno) {
      //   query += `\nALTER TABLE ${t} RENAME COLUMN ${n.cno} TO ${n.cn};\n`;
      // }
      //
      // if(n.dt!==o.dt) {
      //   query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} TYPE ${n.dt};\n`;
      // }
      //
      //
      // if(n.rqd!==o.rqd) {
      //   query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} `;
      //   query += n.rqd ? ` SET NOT NULL;\n` : ` DROP NOT NULL;\n`;
      // }
      //
      // if(n.cdf!==o.cdf) {
      //   query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} `;
      //   query += n.cdf ? ` SET DEFAULT ${n.cdf};\n` : ` DROP DEFAULT;\n`;
      // }
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
      const tables = await this.sqlClient.raw(
        `SELECT name FROM sqlite_master WHERE type='table';`,
      );
      let count = 0;
      for (const tb of tables) {
        const tmp = await this.sqlClient.raw(`SELECT COUNT(*) as ct FROM ??;`, [
          tb.name,
        ]);
        if (tmp && tmp.length) {
          count += tmp[0].ct;
        }
      }
      result.data.TotalRecords = count;
    } catch (e) {
      result.code = -1;
      result.message = e.message;
      result.object = e;
    } finally {
      log.api(`${func} :result: ${result}`);
    }
    return result;
  }

  genValue(value): any {
    if (value === 'CURRENT_TIMESTAMP') {
      return value;
    }

    return super.genValue(value);
  }
}

export default SqliteClient;
