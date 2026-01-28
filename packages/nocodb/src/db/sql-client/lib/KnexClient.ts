/* eslint-disable no-constant-condition */
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { knex } from 'knex';
import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import jsonfile from 'jsonfile';
import mkdirp from 'mkdirp';
import Result from '../../util/Result';
import Emit from '../../util/emit';
import Debug from '../../util/Debug';
import * as dataHelp from './data.helper';
import SqlClient from './SqlClient';
import type { Knex } from 'knex';
import { T } from '~/utils';

const evt = new Emit();

const log = new Debug('KnexClient');
// TODO: Im sure there are more types to handle here
const strTypes = [
  'varchar',
  'char',
  'image',
  'character',
  'character varying',
  'nchar',
  'nvarchar',
  'clob',
  'nvarchar2',
  'varchar2',
  'raw',
  'long raw',
  'bfile',
  'nclob',
];
const intTypes = [
  'integer',
  'int',
  'smallint',
  'mediumint',
  'bigint',
  'tinyint',
  'int2',
  'int4',
  'int8',
  'long',
  'serial',
  'bigserial',
  'smallserial',
  'number',
];
const floatTypes = [
  'float',
  'double',
  'decimal',
  'numeric',
  'real',
  'double precision',
  'real',
  'money',
  'smallmoney',
  'dec',
];
const dateTypes = [
  'date',
  'datetime',
  'timestamp',
  'time',
  'timestamp without time zone',
  'timestamp with time zone',
  'time without time zone',
  'time with time zone',
  'datetime2',
  'smalldatetime',
  'datetimeoffset',
  'interval year',
  'interval day',
];
const _enumTypes = ['enum', 'set'];
const yearTypes = ['year'];
const bitTypes = ['bit'];
const textTypes = ['tinytext', 'mediumtext', 'longtext', 'ntext', 'text'];
const boolTypes = ['bool', 'boolean'];
const blobTypes = ['blob', 'mediumblob', 'longblob', 'binary', 'varbinary'];
const geometryTypes = ['geometry'];
const pointTypes = ['point'];
const linestringTypes = ['linestring'];
const polygonTypes = ['polygon'];
const multipointTypes = ['multipoint'];
const multilinestringTypes = ['multilinestring'];
const multipolygonTypes = ['multipolygon'];
const jsonTypes = ['json'];

abstract class KnexClient extends SqlClient {
  private static ___ext: boolean;
  protected _connectionConfig: any;
  protected metaDb: any;
  protected evt: Emit;
  public knex: Knex;

  constructor(connectionConfig) {
    super(connectionConfig);
    this.validateInput();
    if (connectionConfig.connection && connectionConfig.connection.port)
      connectionConfig.connection.port = +connectionConfig.connection.port;

    this._connectionConfig = connectionConfig;
    if (connectionConfig.knex) {
      this.sqlClient = connectionConfig.knex;
    } else {
      const tmpConnectionConfig =
        connectionConfig.client === 'sqlite3'
          ? connectionConfig.connection
          : connectionConfig;
      this.sqlClient = knex(tmpConnectionConfig);
    }
    this.knex = this.sqlClient;
    this.metaDb = {};
    this.metaDb.tables = {};

    this.evt = new Emit();
  }

  async _validateInput() {
    try {
      const packageJson = JSON.parse(
        await promisify(fs.readFile)(
          path.join(process.cwd(), 'package.json'),
          'utf8',
        ),
      );
      return (
        packageJson.name === 'nocodb' || 'nocodb' in packageJson.dependencies
      );
    } catch (e) {}
    return true;
  }

  async validateInput() {
    try {
      if (!('___ext' in KnexClient)) {
        KnexClient.___ext = await this._validateInput();
      }
      if (!KnexClient.___ext) {
        T.emit('evt', {
          evt_type: 'base:external',
          payload: null,
          check: true,
        });
      }
    } catch (e) {}
  }

  emitTele(data) {
    this.evt.evt.emit('tele', {
      table_count: 0,
      relation_count: 0,
      view_count: 0,
      api_count: 0,
      mysql: 0,
      pg: 0,
      oracledb: 0,
      sqlite3: 0,
      rest: 0,
      graphql: 0,
      ...data,
    });
  }

  abstract schemaCreateWithCredentials(_args): Promise<any>;

  abstract sequenceList(_args?: any): Promise<any>;

  abstract sequenceCreate(_args?: any): Promise<any>;

