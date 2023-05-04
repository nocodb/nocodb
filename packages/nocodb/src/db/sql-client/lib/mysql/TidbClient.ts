import mapKeys from 'lodash/mapKeys';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import MysqlClient from './MysqlClient';

const log = new Debug('TidbClient');

class Tidb extends MysqlClient {
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
        `select *, TABLE_NAME as tn from INFORMATION_SCHEMA.KEY_COLUMN_USAGE where CONSTRAINT_SCHEMA='${this.connectionConfig.connection.database}' and TABLE_NAME='${args.tn}'`,
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

export default Tidb;
