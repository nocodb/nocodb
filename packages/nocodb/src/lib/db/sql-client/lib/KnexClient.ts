/* eslint-disable no-constant-condition */
import { knex, Knex } from 'knex'
import Debug from '../../util/Debug';
import Emit from '../../util/emit';
import Result from '../../util/Result';

import lodash from 'lodash';
import fs from 'fs';
import { promisify } from 'util';
import jsonfile from 'jsonfile';
import path from 'path';
import mkdirp from 'mkdirp';
import Order from './order';
import * as dataHelp from './data.helper';
import SqlClient from './SqlClient';
import { Tele } from 'nc-help';
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

function createPks(table, columns, pks) {
  let pkCreate = 'table.primary([';
  for (let i = 0; i < pks.length; ++i) {
    if (i) {
      pkCreate += `"${columns[pks[i]].cn}"`;
    } else {
      pkCreate += `"${columns[pks[i]].cn}",`;
    }
  }
  pkCreate += `])`;

  eval(`var inMemoryFunc = function(table) {
    ${pkCreate}
  }`);
  console.log(pkCreate);
  // @ts-ignore
  inMemoryFunc(table);
}

function columnCreate(sqlClient, table, colUiObj) {
  let skip = false;
  let column;

  // TODO : write a function - is the type char
  if (
    colUiObj.dt === 'varchar' ||
    colUiObj.dt === 'char' ||
    colUiObj.dt === 'text'
  ) {
    colUiObj.cdf = colUiObj.cdf ? JSON.stringify(colUiObj.cdf) : null;
  } else colUiObj.cdf = colUiObj.cdf === '' ? null : colUiObj.cdf;

  if (colUiObj.ai) {
    if (colUiObj.dtx === 'bigInteger') {
      column = table.bigIncrements(colUiObj.cn);
      skip = true;
    } else {
      column = table.increments(colUiObj.cn);
      skip = true;
    }
  }

  // specifc type
  if (colUiObj.dtx === 'specificType' && !skip) {
    // console.log(colUiObj);
    const precision =
      colUiObj.dtxp && colUiObj.dtxp !== ' ' ? colUiObj.dtxp : null;
    const scale = colUiObj.dtxs && colUiObj.dtxs !== ' ' ? colUiObj.dtxs : null;
    if (precision && scale) {
      column = table.specificType(
        colUiObj.cn,
        `${colUiObj.dt}(${precision},${scale})`
      );
    } else if (precision) {
      column = table.specificType(colUiObj.cn, `${colUiObj.dt}(${precision})`);
    } else {
      column = table.specificType(colUiObj.cn, colUiObj.dt);
    }
  } else if (colUiObj.dtx === 'integer' && !skip) {
    column = table.integer(colUiObj.cn);
  } else if (colUiObj.dtx === 'bigInteger' && !skip) {
    column = table.bigInteger(colUiObj.cn);
  } else if (colUiObj.dtx === 'text' && !skip) {
    column = table.text(colUiObj.cn);
  } else if (colUiObj.dtx === 'string' && !skip) {
    column = table.string(colUiObj.cn);
  } else if (colUiObj.dtx === 'float' && !skip) {
    column = table.float(colUiObj.cn);
  } else if (colUiObj.dtx === 'decimal' && !skip) {
    column = table.decimal(colUiObj.cn);
  } else if (colUiObj.dtx === 'boolean' && !skip) {
    column = table.boolean(colUiObj.cn);
  } else if (colUiObj.dtx === 'date' && !skip) {
    column = table.date(colUiObj.cn);
  } else if (colUiObj.dtx === 'dateTime' && !skip) {
    column = table.dateTime(colUiObj.cn);
  } else if (colUiObj.dtx === 'time' && !skip) {
    column = table.time(colUiObj.cn);
  } else if (colUiObj.dtx === 'timestamp' && !skip) {
    column = table.timestamp(colUiObj.cn);
  } else if (colUiObj.dtx === 'enu' && !skip) {
    column = table.enu(colUiObj.cn, JSON.stringify(colUiObj.enuValue || []));
  } else if (colUiObj.dtx === 'json' && !skip) {
    column = table.json(colUiObj.cn);
  } else if (colUiObj.dtx === 'uuid' && !skip) {
    column = table.uuid(colUiObj.cn);
  }

  if (colUiObj.pk) {
    column.primary();
  }

  // log.debug(colUiObj.cn, colUiObj.nrqd);
  if (!colUiObj.rqd) {
    column.nullable();
  } else {
    column.notNullable();
  }

  if (colUiObj.ck) {
    column.unique();
  }

  if (colUiObj.un) {
    column.unsigned();
  }

  if (colUiObj.cdf) {
    column.defaultTo(sqlClient.raw(colUiObj.cdf));
  }

  // log.debug(colUiObj, colCreate);
  //
  // eval(`var inMemoryFunc = function(table) {
  //   ${colCreate}
  // }`);
  // console.log(colCreate);
  // inMemoryFunc(table);
}

function removeColumn(table, _n, _o) {
  const colCreate = `table.dropColumn(n.cn)`;

  // log.debug(n, o, colCreate);

  eval(`var inMemoryFunc = function(table) {
    ${colCreate}
  }`);

  // @ts-ignore
  inMemoryFunc(table);
}

function renameColumn(_knexClient, connectionConfig, _table, o, n): any {
  let upStatement = ``;
  let downStatement = ``;
  if (connectionConfig.client === 'mysql') {
    const type = n.ct;
    const nn = n.rqd ? 'NOT NULL' : '';
    const ai = n.ai ? 'AUTO_INCREMENT' : '';
    // const un = '';
    const _default = n.cdf ? `DEFAULT '${n.cdf}'` : '';

    upStatement = `ALTER TABLE \`${n.tn}\` CHANGE COLUMN
                  \`${o.cn}\` \`${n.cn}\` ${type} ${nn} ${ai} ${_default}`;

    downStatement = `ALTER TABLE \`${n.tn}\` CHANGE COLUMN
                  \`${n.cn}\` \`${o.cn}\` ${type} ${nn} ${ai} ${_default}`;

    const obj = {
      upStatement: [{ sql: upStatement }],
      downStatement: [{ sql: downStatement }],
    };

    // console.log(obj);

    return obj;
  }
}