  abstract sequenceUpdate(_args?: any): Promise<any>;

  abstract sequenceDelete(_args?: any): Promise<any>;

  _isColumnPrimary(columnObj) {
    if (
      columnObj.ck === 'PRI' ||
      columnObj.ck === 'PRIMARY KEY' ||
      columnObj.ck === 'P'
    ) {
      return true;
    }
    return false;
  }

  _isColumnForeignKey(tableObj, cn) {
    if (findIndex(tableObj.foreignKeys, { cn: cn }) === -1) {
      return false;
    }
    return true;
  }

  _isColumnPrimaryForInserting(tableObj, columnObj) {
    if (
      columnObj.ck === 'PRI' ||
      columnObj.ck === 'PRIMARY KEY' ||
      columnObj.ck === 'P'
    ) {
      if (tableObj.primaryKeys.length > 1) {
        if (
          findIndex(tableObj.primaryKeys, {
            cn: columnObj.cn,
          }) > 0
        ) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  _getMaxPksPossible(columnObject) {
    const max = {
      int: 2147483647,
      tinyint: 127,
      smallint: 32767,
      mediumint: 8388607,
      bigint: 2 ^ (63 - 1),
    };

    const maxUnsigned = {
      int: 4294967295,
      tinyint: 255,
      smallint: 65535,
      mediumint: 16777215,
      bigint: 2 ^ (64 - 1),
    };

    if (columnObject.un) {
      return maxUnsigned[columnObject.dt];
    }
    return max[columnObject.dt];
  }

  _getMaxNumPossible(columnObject) {
    const max = {
      int: 2147483647,
      tinyint: 127,
      smallint: 32767,
      mediumint: 8388607,
      bigint: 2 ^ (63 - 1),
    };

    const maxUnsigned = {
      int: 4294967295,
      tinyint: 255,
      smallint: 65535,
      mediumint: 16777215,
      bigint: 2 ^ (64 - 1),
    };

    if (columnObject.un) {
      return maxUnsigned[columnObject.dt];
    }
    return max[columnObject.dt];
  }

  _getMaxRowsPossible(tableObj, maxy) {
    let max = 10000;
    const pk = tableObj.primaryKeys[0];

    if (tableObj.primaryKeys.length) {
      const dt = this.getKnexDataTypeMock(pk.ct);
      const col = find(tableObj.columns, {
        cn: pk.cn,
      });

      if (dt === 'integer') {
        max = Math.pow(2, col.np);
      } else if (dt === 'string') {
        if (col.clen && col.clen < 3) {
          max = 500;
        }
      }
    }

    let max1 = 10000;
    let searchFrom = 0;
    let foundIndex = findIndex(tableObj.columns, { ck: 'UNI' }, searchFrom);

    while (foundIndex !== -1) {
      const col = tableObj.columns[foundIndex];

      const dt = this.getKnexDataTypeMock(col.ct);

      if (dt === 'integer') {
        max1 = Math.pow(2, col.np);
      } else if (dt === 'string') {
        if (col.clen && col.clen < 2) {
          max1 = 25;
        }
      }

      searchFrom = foundIndex;
      foundIndex = findIndex(tableObj.columns, { ck: 'UNI' }, searchFrom + 1);
    }

    let max2 = 10000;
    searchFrom = 0;
    foundIndex = findIndex(tableObj.columns, { ck: 'MUL' }, searchFrom);

    while (foundIndex !== -1) {
      const col = tableObj.columns[foundIndex];

      const dt = this.getKnexDataTypeMock(col.ct);

      if (dt === 'integer') {
        max2 = Math.pow(2, col.np);
      } else if (dt === 'string') {
        // if (col['character_maximum_length'] && col['character_maximum_length'] < 2) {
        //   max2 = 25;
        // }
      }

      searchFrom = foundIndex;
      foundIndex = findIndex(tableObj.columns, { ck: 'MUL' }, searchFrom + 1);
    }

    // console.log('min of: ', max, max1, max2, maxy);
    return Math.min(max, max1, max2, maxy);
  }

  getKnexDataTypeMock(databaseType) {
    try {
      const Type = databaseType;

      let colValidation = {};

      if (dataHelp.getType(Type, strTypes)) {
        colValidation = 'string';
      } else if (dataHelp.getType(Type, intTypes)) {
        colValidation = 'integer';
      } else if (dataHelp.getType(Type, floatTypes)) {
        colValidation = 'float';
      } else if (dataHelp.getType(Type, dateTypes)) {
        colValidation = 'date';
      } else if (dataHelp.getType(Type, _enumTypes)) {
        colValidation = 'enum';
      } else if (dataHelp.getType(Type, yearTypes)) {
        colValidation = 'year';
      } else if (dataHelp.getType(Type, blobTypes)) {
        colValidation = 'blob';
      } else if (dataHelp.getType(Type, boolTypes)) {
        colValidation = 'boolean';
      } else if (dataHelp.getType(Type, geometryTypes)) {
        colValidation = 'geometry';
      } else if (dataHelp.getType(Type, pointTypes)) {
        colValidation = 'point';
      } else if (dataHelp.getType(Type, linestringTypes)) {
        colValidation = 'linestring';
      } else if (dataHelp.getType(Type, polygonTypes)) {
        colValidation = 'polygon';
      } else if (dataHelp.getType(Type, multipointTypes)) {
        colValidation = 'multipoint';
      } else if (dataHelp.getType(Type, multilinestringTypes)) {
        colValidation = 'multilinestring';
      } else if (dataHelp.getType(Type, multipolygonTypes)) {
        colValidation = 'multipolygon';
      } else if (dataHelp.getType(Type, bitTypes)) {
        colValidation = 'bit';
      } else if (dataHelp.getType(Type, textTypes)) {
        colValidation = 'text';
      } else if (dataHelp.getType(Type, jsonTypes)) {
        colValidation = 'json';
      } else {
        colValidation = 'other';
      }

      return colValidation;
    } catch (e) {
      console.log(e);
      return 'string';
    }
  }

  async mockDb(_args) {
    // todo: remove method
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

  async selectAll(tn) {
    return await this.sqlClient.raw(this.sqlClient(tn).select().toQuery());
  }

  /**
   *
   *
   * @param args
   * @param args.tn
   * @param args.fields
   * @param args.limit
   * @param args.where
   * @param args.sort
   * @param args.size
   * @param args.orderBy
   * @param args.page
   * @return {Promise<Result>}
   */
  async list(args) {
    const { size = 10, page = 1, orderBy } = args;

    const result = new Result();

    try {
      const countResult = await this.sqlClient.raw(
        this.sqlClient(args.tn).count().toQuery(),
      );
      result.data.count = Object.values(countResult[0])[0];
      const query = this.sqlClient(args.tn)
        .select()
        .limit(size)
        .offset((page - 1) * size);
      if (orderBy && orderBy.length)
        result.data.list = await this.sqlClient.raw(
          query.orderBy(orderBy).toQuery(),
        );
      else result.data.list = await this.sqlClient.raw(query.toQuery());
    } catch (e) {
      console.log(e);
      result.data.list = [];
    }
    return result;
  }

  abstract createDatabaseIfNotExists(_args): Promise<any>;

  abstract createTableIfNotExists(_args): Promise<any>;

  async raw(statements, ...args) {
    const start = new Date().getTime();
    let response = null;
    let end = null,
      timeTaken = null;
    try {
      response = await this.sqlClient.raw(statements, ...args);
      end = new Date().getTime();
      timeTaken = end - start;
      log.api(`Query: (${statements}) [Took: ${timeTaken} ms]`);
      this.emit(`${statements} [Took: ${timeTaken} ms]`);
      return response;
    } catch (e) {
      end = new Date().getTime();
      timeTaken = end - start;
      this.emitE(`${e} [Took: ${timeTaken} ms]`);
      console.log(e);
      throw e;
    }
  }

  // Todo: error handling
  async insert(args) {
    const { tn, data } = args;
    const res = await this.sqlClient.raw(
      this.sqlClient(tn).insert(data).toQuery(),
    );
    log.debug(res);
    return res;
  }

  async update(args) {
    const { tn, data, whereConditions } = args;
    const res = await this.sqlClient.raw(
      this.sqlClient(tn).where(whereConditions).update(data).toQuery(),
    );
    return res;
  }

  async delete(args) {
    const { tn, whereConditions } = args;
    const res = await this.sqlClient.raw(
      this.sqlClient(tn).where(whereConditions).del().toQuery(),
    );
    log.debug(res);
    return res;
  }

  async remove(tn, where) {
    await this.sqlClient.raw(this.sqlClient(tn).del().where(where).toQuery());
  }

  abstract hasTable(_tn);

  abstract hasDatabase(_databaseName);

  abstract getKnexDataTypes();

  getKnexDataTypesAdvanced(args = {}) {
    const result = new Result();

    result.data.list = [
      {
        type: 'int',
        dtxp: '10',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'tinyint',
        dtxp: '1',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'smallint',
        dtxp: '5',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'mediumint',
        dtxp: '8',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'bigint',
        dtxp: '20',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'bit',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '1',
      },
      {
        type: 'boolean',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'boolean',
        cdf: '',
      },
      {
        type: 'float',
        dtxp: '10',
        dtxs: '2',
        aggrDataType: 'float',
        cdf: '',
      },
      {
        type: 'decimal',
        dtxp: '10',
        dtxs: '2',
        aggrDataType: 'float',
        cdf: '',
      },
      {
        type: 'double',
        dtxp: '10',
        dtxs: '2',
        aggrDataType: 'float',
        cdf: '',
      },
      {
        type: 'serial',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'numeric',
        cdf: '',
      },
      {
        type: 'date',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'datetime',
        cdf: '',
      },
      {
        type: 'datetime',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'datetime',
        cdf: '',
      },
      {
        type: 'timestamp',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'datetime',
        cdf: '',
      },
      {
        type: 'time',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'time',
        cdf: '',
      },
      {
        type: 'year',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'year',
        cdf: '',
      },
      {
        type: 'char',
        dtxp: '10',
        dtxs: '',
        aggrDataType: 'char',
        cdf: '',
      },
      {
        type: 'varchar',
        dtxp: '10',
        dtxs: '',
        aggrDataType: 'char',
        cdf: '',
      },
      {
        type: 'nchar',
        dtxp: '10',
        dtxs: '',
        aggrDataType: 'char',
        cdf: '',
      },
      {
        type: 'text',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'text',
        cdf: '',
      },
      {
        type: 'tinytext',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'text',
        cdf: '',
      },
      {
        type: 'mediumtext',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'text',
        cdf: '',
      },
      {
        type: 'longtext',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'text',
        cdf: '',
      },
      {
        type: 'binary',
        dtxp: '255',
        dtxs: '',
        aggrDataType: 'binary',
        cdf: '',
      },
      {
        type: 'varbinary',
        dtxp: '255',
        dtxs: '',
        aggrDataType: 'binary',
        cdf: '',
      },
      {
        type: 'blob',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'blob',
        cdf: '',
      },
      {
        type: 'tinyblob',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'blob',
        cdf: '',
      },
      {
        type: 'mediumblob',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'blob',
        cdf: '',
      },
      {
        type: 'longblob',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'blob',
        cdf: '',
      },
      {
        type: 'enum',
        dtxp: `'a','b'`,
        dtxs: '',
        aggrDataType: 'enum',
        cdf: '',
      },
      {
        type: 'set',
        dtxp: `'a','b'`,
        dtxs: '',
        aggrDataType: 'set',
        cdf: '',
      },
      {
        type: 'geometry',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'point',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'linestring',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'polygon',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'multipoint',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'multilinestring',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'multipolygon',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'geometry',
        cdf: '',
      },
      {
        type: 'json',
        dtxp: '',
        dtxs: '',
        aggrDataType: 'json',
        cdf: '',
      },
    ];

    if (args && 'aggrDataType' in args) {
      result.data.list = result.data.list.filter(
        (d) => d.aggrDataType === args['aggrDataType'],
      );
    }

    return result;
  }

  // /**
  //  *
  //  * @param {Object} - args
  //  * @param {String} - args.tn
  //  * @param {Object[]} - args.columns
  //  * @param {String} - args.columns[].tn
  //  * @param {String} - args.columns[].cn
  //  * @param {String} - args.columns[].dt
  //  * @param {String} - args.columns[].np
  //  * @param {String} - args.columns[].ns -
  //  * @param {String} - args.columns[].clen -
  //  * @param {String} - args.columns[].dp -
  //  * @param {String} - args.columns[].cop -
  //  * @param {String} - args.columns[].pk -
  //  * @param {String} - args.columns[].nrqd -
  //  * @param {String} - args.columns[].not_nullable -
  //  * @param {String} - args.columns[].ct -
  //  * @param {String} - args.columns[].un -
  //  * @param {String} - args.columns[].ai -
  //  * @param {String} - args.columns[].unique -
  //  * @param {String} - args.columns[].cdf -
  //  * @param {String} - args.columns[].cc -
  //  * @param {String} - args.columns[].csn -
  //  * @param {String} - args.columns[].dtx
  //  *                     - value will be 'specificType' for all cols except ai
  //  *                     - for ai it will be integer, bigInteger
  //  *                     - tiny, small and medium Int auto increement is not supported
  //  * @param {String} - args.columns[].dtxp - to use in UI
  //  * @param {String} - args.columns[].dtxs - to use in UI
  //  * @returns {Promise<{upStatement, downStatement}>}
  //  */
  // async tableCreate(args) {
  //   const _func = this.tableCreate.name;
  //   const result = new Result();
  //   log.api(`${_func}:args:`, args);
  //
  //   try {
  //     args.table = args.tn;
  //     args.sqlClient = this.sqlClient;
  //
  //     /**************** create table ****************/
  //     let upQuery = createTable(args);
  //     await this.sqlClient.raw(upQuery);
  //
  //     const downStatement = this.sqlClient.schema.dropTable(args.table).toSQL();
  //
  //     this.emit(`Success : ${upQuery}`);
  //
  //     /**************** return files *************** */
  //     result.data.object = {
  //       upStatement: [{sql: upQuery}],
  //       downStatement
  //     };
  //   } catch (e) {
  //     log.ppe(e, _func);
  //     throw e;
  //   }
  //
  //   return result;
  // }

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
   * @returns {Promise<{upStatement, downStatement}>}
   */
  abstract tableCreate(args): Promise<any>;

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
        this.sqlClient.schema.renameTable(args.tn_old, args.tn).toQuery(),
      );

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema.renameTable(args.tn_old, args.tn).toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema.renameTable(args.tn, args.tn_old).toQuery();

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

  // /**
  //  *
  //  * @param {Object} - args
  //  * @param {String} - args.table
  //  * @param {String} - args.table
  //  * @param {Object[]} - args.columns
  //  * @param {String} - args.columns[].tn
  //  * @param {String} - args.columns[].cn
  //  * @param {String} - args.columns[].dt
  //  * @param {String} - args.columns[].np
  //  * @param {String} - args.columns[].ns -
  //  * @param {String} - args.columns[].clen -
  //  * @param {String} - args.columns[].dp -
  //  * @param {String} - args.columns[].cop -
  //  * @param {String} - args.columns[].pk -
  //  * @param {String} - args.columns[].nrqd -
  //  * @param {String} - args.columns[].not_nullable -
  //  * @param {String} - args.columns[].ct -
  //  * @param {String} - args.columns[].un -
  //  * @param {String} - args.columns[].ai -
  //  * @param {String} - args.columns[].unique -
  //  * @param {String} - args.columns[].cdf -
  //  * @param {String} - args.columns[].cc -
  //  * @param {String} - args.columns[].csn -
  //  * @param {Number} - args.columns[].altered - 1,2,4 = addition,edited,deleted
  //  * @returns {Promise<{upStatement, downStatement}>}
  //  */
  // async tableUpdate(args) {
  //   const _func = this.tableUpdate.name;
  //   const result = new Result();
  //   log.api(`${_func}:args:`, args);
  //
  //   try {
  //     args.table = args.tn;
  //     const originalColumns = args.originalColumns;
  //     args.connectionConfig = this._connectionConfig;
  //     args.sqlClient = this.sqlClient;
  //
  //     let upQuery = "";
  //     let downQuery = "";
  //
  //     for (let i = 0; i < args.columns.length; ++i) {
  //       const oldColumn = find(originalColumns, {
  //         cn: args.columns[i].cno
  //       });
  //
  //       if (args.columns[i].altered & 4) {
  //         // col remove
  //         upQuery += alterTableRemoveColumn(
  //           args.columns[i],
  //           oldColumn,
  //           upQuery
  //         );
  //         downQuery += alterTableAddColumn(
  //           oldColumn,
  //           args.columns[i],
  //           downQuery
  //         );
  //       } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
  //         // col edit
  //         upQuery += alterTableChangeColumn(
  //           args.columns[i],
  //           oldColumn,
  //           upQuery
  //         );
  //         downQuery += alterTableChangeColumn(
  //           oldColumn,
  //           args.columns[i],
  //           downQuery
  //         );
  //       } else if (args.columns[i].altered & 1) {
  //         // col addition
  //         upQuery += alterTableAddColumn(args.columns[i], oldColumn, upQuery);
  //         downQuery += alterTableRemoveColumn(
  //           args.columns[i],
  //           oldColumn,
  //           downQuery
  //         );
  //       }
  //     }
  //
  //     upQuery += alterTablePK(args.columns, args.originalColumns, upQuery);
  //     downQuery += alterTablePK(args.originalColumns, args.columns, downQuery);
  //
  //     if (upQuery) {
  //       upQuery = `ALTER TABLE ${args.columns[0].tn} ${upQuery};`;
  //       downQuery = `ALTER TABLE ${args.columns[0].tn} ${downQuery};`;
  //     }
  //
  //     await this.sqlClient.raw(upQuery);
  //
  //     console.log(upQuery);
  //
  //     result.data.object = {
  //       upStatement: [{sql: upQuery}],
  //       downStatement: [{sql: downQuery}]
  //     };
  //   } catch (e) {
  //     log.ppe(e, _func);
  //     throw e;
  //   }
  //
  //   return result;
  // }

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
  abstract tableUpdate(args): Promise<any>;

  /**
   *
   * @param {Object} - args
   * @param args.tn
   * @returns {Promise<{upStatement, downStatement}>}
   */
  abstract tableDelete(args): Promise<any>;

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
      args.table = args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      const query = this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique) {
          table.index(args.columns, indexName);
        } else {
          table.unique(args.columns, indexName);
        }
      });

