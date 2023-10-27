import MysqlClientCE from 'src/db/sql-client/lib/mysql/MysqlClient';
import Result from '~/db/util/Result';
import Debug from '~/db/util/Debug';

const log = new Debug('MysqlClient');

class MysqlClient extends MysqlClientCE {
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
      const versionQueryResult = await this.sqlClient.raw(
        'SELECT VERSION() as version',
      );

      const version = versionQueryResult?.[0]?.[0]?.version;

      if (/\b(Tidb|Vitess)\b/i.test(version)) {
        result.code = -1;
        result.message = 'Vitess/Planetscale/TiDB is not supported';
      }
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
}

export default MysqlClient;
