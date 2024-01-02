import MysqlClientCE from 'src/db/sql-client/lib/mysql/MysqlClient';
import axios from 'axios';
import Result from '~/db/util/Result';
import Debug from '~/db/util/Debug';

const log = new Debug('MysqlClient');

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
      throw e.response.data.error;
    }
    throw e;
  }
}

class MysqlClient extends MysqlClientCE {
  constructor(connectionConfig) {
    super(connectionConfig);

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