function pkUpdate(table, n, o) {
  let colUpdate = 'table';
  // const skip = false;
  // const skipColumnDefault = false;
  // const skipColumnUnsigned = false;

  log.debug(n, o);

  colUpdate = ``;
  let pkCount = 0;
  for (let i = 0; i < o.length; ++i) {
    if (o[i].pk) {
      if (pkCount) {
        colUpdate += `,"${o[i].cn}"`;
      } else {
        colUpdate += `table.dropPrimary(["${o[i].cn}"`;
      }

      pkCount += 1;
      log.debug(colUpdate);
    }
  }
  if (pkCount) colUpdate += `]);\n`;

  colUpdate += ``;
  pkCount = 0;
  for (let i = 0; i < n.length; ++i) {
    if (n[i].pk) {
      if (pkCount) {
        colUpdate += `,"${n[i].cn}"`;
      } else {
        colUpdate += `table.primary(["${n[i].cn}"`;
      }

      pkCount += 1;
      log.debug(colUpdate);
    }
  }
  if (pkCount) colUpdate += `]);\n`;

  log.debug(colUpdate);

  eval(`var inMemoryFunc = function(table) {
    ${colUpdate}
  }`);

  // console.log(colUpdate);

  // @ts-ignore
  inMemoryFunc(table);
}

function columnUpdate(knexClient, table, n, o) {
  let skip = false;
  let skipColumnDefault = false;
  let skipColumnUnsigned = false;
  let skipNotNullable = false;
  let column;

  // TODO : write a function - is the type char
  if (n.dt === 'varchar' || n.dt === 'char' || n.dt === 'text') {
    n.cdf = n.cdf ? JSON.stringify(n.cdf) : null;
  } else {
    n.cdf = n.cdf === '' ? null : n.cdf;
  }

  if ('ai' in n && o && n.ai !== o.ai && n.ai) {
    column = table.increments(n.cn);
    skip = true;
  } else if ('pk' in n && (!o || n.pk !== o.pk) && n.pk) {
    column = table.primary(n.cn);
  } else if ('pk' in n && o && n.pk !== o.pk && !n.pk) {
    column = table.dropPrimary(n.cn);
  }

  if ('dtx' in n && n.dtx === 'specificType' && !skip) {
    const precision = n.dtxp && n.dtxp !== ' ' ? n.dtxp : null;
    const scale = n.dtxs && n.dtxs !== ' ' ? n.dtxs : null;
    if (precision && scale) {
      column = table.specificType(n.cn, `${n.dt}(${precision},${scale})`);
    } else if (precision) {
      column = table.specificType(n.cn, `${n.dt}(${precision})`);
    } else {
      column = table.specificType(n.cn, n.dt);
    }
  } else if ('dtx' in n && n.dtx === 'integer' && !skip) {
    if (!o) {
      column = table.integer(n.cn);
    } else {
      column = table.integer(n.cn, n.dtxp);
    }
  } else if ('dtx' in n && n.dtx === 'bigInteger' && !skip) {
    column = table.bigInteger(n.cn);
  } else if ('dtx' in n && n.dtx === 'text' && !skip) {
    column = table.text(n.cn);
  } else if ('dtx' in n && n.dtx === 'string' && !skip) {
    if (!o) {
      column = table.string(n.cn);
    } else {
      column = table.string(n.cn, n.dtxp);
    }
  } else if ('dtx' in n && n.dtx === 'float' && !skip) {
    if (!o) {
      column = table.float(n.cn);
    } else {
      column = table.float(n.cn, n.dtxp, n.dtxs);
    }
  } else if ('dtx' in n && n.dtx === 'decimal' && !skip) {
    if (!o) {
      column = table.decimal(n.cn);
    } else {
      column = table.decimal(n.cn, n.dtxp, n.dtxs);
    }
  } else if ('dtx' in n && n.dtx === 'boolean' && !skip) {
    column = table.boolean(n.cn);
  } else if ('dtx' in n && n.dtx === 'binary' && !skip) {
    column = table.binary(n.cn);
  } else if ('dtx' in n && n.dtx === 'date' && !skip) {
    column = table.date(n.cn);
  } else if ('dtx' in n && n.dtx === 'dateTime' && !skip) {
    column = table.dateTime(n.cn);
  } else if ('dtx' in n && n.dtx === 'time' && !skip) {
    column = table.time(n.cn);
  } else if ('dtx' in n && n.dtx === 'timestamp' && !skip) {
    column = table.timestamp(n.cn);
  } else if ('dtx' in n && n.dtx === 'enu' && !skip) {
    column = table.enu(n.cn, JSON.stringify(n.enuValue || []));
  } else if ('dtx' in n && n.dtx === 'json' && !skip) {
    column = table.json(n.cn);
  } else if ('dtx' in n && n.dtx === 'uuid' && !skip) {
    column = table.uuid(n.cn);
  }

  if (o) {
    // updating existing column
    /**
     * if rqd is getting DISABLED and there is non_null value for default
     *  query builder has to include defaultTo() and unsigned()
     */
    if (n.rqd !== o.rqd && !n.rqd) {
      column.nullable();

      if (n.cdf) {
        column.defaultTo(knexClient.raw(n.cdf));
        skipColumnDefault = true;
      }

      if (n.un) {
        column.unsigned();
        skipColumnUnsigned = true;
      }
    }

    /**
     * if rqd is getting ENABLED and there is non_null value for default
     *  query builder has to include defaultTo()
     */
    if (n.rqd !== o.rqd && n.rqd && !skipNotNullable) {
      column.notNullable();
      skipNotNullable = true;

      if (n.cdf && !skipColumnDefault) {
        column.defaultTo(knexClient.raw(n.cdf));
        skipColumnDefault = true;
      }
      if (n.un && !skipColumnUnsigned) {
        column.unsigned();
        skipColumnUnsigned = true;
      }
    }

    if (n.un !== o.un && !skipColumnUnsigned) {
      if (n.un) column.unsigned();

      if (n.cdf && !skipColumnDefault) {
        column.defaultTo(knexClient.raw(n.cdf));
        skipColumnDefault = true;
      }
      if (n.rqd && !skipNotNullable) {
        column.notNullable();
        skipNotNullable = true;
      }
    }

    /**
     * if default is getting enabled and there is a rqd enabled
     * query builder has to include defaultTo()
     */
    if (n.cdf !== o.cdf && !skipColumnDefault) {
      // console.log(knexClient.raw(n.cdf))
      column.defaultTo(n.cdf ? knexClient.raw(n.cdf) : null);

      if (n.rqd && !skipNotNullable) {
        column.notNullable();
        skipNotNullable = true;
      }
      if (n.un && !skipColumnUnsigned) {
        column.unsigned();
        skipColumnUnsigned = true;
      }
    }

    if ((!o || n.ck !== o.ck) && n.ck) {
      column.unique();
    }

    if ((!o || n.ck !== o.ck) && !n.ck) {
      column.dropUnique(n.cn);
    }
  } else {
    // adding a new column

    if (n.rqd) {
      column.notNullable();
    } else if (!n.rqd && !n.cdf) {
      column.nullable();
    }

    if (n.un) {
      column.unsigned();
    }

    if (n.cdf) {
      column.defaultTo(knexClient.raw(n.cdf));
    }
  }

  // /**
  //  * if rqd is getting DISABLED and there is non_null value for default
  //  *  query builder has to include defaultTo() and unsigned()
  //  */
  // if ("rqd" in n && (!o || n.rqd !== o.rqd) && !n.rqd) {
  //   colUpdate += `.nullable()`;
  //
  //   if (n.cdf) {
  //     colUpdate += `.defaultTo(knexClient.raw(\`${n.cdf}\`))`;
  //   }
  //
  //   if (n.un) {
  //     colUpdate += `.unsigned()`;
  //   }
  // }
  //
  // /**
  //  * if rqd is getting ENABLED and there is non_null value for default
  //  *  query builder has to include defaultTo()
  //  */
  // if ("rqd" in n &&
  //   (!o || n.rqd !== o.rqd) &&
  //   !n.rqd === false) {
  //   colUpdate += `.notNullable()`;
  //
  //   if (n.cdf && !skipColumnDefault) {
  //     colUpdate += `.defaultTo(knexClient.raw(\`${n.cdf}\`))`;
  //     skipColumnDefault = true;
  //   }
  //   if (n.un && !skipColumnDefault) {
  //     colUpdate += `.unsigned()`;
  //     skipColumnUnsigned = true;
  //   }
  //
  // }
  //
  // if ("ck" in n &&
  //   (!o || n.ck !== o.ck) &&
  //   n.ck) {
  //   colUpdate += `.unique()`;
  // }
  //
  // if ("ck" in n &&
  //   (o && n.ck !== o.ck) &&
  //   !n.ck) {
  //   const dropUnique = `column.dropUnique(\"${n.cn}\");\n`;
  //   colUpdate = dropUnique + colUpdate;
  // }
  //
  // if ("un" in n && (!o || n.un !== o.un) && !skipColumnUnsigned) {
  //   if (n.un)
  //     colUpdate += `.unsigned()`;
  //
  //   if (n.cdf && !skipColumnDefault) {
  //     colUpdate += `.defaultTo(knexClient.raw(\`${n.cdf}\`))`;
  //     skipColumnDefault = true;
  //   }
  //   if (n.rqd) {
  //     colUpdate += `.notNullable()`;
  //   }
  // }
  //
  // /**
  //  * if default is getting enabled and there is a rqd enabled
  //  * query builder has to include defaultTo()
  //  */
  // if ("cdf" in n && (o && n.cdf !== o.cdf) && !skipColumnDefault) {
  //   colUpdate += `.defaultTo(knexClient.raw(\`${n.cdf}\`))`;
  //   if (n.rqd) {
  //     colUpdate += `.notNullable()`;
  //   }
  //   if (n.un) {
  //     colUpdate += `.unsigned()`;
  //     skipColumnUnsigned = true;
  //   }
  //
  // }

  if (o && o.cno !== n.cn) {
    column.renameColumn(n.cno, n.cn);
  }

  if (n.altered & 1) {
    // added - do nothing
  } else if (n.altered & 2) {
    // modified
    column.alter();
  }
}