      await this.sqlClient.raw(query.toQuery());

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
      args.table = args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      const query = this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique_original) {
          table.dropIndex(args.columns, indexName);
        } else {
          table.dropUnique(args.columns, indexName);
        }
      });

      await this.sqlClient.raw(query.toQuery());

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
      const upQb = this.sqlClient.schema.table(
        args.childTable,
        function (table) {
          table = table
            .foreign(args.childColumn, foreignKeyName)
            .references(args.parentColumn)
            .on(args.parentTable);

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
          .table(args.childTable, function (table) {
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

      const query = this.sqlClient.schema.table(
        args.childTable,
        function (table) {
          table.dropForeign(args.childColumn, foreignKeyName);
        },
      );

      await this.sqlClient.raw(query.toQuery());

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTable, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      const downQuery = this.sqlClient.schema.table(
        args.childTable,
        function (table) {
          table
            .foreign(args.childColumn, foreignKeyName)
            .references(args.parentColumn)
            .on(args.parentTable);
        },
      );

      await this.sqlClient.raw(downQuery.toQuery());

      const downStatement = this.querySeparator() + downQuery.toQuery();

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

  getKnexDataType(dt) {
    try {
      // const Type = dt;
      //
      // const list = [
      //   'integer',
      //   'bigInteger',
      //   'text',
      //   'string',
      //   'float',
      //   'decimal',
      //   'boolean',
      //   'date',
      //   'datetime',
      //   'time',
      //   'timestamp',
      //   'binary',
      //   'enu',
      //   'json',
      //   'specificType'
      // ];

      switch (dt) {
        case 'int':
          return 'integer';
          break;

        case 'bigint':
          return 'bigInteger';
          break;

        case 'varchar':
          return 'string';
          break;

        case 'text':
        case 'float':
        case 'decimal':
        case 'boolean':
        case 'date':
        case 'datetime':
        case 'time':
        case 'timestamp':
        case 'binary':
        case 'json':
          return dt;
          break;

        case 'enum':
          return 'enu';
          break;

        default:
          return 'specificType';
          break;
      }

      // // TODO: Im sure there are more types to handle here
      // const strTypes = [
      //   "varchar",
      //   "text",
      //   "char",
      //   "tinytext",
      //   "mediumtext",
      //   "longtext",
      //   "ntext",
      //   "image",
      //   "blob",
      //   "mediumblob",
      //   "longblob",
      //   "binary",
      //   "varbinary",
      //   "character",
      //   "character varying",
      //   "nchar",
      //   "nvarchar",
      //   "clob",
      //   "nvarchar2",
      //   "varchar2",
      //   "raw",
      //   "long raw",
      //   "bfile",
      //   "nclob"
      // ];
      // const intTypes = [
      //   "bit",
      //   "integer",
      //   "int",
      //   "smallint",
      //   "mediumint",
      //   "bigint",
      //   "tinyint",
      //   "int2",
      //   "int4",
      //   "int8",
      //   "long",
      //   "serial",
      //   "bigserial",
      //   "smallserial",
      //   "bool",
      //   "boolean",
      //   "number"
      // ];
      // const floatTypes = [
      //   "float",
      //   "double",
      //   "decimal",
      //   "numeric",
      //   "real",
      //   "double precision",
      //   "real",
      //   "money",
      //   "smallmoney",
      //   "dec"
      // ];
      // const dateTypes = [
      //   "date",
      //   "datetime",
      //   "timestamp",
      //   "time",
      //   "year",
      //   "timestamp without time zone",
      //   "timestamp with time zone",
      //   "time without time zone",
      //   "time with time zone",
      //   "datetime2",
      //   "smalldatetime",
      //   "datetimeoffset",
      //   "interval year",
      //   "interval day"
      // ];
      //
      // let knexDataType = {};
      //
      // if (this.getType(Type, strTypes)) {
      //   knexDataType = "string";
      // } else if (this.getType(Type, intTypes)) {
      //   knexDataType = "integer";
      // } else if (this.getType(Type, floatTypes)) {
      //   knexDataType = "float";
      // } else if (this.getType(Type, dateTypes)) {
      //   knexDataType = "date";
      // } else {
      //   knexDataType = "string";
      // }
      //
      // return knexDataType;
    } catch (e) {
      log.debug(e);
      return 'string';
    }
  }

  getType(colType, typesArr) {
    for (let i = 0; i < typesArr.length; ++i) {
      // if (typesArr[i].indexOf(colType) !== -1) {
      //   return 1;
      // }

      if (colType.indexOf(typesArr[i]) !== -1) {
        return 1;
      }
    }
    return 0;
  }

  // async tableRowList(args = {}) {
  //   let results = [];

  //   if (args.where) {
  //     results = await this.sqlClient.from(args.tn).where(args.where);
  //   } else {
  //     results = await this.sqlClient.from(args.tn);
  //   }

  //   return results;
  // }

  // async tableRowRead(args = {}) {
  //   const results = await this.sqlClient
  //     .select()
  //     .from(args.tn)
  //     .where(args.where);
  //   return results;
  // }

  // async tableRowCreate(args = {}) {
  //   const value = await this.sqlClient(args.tn).insert((args = {}));
  //   args.id = value[0];
  //   return args;
  // }

  // async tableRowUpdate(args = {}) {
  //   const result = await this.sqlClient(args.tn)
  //     .update(args.data)
  //     .where(args.where);
  //   return result;
  // }

  // async tableRowRemove(args = {}) {
  //   const result = await this.sqlClient(args.tn)
  //     .where(args.where)
  //     .del();
  //   return result;
  // }

  /** ************** START : faker functions *************** */
  /**
   *
   * @param args
   * @param args.seedsFolder
   * @param args.tn
   * @returns {Promise<Result>}
   */
  async fakerColumnsList(args) {
    const _func = this.fakerColumnsList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const fakerColumnPath = path.join(args.seedsFolder, `${args.tn}.json`);

      const data = await promisify(jsonfile.readFile)(fakerColumnPath);

      // this.emit(`Success :`)

      result.data.list = data;
    } catch (e) {
      log.ppe(e, _func);
      // throw e;
      result.data.list = [];
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @param args.tn
   * @param args.fakerColumns
   * @returns {Promise<Result>}
   */
  async fakerColumnsCreate(args) {
    const _func = this.fakerColumnsCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const fakerColumnPath = path.join(args.seedsFolder, `${args.tn}.json`);

      await promisify(jsonfile.writeFile)(fakerColumnPath, args.fakerColumns, {
        spaces: 2,
      });

      this.emit(`Created : ${fakerColumnPath}`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async fakerColumnsUpdate(args) {
    const _func = this.fakerColumnsUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      this.emit(`Success :`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async fakerColumnsDelete(args) {
    const _func = this.fakerColumnsDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      this.emit(`Success :`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /** ************** END : faker functions *************** */

  /** ************** START : seed functions *************** */

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @param args.seedsFolder
   * @returns {Promise<Result>}
   */
  async seedInit(args) {
    const _func = this.seedInit.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    console.log('in knex SeedInit');

    try {
      await mkdirp(args.seedsFolder);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async seedTerm(args) {
    const _func = this.seedInit.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      this.emit(`Success : seedTerm`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @returns {Promise<Result>}
   */
  async seedStart(args) {
    const _func = this.seedStart.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      this.emit(`Seeding : Started`);

      await this.mockDb(args);
      this.emit(`Seeding : Finished`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async seedStop(args) {
    const _func = this.seedStop.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      this.emit(`Success : seedStop`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @returns {Promise<Result>}
   * @returns {result.data} - json file content
   */
  async seedSettingsRead(args) {
    const _func = this.seedSettingsRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      // this.emit(`Success : seedSettingsRead`)
      const seedSettings = path.join(args.seedsFolder, '__xseeds.json');
      const data = await promisify(jsonfile.readFile)(seedSettings);
      result.data = data;
    } catch (e) {
      log.ppe(e, _func);
      // throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.seedsFolder
   * @param args.settings
   * @returns {Promise<Result>}
   */
  async seedSettingsCreate(args) {
    const _func = this.seedSettingsCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const seedSettings = path.join(args.seedsFolder, '__xseeds.json');

      await promisify(jsonfile.writeFile)(seedSettings, args.settings, {
        spaces: 2,
      });
      this.emit(`Success : Seed settings updated`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  querySeparator() {
    return '/* xc */\n';
  }

  getTnPath(t) {
    return t;
  }

  /** ************** END : seed functions *************** */

  abstract tableCreateStatement(_args): Promise<any>;

  abstract tableInsertStatement(_args): Promise<any>;

  abstract tableUpdateStatement(_args): Promise<any>;

  abstract tableDeleteStatement(_args): Promise<any>;

  abstract tableTruncateStatement(_args): Promise<any>;

  abstract tableSelectStatement(_args): Promise<any>;

  async sequelizeModelCreate(_args): Promise<any> {}

  genQuery(query, args = [], shouldSanitize: any = 0) {
    if (shouldSanitize) {
      args = ((Array.isArray(args) ? args : [args]) || []).map((s) =>
        typeof s === 'string' ? this.sanitize(s) : s,
      );
    }
    const rawQuery = this.sqlClient.raw(query, args).toQuery();
    return shouldSanitize ? this.sanitize(rawQuery) : this.unsanitize(rawQuery);
  }

  sanitize(str) {
    return str.replace(/([^\\]|^)(\?+)/g, (_, m1, m2) => {
      return `${m1}${m2.split('?').join('\\?')}`;
    });
  }

  unsanitize(str) {
    return str.replace(/\\[?]/g, '?');
  }

  genValue(value) {
    return this.genQuery('?', [value], true);
  }

  genIdentifier(identifier) {
    return this.genQuery('??', [identifier], true);
  }

  genRaw(raw) {
    const q = this.genQuery('?', [raw], true);

    if (typeof raw === 'number' || typeof raw === 'boolean') return q;

    return q.substring(1, q.length - 1);
  }

  sanitiseDataType(dt: string) {
    // allow only alphanumeric and space
    // eg: varchar, int, bigint, text, character varying, etc
    if (/^[\w -]+(?:\(\d+(?:\s?,\s?\d+)?\))?$/.test(dt)) return dt;

    throw new Error(`Invalid data type: ${dt}`);
  }

  // todo: add support to complex default values with functions and expressions
  sanitiseDefaultValue(value: string | number | boolean) {
    if (value === null || value === undefined) return undefined;

    if (typeof value === 'string') {
      // if value is null/true/false return as is
      if (['NULL', 'null', 'TRUE', 'true', 'FALSE', 'false'].includes(value))
        return value;

      // if value is a number, return as is
      if (/^\d+(\.\d+)?$/.test(value)) return value;

      // if value is a function, return as is
      // for example: CURRENT_TIMESTAMP(), NOW(), UUID(), etc
      if (/^\w+\(\)$/.test(value)) return value;

      // if value is a CURRENT_TIMESTAMP, return as is
      if (
        /^\s*current_timestamp(?:\(\))?(?:\s+on\s+update\s+current_timestamp(?:\(\))?)?\s*$/i.test(
          value,
        )
      )
        return value;

      // if value wrapped in single/double quotes, then extract value and sanitise
      const m = value.match(/^(['"])(.*)\1$/);
      if (m) {
        return this.genQuery('?', [
          // escape for single/double quotes no longer needed remove it
          m[2].replace(m[1] === '"' ? /\\"/g : /\\'/g, m[1]),
        ]);
      }

      // if any other type of string, just sanitise and return
      return this.genQuery('?', [value]);
    } else {
      // if any other type of value, just sanitise and return
      return this.genQuery('?', [value]);
    }
  }
}

// expose class
export default KnexClient;
