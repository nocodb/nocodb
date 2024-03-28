// Snowflake
// -------
const { promisify } = require('util');
const extend = require('lodash/extend');
const map = require('lodash/map');
const Client = require('knex/lib/client');

const { makeEscape } = require('knex/lib/util/string');
const Transaction = require('./execution/sf-transaction');
const QueryCompiler = require('./query/sf-querycompiler');
const QueryBuilder = require('./query/sf-querybuilder');
const ColumnCompiler = require('./schema/sf-columncompiler');
const TableCompiler = require('./schema/sf-tablecompiler');
const ViewCompiler = require('./schema/sf-viewcompiler');
const ViewBuilder = require('./schema/sf-viewbuilder');
const SchemaCompiler = require('./schema/sf-compiler');

class SnowflakeClient extends Client {
  constructor(config) {
    super(config);
    if (config.returning) {
      this.defaultReturning = false;
    }

    if (config.connection.warehouse) {
      this.warehouse = config.connection.warehouse;
    } else {
      throw new Error('Missing warehouse in Snowflake configuration');
    }

    if (config.connection.database) {
      this.database = config.connection.database;
    } else {
      throw new Error('Missing database in Snowflake configuration');
    }

    if (config.connection.schema) {
      this.schema = config.connection.schema;
    }
  }

  transaction() {
    return new Transaction(this, ...arguments);
  }

  queryBuilder() {
    return new QueryBuilder(this);
  }

  queryCompiler(builder, formatter) {
    return new QueryCompiler(this, builder, formatter);
  }

  columnCompiler() {
    return new ColumnCompiler(this, ...arguments);
  }

  schemaCompiler() {
    return new SchemaCompiler(this, ...arguments);
  }

  tableCompiler() {
    return new TableCompiler(this, ...arguments);
  }

  viewCompiler() {
    return new ViewCompiler(this, ...arguments);
  }

  viewBuilder() {
    return new ViewBuilder(this, ...arguments);
  }

  _driver() {
    return require('snowflake-sdk');
  }

  async changeDatabase(db) {
    return new Promise((resolve, reject) => {
      this.database = db;
      this.raw('use database ' + this.wrapIdentifier(db))
        .then(resolve)
        .catch(reject);
    });
  }

  wrapIdentifierImpl(value) {
    return value !== '*' ? `"${value.replace(/"/g, '""')}"` : '*';
  }

  _acquireOnlyConnection() {
    const connection = new this.driver.createConnection(
      this.connectionSettings,
    );
    return new Promise((resolve, reject) => {
      connection.connect(async function (err, conn) {
        if (err) {
          reject('Unable to connect: ' + err.message);
        } else {
          resolve(conn);
        }
      });
    });
  }

  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection() {
    // const client = this;

    return this._acquireOnlyConnection()
      .then(function (connection) {
        connection.on('error', (err) => {
          connection.__knex__disposed = err;
        });

        connection.on('end', (err) => {
          connection.__knex__disposed = err || 'Connection ended unexpectedly';
        });

        return connection;
      })
      .catch(function (err) {
        throw new Error(err);
      });
  }

  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  async destroyRawConnection(connection) {
    return new Promise((resolve, reject) => {
      const end = promisify((cb) => connection.destroy(cb));
      end().then(resolve).catch(reject);
    });
  }

  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query(connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');

    let queryConfig = {
      text: obj.sql,
      values: obj.bindings || [],
    };

    if (obj.options) {
      queryConfig = extend(queryConfig, obj.options);
    }

    return new Promise(function (resolver, rejecter) {
      connection.execute({
        sqlText: queryConfig.text,
        binds: queryConfig.values,
        complete: function (err, stmt, rows) {
          if (err) {
            rejecter(err);
          } else {
            obj.response = {
              status: stmt.getStatus(),
              updatedRowCount: stmt.getNumUpdatedRows(),
              rowCount: stmt.getNumRows(),
              rows,
            };
            resolver(obj);
          }
        },
      });
    });
  }

  // Ensures the response is returned in the same format as other clients.
  processResponse(obj, runner) {
    const resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    if (obj.method === 'raw') return resp;
    const { returning } = obj;
    if (obj.method === 'first') return resp.rows[0];
    if (obj.method === 'pluck') return map(resp.rows, obj.pluck);
    if (obj.method === 'select') return resp.rows;
    if (returning) {
      const returns = [];
      for (let i = 0, l = resp.rows.length; i < l; i++) {
        const row = resp.rows[i];
        returns[i] = row;
      }
      return returns;
    }
    if (obj.method === 'update' || obj.method === 'delete') {
      return resp.updatedRowCount;
    }
    return resp;
  }

  cancelQuery() {
    throw new Error('Query cancelling not supported for this dialect');
  }

  toPathForJson(jsonPath) {
    const SF_PATH_REGEX = /^{.*}$/;
    if (jsonPath.match(SF_PATH_REGEX)) {
      return jsonPath;
    }
    return (
      '{' +
      jsonPath
        .replace(/^(\$\.)/, '') // remove the first dollar
        .replace('.', ',')
        .replace(/\[([0-9]+)]/, ',$1') + // transform [number] to ,number
      '}'
    );
  }
}

Object.assign(SnowflakeClient.prototype, {
  dialect: 'snowflake',

  driverName: 'snowflake',
  canCancelQuery: false,

  _escapeBinding: makeEscape({
    escapeArray(val, esc) {
      return esc(arrayString(val, esc));
    },
    escapeString(str) {
      let hasBackslash = false;
      let escaped = "'";
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === '\\') {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = 'E' + escaped;
      }
      return escaped;
    },
    escapeObject(val, prepareValue, timezone, seen = []) {
      if (val && typeof val.toPostgres === 'function') {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error(
            `circular reference detected while preparing "${val}" for query`,
          );
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    },
  }),
});

function arrayString(arr, esc) {
  let result = '{';
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) result += ',';
    const val = arr[i];
    if (val === null || typeof val === 'undefined') {
      result += 'NULL';
    } else if (Array.isArray(val)) {
      result += arrayString(val, esc);
    } else if (typeof val === 'number') {
      result += val;
    } else {
      result += JSON.stringify(typeof val === 'string' ? val : esc(val));
    }
  }
  return result + '}';
}

module.exports = { SnowflakeClient };
