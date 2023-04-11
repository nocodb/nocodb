import mapKeys from 'lodash/mapKeys';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import MysqlClient from './MysqlClient';

const log = new Debug('VitessClient');

class Vitess extends MysqlClient {
  constructor(connectionConfig: any) {
    super(connectionConfig);
  }

  async relationList(_args: any = {}) {
    const result = new Result();
    result.data.list = [];
    return result;
  }

  async relationListAll(_args: any = {}) {
    const result = new Result();
    result.data.list = [];
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
          response[0][i].database_name = response[0][i].Databases;
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
  async tableList(args: any = {}) {
    const func = this.tableList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const response = await this.sqlClient.raw('SHOW TABLES');
      const keyInResponse = `Tables_in_vt_${this.connectionConfig.connection.database}`;

      if (response.length === 2) {
        for (let i = 0; i < response[0].length; ++i) {
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
    const func = this.columnList.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `select *, table_name as tn from information_schema.columns where table_name = '${args.tn}' ORDER by ordinal_position`,
      );

      if (response.length === 2) {
        const columns = [];

        for (let i = 0; i < response[0].length; ++i) {
          const column: any = {};

          response[0][i] = mapKeys(response[0][i], (_v, k) => k.toLowerCase());

          column.tn = args.tn;
          column.cn = response[0][i].cn;
          column.dt = response[0][i].dt;
          column.np = response[0][i].np;
          column.ns = response[0][i].ns;
          column.clen = response[0][i].clen;
          // column.dp = response[0][i].dp;
          column.cop = response[0][i].op;
          column.dtx = this.getKnexDataType(column.dt);
          column.pk = response[0][i].ck === 'PRI';

          column.nrqd = response[0][i].nrqd !== 'NO';
          column.not_nullable = !column.nrqd;

          response[0][i].ct = response[0][i].ct || '';
          column.un = response[0][i].ct.indexOf('unsigned') !== -1;

          column.ct = response[0][i].ct || '';
          response[0][i].ext = response[0][i].ext || '';
          column.ai = response[0][i].ext.indexOf('auto_increment') !== -1;

          response[0][i].cst = response[0][i].cst || ' ';
          column.unique = response[0][i].cst.indexOf('UNIQUE') !== -1;

          column.cdf = response[0][i].cdf;
          column.cc = response[0][i].cc;

          column.csn = response[0][i].csn;

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
        `select *, TABLE_NAME as tn from INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '${args.tn}' ORDER by ordinal_position;`,
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
}
export default Vitess;
