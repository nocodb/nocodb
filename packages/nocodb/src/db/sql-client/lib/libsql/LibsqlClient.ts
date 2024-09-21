import SqliteClient from '../sqlite/SqliteClient';

import Client_Libsql from '@libsql/knex-libsql';
import Knex from 'knex';
import Debug from '../../../util/Debug';

import queries from '../sqlite/sqlite.queries';
import Result from '../../../util/Result';

const log = new Debug('SqliteClient');

class LibsqlClient extends SqliteClient {
  constructor(connectionConfig) {
    console.log(connectionConfig);
    // sqlite does not support inserting default values and knex fires a warning without this flag
    connectionConfig.connection.useNullAsDefault = true;
    connectionConfig.knex =
      connectionConfig?.knex ||
      Knex({
        client: Client_Libsql,
        connection: {
          filename: HARDODED_URL + '?authToken=' + HARDCODED_AUTH_TOKEN,
          // filename: 'file:test.db',

          // connectionConfig.connection.url +
          // 'authToken=' +
          // connectionConfig.connection.authToken,
        },
      });
    super(connectionConfig);
    // this.sqlClient =
    //   connectionConfig?.knex ||
    //   Knex({
    //     client: Client_Libsql,
    //     connection: {
    //       filename: 'file:test.db',
    //     },
    //   });
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

  async createDatabaseIfNotExists(args) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    // try {
    //   const exists = await promisify(fs.exists)(args.database);

    //   if (!exists) {
    //     log.debug('sqlite file do no exists - create one');
    //     const fd = await promisify(fs.open)(args.database, 'w');
    //     const close = await promisify(fs.close)(fd);
    //     log.debug('sqlite file is created', fd, close);
    //     // create new knex client
    //     this.sqlClient = knex(this.connectionConfig.connection);
    //     // set encoding to utf8
    //     await this.sqlClient.raw('PRAGMA encoding = "UTF-8"');
    //   } else {
    //     // create new knex client
    //     this.sqlClient = knex(this.connectionConfig.connection);
    //   }
    // } catch (e) {
    //   log.ppe(e, _func);
    //   throw e;
    // }

    log.api(`${_func}: result`, result);
    return result;
  }
}

export default LibsqlClient;
