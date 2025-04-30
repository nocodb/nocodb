import Client_Libsql from '@libsql/knex-libsql';
import knex from 'knex';
import find from 'lodash/find';
import Result from '~/db/util/Result';
import queries from '~/db/sql-client/lib/sqlite/sqlite.queries';
import SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';
import Debug from '~/db/util/Debug';

const log = new Debug('LibSqlClient');

class LibsqlClient extends SqliteClient {
  constructor(connectionConfig) {
    connectionConfig.connection.useNullAsDefault = true;
    connectionConfig.knex =
      connectionConfig?.knex ||
      knex({
        client: Client_Libsql,
        connection: {
          filename:
            connectionConfig.connection.url +
            '?authToken=' +
            connectionConfig.connection.authToken,
        },
      });
    super(connectionConfig);
    this.sqlClient = connectionConfig?.knex;
    this.queries = queries;
    this._version = {};
  }
  async createDatabaseIfNotExists(args) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    log.api(`${_func}: result`, result);
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

      // await this.sqlClient.raw('PRAGMA legacy_alter_table = ON;');

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
        // await this.sqlClient.raw('PRAGMA legacy_alter_table = OFF;');
      }

      console.log(upQuery);

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
}

export default LibsqlClient;