class KnexClient extends SqlClient {
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
      // console.log('KnexClient',this.connectionConfig);
      if (
        this.connectionConfig.connection.ssl &&
        typeof this.connectionConfig.connection.ssl === 'object'
      ) {
        if (this.connectionConfig.connection.ssl.caFilePath) {
          this.connectionConfig.connection.ssl.ca = fs
            .readFileSync(this.connectionConfig.connection.ssl.caFilePath)
            .toString();
        }
        if (this.connectionConfig.connection.ssl.keyFilePath) {
          this.connectionConfig.connection.ssl.key = fs
            .readFileSync(this.connectionConfig.connection.ssl.keyFilePath)
            .toString();
        }
        if (this.connectionConfig.connection.ssl.certFilePath) {
          this.connectionConfig.connection.ssl.cert = fs
            .readFileSync(this.connectionConfig.connection.ssl.certFilePath)
            .toString();
        }
      }
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

  _validateInput() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      return (
        packageJson.name === 'nocodb' || 'nocodb' in packageJson.dependencies
      );
    } catch (e) {}
    return true;
  }

  validateInput() {
    try {
      if (!('___ext' in KnexClient)) {
        KnexClient.___ext = this._validateInput();
      }
      if (!KnexClient.___ext) {
        Tele.emit('evt', {
          evt_type: 'project:external',
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
      mssql: 0,
      oracledb: 0,
      sqlite3: 0,
      rest: 0,
      graphql: 0,
      ...data,
    });
  }

  async schemaCreateWithCredentials(_args): Promise<any> {}

  async sequenceList(_args = {}): Promise<any> {}

  async sequenceCreate(_args = {}): Promise<any> {}

  async sequenceUpdate(_args = {}): Promise<any> {}

  async sequenceDelete(_args = {}): Promise<any> {}

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
    if (lodash.findIndex(tableObj.foreignKeys, { cn: cn }) === -1) {
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
          lodash.findIndex(tableObj.primaryKeys, {
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
      const col = lodash.find(tableObj.columns, {
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
    let foundIndex = lodash.findIndex(
      tableObj.columns,
      { ck: 'UNI' },
      searchFrom
    );

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
      foundIndex = lodash.findIndex(
        tableObj.columns,
        { ck: 'UNI' },
        searchFrom + 1
      );
    }

    let max2 = 10000;
    searchFrom = 0;
    foundIndex = lodash.findIndex(tableObj.columns, { ck: 'MUL' }, searchFrom);

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
      foundIndex = lodash.findIndex(
        tableObj.columns,
        { ck: 'MUL' },
        searchFrom + 1
      );
    }

    // console.log('min of: ', max, max1, max2, maxy);
    return Math.min(max, max1, max2, maxy);
  }

  getColumnType(_dbType): any {}

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

  getMinMax(_columnObject) {}

  async mockDb(args) {
    // console.time('mockDb');
    const faker = require('faker');

    try {
      const settings = await jsonfile.readFile(
        path.join(args.seedsFolder, '__xseeds.json')
      );

      await this.dbCacheInitAsyncKnex();

      const order = new Order(this.metaDb.erMatrix);

      const orders = order.getOrder();
      console.log('Insert order by table index: ', orders);
      // console.log('Insert order by table name: ');

      // order.resetIndex(15, 16);
      // orders = order.getOrder();
      // console.log('Insert order by table index: ', orders);
      // console.log('Insert order by table name: ');
      // return;

      /** ************** START : reset all tables *************** */
      await this.knex.raw('SET foreign_key_checks = 0');
      for (let i = 0; i < orders.order.length; ++i) {
        const tn = this.metaDb.erIndexTableObj[orders.order[i]];
        if (tn !== 'xc_evolutions' && this.metaDb.tables[tn].is_view === null) {
          await this.knex.raw(`truncate ${tn}`);
          await this.knex.raw(`ALTER TABLE ${tn} AUTO_INCREMENT = 0;`);
        }
      }
      await this.knex.raw('SET foreign_key_checks = 1');
      /** ************** END : reset all tables *************** */

      // return;

      // iterate over each table
      for (let i = 0; i < orders.order.length; ++i) {
        const tn = this.metaDb.erIndexTableObj[orders.order[i]];
        const tableObj = this.metaDb.tables[tn];

        if (tn === 'xc_evolutions') {
        } else {
          /** ************** START : ignore views *************** */
          if (this.metaDb.tables[tn].is_view !== null) {
            console.log('ignore view', tn);
            continue;
          }

          let numOfRows = +settings.rows.value || 8;
          const rows = [];
          let fks = [];

          let fakerColumns: any = await this.fakerColumnsList({
            seedsFolder: args.seedsFolder,
            tn: tn,
          });
          fakerColumns = fakerColumns.data.list;

          let maxPks = numOfRows;
          if (tableObj.primaryKeys.length) {
            maxPks = this._getMaxPksPossible(tableObj.primaryKeys[0]);
          }

          console.log('MaxPks Possible', maxPks);

          if (maxPks < numOfRows) {
            numOfRows = maxPks;
          }

          console.log(`\n\n Preparing to insert ${numOfRows} in ${tn}`);

          /** ************** START : create empty rows *************** */
          for (let k = 0; k < numOfRows; ++k) {
            rows.push({});
          }

          // iterate over each foreign key in this table
          /** ************** START : get FK column values *************** */
          for (let j = 0; j < this.metaDb.tables[tn].foreignKeys.length; ++j) {
            const fkObj = this.metaDb.tables[tn].foreignKeys[j];
            // console.log('\n\tStart : get FK row', fkObj['rtn'] + '.' + fkObj['rcn'] + ' === ' + fkObj['cn']);
            fks = await this.knex(fkObj.rtn)
              .select(`${fkObj.rcn} as ${fkObj.cn}`)
              .limit(numOfRows);
            // console.log('fks:', fks);

            for (
              let rowIndex = 0, fksIndex = 0;
              rowIndex < numOfRows && fksIndex < fks.length;
              fksIndex++
            ) {
              if (rowIndex < fks.length) {
                for (
                  let l = 0;
                  l < settings.foreign_key_rows.value && rowIndex < numOfRows;
                  ++l, ++rowIndex
                ) {
                  rows[rowIndex][fkObj.cn] = fks[fksIndex][fkObj.cn];
                  // rows[k+1][fkObj['cn']] = fks[k][fkObj['cn']];
                }
              } else if (fks.length) {
                // rows[k][fkObj['cn']] = fks[fks.length - 1][fkObj['cn']];
                break;
              } else {
                rows[rowIndex][fkObj.cn] = null;
              }
            }

            // for (let k = 0; k < numOfRows; ++k) {
            //   if (k < fks.length) {
            //     rows[k][fkObj['cn']] = fks[k][fkObj['cn']];
            //   } else {
            //     if (fks.length) {
            //       //rows[k][fkObj['cn']] = fks[fks.length - 1][fkObj['cn']];
            //       break;
            //     } else {
            //       rows[k][fkObj['cn']] = null;
            //     }
            //   }
            //
            // }
            // console.log('\tEnd : get FK row', fkObj['rtn'] + '.' + fkObj['rcn'] + ' === ' + fkObj['cn']);
          }

          /** ************** START : populate columns of the table *************** */
          for (let j = 0; j < this.metaDb.tables[tn].columns.length; ++j) {
            const colObj = this.metaDb.tables[tn].columns[j];
            const colUiObj = this.metaDb.tables[tn].uiModel.columns[j];
            const fakerColObj = fakerColumns.find(
              (col) => col.cn === colObj.cn
            );

            console.log(
              '\tColumn: ',
              colObj.cn,
              ' of type ',
              colObj.dt,
              colObj.np,
              colObj.clen
            );

            const dt = this.getKnexDataTypeMock(colObj.dt);
            const numDict = {};
            const floatDict = {};
            const strDict = {};

            for (let k = 0; k < numOfRows; ++k) {
              // console.log(this.knex(tn).insert(rows).toSQL());
              console.log(rows);
              switch (dt) {
                case 'year':
                  rows[k][colObj.cn] = Math.floor(Math.random() * 180) + 1920;
                  break;

                case 'enum':
                  {
                    const enums = fakerColObj.dtxp
                      .split(',')
                      .map((v) => v.slice(1, -1));
                    const enumIndex = Math.floor(Math.random() * enums.length);
                    rows[k][colObj.cn] = enums[enumIndex];
                  }
                  break;
                case 'integer':
                  if (this._isColumnPrimary(colObj) && colUiObj.ai) {
                    // primary key is auto inc - ignore creating from faker
                    // rows[k][colObj['cn']] = 0;
                  } else if (this._isColumnForeignKey(tableObj, colObj.cn)) {
                    // foreign key - ignore creating from faker
                  } else {
                    while (1) {
                      console.log('..');

                      let num = this._getMaxNumPossible(fakerColObj);
                      num = Math.floor(Math.random() * num);
                      // let max = Math.pow(2, colObj['np'])
                      // num = num % max;

                      if (
                        (colObj.ck === 'UNI' ||
                          colObj.ck === 'MUL' ||
                          this._isColumnPrimaryForInserting(
                            tableObj,
                            colObj
                          )) &&
                        num in numDict
                      ) {
                        // console.log('>> num', num, numOfRows);
                      } else {
                        rows[k][colObj.cn] = num;
                        numDict[num] = num;
                        break;
                      }
                    }
                  }

                  break;

                case 'float':
                  while (1) {
                    let num = Math.floor(Math.random() * 2147483647);
                    const max = Math.pow(2, fakerColObj.dtxp);

                    num %= max;

                    if (
                      (colObj.ck === 'UNI' ||
                        colObj.ck === 'MUL' ||
                        this._isColumnPrimaryForInserting(tableObj, colObj)) &&
                      num in floatDict
                    ) {
                      // console.log('>> num', num, numOfRows);
                    } else {
                      rows[k][colObj.cn] = num;
                      floatDict[num] = num;
                      break;
                    }
                  }
                  // rows[k][colObj['cn']] = faker.random.number();
                  break;

                case 'date':
                  rows[k][colObj.cn] = faker.date.past();
                  break;
                case 'blob':
                  rows[k][colObj.cn] = faker.lorem.sentence();
                  break;
                case 'boolean':
                  rows[k][colObj.cn] = faker.random.boolean();
                  break;
                case 'geometry':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake('POINT({{random.number}}, {{random.number}})')
                  );
                  break;
                case 'point':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake('POINT({{random.number}}, {{random.number}})')
                  );
                  break;
                case 'linestring':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake(
                      'LineString(POINT({{random.number}}, {{random.number}}), POINT({{random.number}}, {{random.number}}))'
                    )
                  );
                  break;
                case 'polygon':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake(
                      "ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7,5 5))')"
                    )
                  );
                  break;
                case 'multipoint':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake(
                      "ST_MPointFromText('MULTIPOINT ({{random.number}} {{random.number}}, {{random.number}} {{random.number}}, {{random.number}} {{random.number}})')"
                    )
                  );
                  break;
                case 'multilinestring':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake(
                      "ST_GeomFromText('MultiLineString(({{random.number}} {{random.number}}, {{random.number}} {{random.number}}), ({{random.number}} {{random.number}}, {{random.number}} {{random.number}}))')"
                    )
                  );
                  break;
                case 'multipolygon':
                  rows[k][colObj.cn] = this.knex.raw(
                    faker.fake(
                      "ST_GeomFromText('MultiPolygon(((0 0,0 3,3 3,3 0,0 0),(1 1,1 2,2 2,2 1,1 1)))')"
                    )
                  );
                  break;
                case 'json':
                  rows[k][colObj.cn] = JSON.stringify({
                    name: faker.name.firstName(),
                    suffix: faker.name.suffix(),
                  });
                  break;
                case 'bit':
                  {
                    const num = Math.floor(
                      Math.random() * Math.pow(2, colObj.np || 6)
                    );
                    rows[k][colObj.cn] = num;
                  }
                  break;
                case 'text':
                  rows[k][colObj.cn] = faker.lorem.sentence();
                  break;

                case 'string':
                default:
                  if (this._isColumnForeignKey(tableObj, colObj.cn)) {
                  } else {
                    while (1) {
                      const fakerColumn = fakerColumns.find(
                        (col) => col.cn === colObj.cn
                      );

                      const fakerFuncs = fakerColumn.fakerFunction
                        ? fakerColumn.fakerFunction.split('.')
                        : [];

                      let str = faker.internet.email();

                      if (fakerFuncs.length) {
                        // str = faker[fakerFuncs[0]][fakerFuncs[1]]();
                      }

                      let max = 1;
                      if (colObj.clen) {
                        max = colObj.clen;
                        if (max < str.length) {
                          // max = str.length;
                        }
                        str = str.slice(0, max);
                      }

                      if (
                        (colObj.ck === 'UNI' ||
                          this._isColumnPrimaryForInserting(
                            tableObj,
                            colObj
                          )) &&
                        str in strDict
                      ) {
                      } else {
                        rows[k][colObj.cn] = str;
                        strDict[str] = 1;
                        break;
                      }
                    }
                  }

                  break;
              }
            }
          }
          for (let i = 0; i < rows.length; ++i) {
            // for (let key in rows[i]) {
            //   console.log(key,rows[i][key]);
            // }
            await this.knex(tn).insert(rows[i]);
          }

          // await knex.raw(knex(tn).insert(rows).toSQL() + " ON DUPLICATE KEY UPDATE " +
          //   Object.getOwnPropertyNames(rows).map((field) => `${field}=VALUES(${field})`).join(", "))

          this.emit(`Inserted '${rows.length}' rows in 'table.${tn}'`);
          console.log('End: ', tn);
        }

        // console.log(orders.order.length, tablesAsArr.length);
        //
        // let cycle = Object.keys(orders.cycle);
        //
        // for (let i = 0; i < cycle.length; ++i) {
        //   console.log(tablesAsArr[cycle[i]]);
        // }
      }
    } catch (e) {
      console.log('Error in mockDb : ', e);
      throw e;
    }

    // console.timeEnd('mockDb')
  }

  async dbCacheInitAsyncKnex(_cbk = null) {
    try {
      const self = this;
      let universalQuery = null;
      let universalResults = [];

      // console.log(this.connectionConfig);

      if (this.connectionConfig.client === 'mysql') {
        universalQuery = dataHelp.getMysqlSchemaQuery();

        const results = await this.knex.raw(universalQuery, [
          this.connectionConfig.connection.database,
        ]);

        if (results.length) {
          universalResults = results[0];

          // osx mysql server has limitations related to open_tables
          await this.knex.raw('FLUSH TABLES', []);

          // cbk(null, null)
        } else {
          // console.log('Cache init failed during database reading')
          console.log({}, results[0]);
          // cbk(err, results)
        }
      }

      if (universalResults.length) {
        for (let i = 0; i < universalResults.length; ++i) {
          const keys = Object.keys(universalResults[i]);
          for (let j = 0; j < keys.length; ++j) {
            const value = universalResults[i][keys[j]];

            universalResults[i][keys[j].toLowerCase()] = value;

            // console.log(value);
          }
        }

        self.iterateToCacheTables(universalResults);
        self.iterateToCacheTablePks(universalResults);
        self.iterateToCacheTableColumns(universalResults);
        self.iterateToCacheTableFks(universalResults);
        self.constructUiMeta();

        console.log('erm atrix = = = = =');
        self.iterateToCacheErMatrix(universalResults);
        console.log('erm atrix = = = = =');
        // await self.mockDb()

        // console.log(this.metaDb.tables['film'].columns);

        for (let i = 0; i < universalResults.length; ++i) {
          if (universalResults[i].ck === 'PRI') {
            console.log(
              'PK >> ',
              universalResults[i].tn,
              universalResults[i].cn,
              universalResults[i].ext
            );
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  getUiColumnObject(column) {
    const uiColObj: any = {};

    // console.log(column);

    uiColObj.cn = column.cn;
    uiColObj.dt = column.dt;
    uiColObj.data_type_knex = this.getKnexDataTypeMock(column.dt);
    uiColObj.ct = column.ct;
    uiColObj.nrqd = column.nrqd !== 'NO';
    uiColObj.ck = column.ck === 'MUL';
    uiColObj.pk = column.ck === 'PRI';
    uiColObj.un = column.ct.indexOf('unsigned') !== -1;
    uiColObj.ai = column.ext.indexOf('auto_increment') !== -1;

    if (this.connectionConfig.client === 'mysql') {
      uiColObj.cdf = column.cdf;
      uiColObj.clen = column.clen;
      uiColObj.np = column.np;
      uiColObj.ns = column.ns;
      uiColObj.dp = column.dp;
    }

    return uiColObj;
  }

  constructUiMeta() {
    for (const tn in this.metaDb.tables) {
      const table = this.metaDb.tables[tn];

      for (let i = 0; i < table.columns.length; ++i) {
        const column = table.columns[i];
        table.uiModel.columns[i] = this.getUiColumnObject(column);
      }
    }
  }

  iterateToCacheTables(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      const schemaRow = schemaResults[i];
      if (0 && schemaRow.is_view) {
      } else {
        const tn = schemaRow.tn;

        if (!(tn in this.metaDb.tables)) {
          this.metaDb.tables[tn] = {};
          this.metaDb.tables[tn].primaryKeys = [];
          this.metaDb.tables[tn].foreignKeys = [];
          this.metaDb.tables[tn].columns = [];
          this.metaDb.tables[tn].indicies = [];
          this.metaDb.tables[tn].is_view = schemaRow.is_view;

          const uiModel: any = {};
          uiModel.columns = [];
          uiModel.primaryKeys = [];
          uiModel.foreignKeys = [];
          uiModel.indicies = [];

          this.metaDb.tables[tn].uiModel = uiModel;
        }
      }
    }
  }

  iterateToCacheTableColumns(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      const schemaRow = schemaResults[i];
      const tn = schemaRow.tn;
      const col: any = {};

      if (schemaRow.cn.split(' ').length > 1) {
        // todo
        // console.log('column skipped since it has a space in its name - seen it in a view');
      } else {
        col.cn = schemaRow.cn;
        col.op = schemaRow.op;
        col.ck = schemaRow.ck;
        col.dt = schemaRow.dt;
        col.ct = schemaRow.ct;
        col.rtn = schemaRow.rtn;
        col.rcn = schemaRow.rcn;
        col.nrqd = schemaRow.nrqd;

        if (this.connectionConfig.client === 'mysql') {
          col.ext = schemaRow.ext;
          col.cc = schemaRow.cc;
          col.cdf = schemaRow.cdf;
          col.clen = schemaRow.clen;
          col.np = schemaRow.np;
          col.ns = schemaRow.ns;
          col.dp = schemaRow.dp;
        }

        dataHelp.findOrInsertObjectArrayByKey(
          col,
          'cn',
          this.metaDb.tables[tn].columns
        );
      }
    }
  }

  iterateToCacheTableFks(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      const schemaRow = schemaResults[i];
      const tn = schemaRow.tn;

      if (schemaRow.rtn) {
        const fk: any = {};

        fk.cn = schemaRow.cn;
        fk.tn = schemaRow.tn;
        fk.rtn = schemaRow.rtn;
        fk.rcn = schemaRow.rcn;
        fk.dt = schemaRow.dt;
        fk.ct = schemaRow.ct;

        dataHelp.findOrInsertObjectArrayByKey(
          fk,
          'cn',
          this.metaDb.tables[tn].foreignKeys
        );

        // console.log(fk['rtn'],fk['rcn'],tn, schemaRow['cn'], this.metaDb.tables[tn]['foreignKeys'].length)
      }
    }
  }

  iterateToCacheErMatrix(schemaResults) {
    this.metaDb.erMatrix = [];

    // console.log('> > ',this.metaDb);

    const tablesAsArr = Object.keys(this.metaDb.tables);
    const tablesIndex: any = {};
    const reverseTablesIndex: any = {};

    console.log('< < < ', tablesAsArr);

    // get tables array indicies - helps to search
    for (let i = 0; i < tablesAsArr.length; ++i) {
      tablesIndex[tablesAsArr[i]] = i;
      reverseTablesIndex[i] = tablesAsArr[i];
    }

    this.metaDb.erTablesAsArr = tablesAsArr;
    this.metaDb.erTableIndexObj = tablesIndex;
    this.metaDb.erIndexTableObj = reverseTablesIndex;

    // init the ermatrix
    for (let i = 0; i < tablesAsArr.length; ++i) {
      this.metaDb.erMatrix[i] = [];
      for (let j = 0; j < tablesAsArr.length; ++j) {
        this.metaDb.erMatrix[i].push(0);
      }
    }

    console.log(this.metaDb.erTableIndexObj, this.metaDb.erIndexTableObj);

    for (let i = 0; i < schemaResults.length; ++i) {
      if (schemaResults[i].rtn !== null) {
        // console.log(schemaResults[i]['rtn'], schemaResults[i]['tn']);

        const parentIndex = tablesIndex[schemaResults[i].rtn];
        const childIndex = tablesIndex[schemaResults[i].tn];
        this.metaDb.erMatrix[parentIndex][childIndex] = 1;
      }
    }
    // console.log(this.metaDb.erMatrix);
  }

  iterateToCacheTablePks(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      const schemaRow = schemaResults[i];
      const tn = schemaRow.tn;

      if (this._isColumnPrimary(schemaRow)) {
        const pk: any = {};
        pk.cn = schemaRow.cn;
        pk.op = schemaRow.op;
        pk.ck = schemaRow.ck;
        pk.dt = schemaRow.dt;
        pk.ct = schemaRow.ct;

        dataHelp.findOrInsertObjectArrayByKey(
          pk,
          'cn',
          this.metaDb.tables[tn].primaryKeys
        );
      }
    }
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

  migrationInit(_args) {}

  async selectAll(tn) {
    return await this.sqlClient(tn).select();
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
      const countResult = await this.sqlClient(args.tn).count();
      result.data.count = Object.values(countResult[0])[0];
      const query = this.sqlClient(args.tn)
        .select()
        .limit(size)
        .offset((page - 1) * size);
      if (orderBy && orderBy.length)
        result.data.list = await query.orderBy(orderBy);
      else result.data.list = await query;
    } catch (e) {
      console.log(e);
      result.data.list = [];
    }
    return result;
  }

  executeSqlFiles() {}

  async createDatabaseIfNotExists(_args): Promise<any> {}

  async createTableIfNotExists(_args): Promise<any> {}

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

  async remove(tn, where) {
    await this.sqlClient(tn).del().where(where);
  }

  hasTable(_tn) {}

  hasDatabase(_databaseName) {}

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
        (d) => d.aggrDataType === args['aggrDataType']
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

      /** ************** create table *************** */
      await this.sqlClient.schema.createTable(args.table, function (table) {
        const multiplePks = [];
        const columns = JSON.parse(JSON.stringify(args.columns));

        // copy PKs to new array and set PK metadata to false in original columns
        for (let i = 0; i < columns.length; ++i) {
          if (columns[i].pk) {
            multiplePks.push(i);
            columns[i].pk = false;
            columns[i].ai = false;
          }
        }

        if (multiplePks.length > 1) {
          for (let i = 0; i < columns.length; ++i) {
            columnCreate(args.sqlClient, table, columns[i]);
          }

          createPks(table, args.columns, multiplePks);
        } else {
          for (let i = 0; i < args.columns.length; ++i) {
            columnCreate(args.sqlClient, table, args.columns[i]);
          }
        }
      });

      /** ************** create up & down statements *************** */
      const upStatement = this.sqlClient.schema
        .createTable(args.table, function (table) {
          const multiplePks = [];
          const columns = JSON.parse(JSON.stringify(args.columns));

          for (let i = 0; i < columns.length; ++i) {
            if (columns[i].pk) {
              multiplePks.push(i);
              columns[i].pk = false;
              columns[i].ai = false;
            }
          }

          if (multiplePks.length > 1) {
            for (let i = 0; i < columns.length; ++i) {
              columnCreate(args.sqlClient, table, columns[i]);
            }

            createPks(table, args.columns, multiplePks);
          } else {
            for (let i = 0; i < args.columns.length; ++i) {
              columnCreate(args.sqlClient, table, args.columns[i]);
            }
          }
        })
        .toSQL();

      this.emit(`Success : ${upStatement}`);

      const downStatement = this.sqlClient.schema.dropTable(args.table).toSQL();

      /** ************** return files *************** */
      result.data.object = {
        upStatement,
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
      await this.sqlClient.schema.renameTable(args.tn_old, args.tn);

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
  //       const oldColumn = lodash.find(originalColumns, {
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
  async tableUpdate(args) {
    const _func = this.tableUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    let renamed = false;
    let renamedUpDownStatement: any = {};

    try {
      args.table = args.tn;
      const originalColumns = args.originalColumns;
      args.connectionConfig = this._connectionConfig;
      args.sqlClient = this.sqlClient;

      /** ************** START : has PK changed *************** */
      const numOfPksInOriginal = [];
      const numOfPksInNew = [];
      let pksChanged = 0; // > 1 for new pk and < 1 for pl removed

      for (let i = 0; i < args.columns.length; ++i) {
        if (args.columns[i].pk) {
          numOfPksInNew.push(i);
        }
      }

      for (let i = 0; i < args.originalColumns.length; ++i) {
        if (args.originalColumns[i].pk) {
          numOfPksInOriginal.push(i);
        }
      }

      if (numOfPksInNew.length > numOfPksInOriginal.length) {
        /**
         * new primary key
         */
        pksChanged = numOfPksInNew.length - numOfPksInOriginal.length;
      } else if (numOfPksInNew.length < numOfPksInOriginal.length) {
        /**
         * primary key removed
         */
        pksChanged = numOfPksInNew.length - numOfPksInOriginal.length;
      } else {
        /**
         * check if the pks are same
         *    exchanging one pk for another - we will catch it here
         */
        for (let i = 0; i < numOfPksInNew.length; ++i) {
          if (numOfPksInNew[i] !== numOfPksInOriginal[i]) {
            pksChanged = 1;
          }
        }
      }

      console.log('pksChanged:', pksChanged);
      /** ************** END : has PK changed *************** */

      /** ************** update table *************** */
      await this.sqlClient.schema.alterTable(args.table, function (table) {
        if (pksChanged) {
          pkUpdate(table, args.columns, args.originalColumns);
        } else {
          for (let i = 0; i < args.columns.length; ++i) {
            const column = lodash.find(originalColumns, {
              cn: args.columns[i].cno,
            });

            if (args.columns[i].altered & 8) {
              // TODO: If a column is getting renamed then
              //            any change to column data type
              //            or changes to other columns are ignored
              renamed = true;
              renamedUpDownStatement = renameColumn(
                args.sqlClient,
                args.connectionConfig,
                table,
                column,
                args.columns[i]
              );
              result.data.object = renamedUpDownStatement;
            } else if (args.columns[i].altered & 4) {
              // col remove
              removeColumn(table, args.columns[i], column);
            } else if (args.columns[i].altered & 2) {
              // col edit
              columnUpdate(args.sqlClient, table, args.columns[i], column);
            } else if (args.columns[i].altered & 1) {
              // col addition
              columnUpdate(args.sqlClient, table, args.columns[i], null);
            }
          }
        }
      });

      // log.debug('after column change', r);

      if (renamed) {
        await this.sqlClient.raw(renamedUpDownStatement.upStatement);
        result.data.object = renamedUpDownStatement;
      } else {
        /** ************** create up & down statements *************** */
        const upStatement = this.sqlClient.schema
          .alterTable(args.table, function (table) {
            if (pksChanged) {
              pkUpdate(table, args.columns, args.originalColumns);
            } else {
              for (let i = 0; i < args.columns.length; ++i) {
                const column = lodash.find(originalColumns, {
                  cn: args.columns[i].cno,
                });
                if (args.columns[i].altered & 8) {
                  // col remove
                  // renameColumn(this.sqlClient,
                  //   this.connectionConfig,
                  //   table,
                  //   args.columns[i].cno,
                  //   args.columns[i].cn);
                } else if (args.columns[i].altered & 4) {
                  // col remove
                  removeColumn(table, args.columns[i], column);
                } else if (args.columns[i].altered & 2) {
                  // col edit
                  columnUpdate(args.sqlClient, table, args.columns[i], column);
                } else if (args.columns[i].altered & 1) {
                  // col addition
                  columnUpdate(args.sqlClient, table, args.columns[i], null);
                }
              }
            }
          })
          .toSQL();
        // this.emit(`Success : ${upStatement}`)

        // log.debug(upStatement);

        const downStatement = this.sqlClient.schema
          .alterTable(args.table, function (table) {
            if (pksChanged) {
              pkUpdate(table, args.columns, args.originalColumns);
            } else {
              for (let i = 0; i < args.columns.length; ++i) {
                const column = lodash.find(originalColumns, {
                  cn: args.columns[i].cno,
                });
                if (args.columns[i].altered & 8) {
                  // col remove
                  // renameColumn(this.sqlClient,
                  //   this.connectionConfig,
                  //   table,
                  //   args.columns[i].cno,
                  //   args.columns[i].cn);
                } else if (args.columns[i].altered & 4) {
                  // col remove reverse
                  columnUpdate(args.sqlClient, table, column, null);
                } else if (args.columns[i].altered & 1) {
                  // col addition reverse
                  removeColumn(table, args.columns[i], null);
                } else if (args.columns[i].altered & 2) {
                  // col edit reverse
                  columnUpdate(args.sqlClient, table, column, args.columns[i]);
                }
              }
            }
          })
          .toSQL();

        result.data.object = {
          upStatement,
          downStatement,
        };
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  // /**
  //  *
  //  * @param {Object} - args
  //  * @param args.tn
  //  * @returns {Promise<{upStatement, downStatement}>}
  //  */
  // async tableDelete(args) {
  //   const _func = this.tableDelete.name;
  //   const result = new Result();
  //   log.api(`${_func}:args:`, args);
  //   try {
  //     const {columns} = args;
  //     args.sqlClient = this.sqlClient;
  //
  //     /** ************** create up & down statements *************** */
  //     const upStatement = this.sqlClient.schema
  //       .dropTable(args.tn)
  //       .toSQL();
  //     const downQuery = createTable(args);
  //
  //     this.emit(`Success : ${upStatement}`);
  //
  //     /** ************** drop tn *************** */
  //     await this.sqlClient.schema.dropTable(args.tn);
  //
  //     /** ************** return files *************** */
  //     result.data.object = {
  //       upStatement,
  //       downStatement : [{sql: downQuery}]
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
   * @param args.tn
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableDelete(args) {
    const _func = this.tableDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { columns } = args;
      args.sqlClient = this.sqlClient;

      /** ************** create up & down statements *************** */
      const upStatement = this.sqlClient.schema.dropTable(args.tn).toSQL();
      const downStatement = this.sqlClient.schema
        .createTable(args.tn, function (tn) {
          for (let i = 0; i < columns.length; ++i) {
            columnCreate(args.sqlClient, tn, columns[i]);
          }
        })
        .toSQL();

      this.emit(`Success : ${upStatement}`);

      /** ************** drop tn *************** */
      await this.sqlClient.schema.dropTable(args.tn);

      /** ************** return files *************** */
      result.data.object = {
        upStatement,
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
      await this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique) {
          table.index(args.columns, indexName);
        } else {
          table.unique(args.columns, indexName);
        }
      });

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
      await this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique_original) {
          table.dropIndex(args.columns, indexName);
        } else {
          table.dropUnique(args.columns, indexName);
        }
      });

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
      // s = await this.sqlClient.schema.index(Object.keys(args.columns));

      await this.sqlClient.schema.table(args.childTable, function (table) {
        table = table
          .foreign(args.childColumn, foreignKeyName)
          .references(args.parentColumn)
          .on(args.parentTable);

        if (args.onUpdate) {
          table = table.onUpdate(args.onUpdate);
        }
        if (args.onDelete) {
          table = table.onDelete(args.onDelete);
        }
      });

      const upStatement =
        this.querySeparator() +
        (await this.sqlClient.schema
          .table(args.childTable, function (table) {
            table = table
              .foreign(args.childColumn, foreignKeyName)
              .references(args.parentColumn)
              .on(args.parentTable);

            if (args.onUpdate) {
              table = table.onUpdate(args.onUpdate);
            }
            if (args.onDelete) {
              table = table.onDelete(args.onDelete);
            }
          })
          .toQuery());

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTable, function (table) {
            table = table.dropForeign(args.childColumn, foreignKeyName);
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
          .table(args.childTable, function (table) {
            table
              .foreign(args.childColumn, foreignKeyName)
              .references(args.parentColumn)
              .on(args.parentTable);
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

  async _getmetaDb() {}

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
      mkdirp.sync(args.seedsFolder);
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

  async tableCreateStatement(_args): Promise<any> {}

  async tableInsertStatement(_args): Promise<any> {}

  async tableUpdateStatement(_args): Promise<any> {}

  async tableDeleteStatement(_args): Promise<any> {}

  async tableTruncateStatement(_args): Promise<any> {}

  async tableSelectStatement(_args): Promise<any> {}

  async sequelizeModelCreate(_args): Promise<any> {}

  genQuery(query, args = [], shouldSanitize: any = 0) {
    if (shouldSanitize) {
      args = (args || []).map((s) =>
        typeof s === 'string' ? this.sanitize(s) : s
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
}

// expose class
export default KnexClient;
