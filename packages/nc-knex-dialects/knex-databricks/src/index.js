// Databricks
// -------
const extend = require("lodash/extend");
const map = require("lodash/map");
const Client = require("knex/lib/client");
const { DBSQLClient } = require("@databricks/sql");

const Transaction = require("./execution/db-transaction");
const QueryCompiler = require("./query/db-querycompiler");
const QueryBuilder = require("knex/lib/dialects/postgres/query/pg-querybuilder");
const ColumnCompiler = require("./schema/db-columncompiler");
const TableCompiler = require("knex/lib/dialects/postgres/schema/pg-tablecompiler");
const ViewCompiler = require("knex/lib/dialects/postgres/schema/pg-viewcompiler");
const ViewBuilder = require("knex/lib/dialects/postgres/schema/pg-viewbuilder");
const SchemaCompiler = require("knex/lib/dialects/postgres/schema/pg-compiler");

class DatabricksClient extends Client {
  constructor(config) {
    super(config);
    if (config.returning) {
      this.defaultReturning = false;
    }

    if (config.connection.host) {
      this.host = config.connection.host;
    } else {
      throw new Error("Missing host in Databricks configuration");
    }

    if (config.connection.path) {
      this.path = config.connection.path;
    } else {
      throw new Error("Missing path in Databricks configuration");
    }

    if (config.connection.token) {
      this.token = config.connection.token;
    } else {
      throw new Error("Missing token in Databricks configuration");
    }
  }

  _driver() {
    const client = new DBSQLClient();
    return client;
  }

  _acquireOnlyConnection() {
    return new Promise((resolve, reject) => {
      this.bricksConnection = this.driver
        .connect({
          token: this.config.connection.token,
          host: this.config.connection.host,
          path: this.config.connection.path,
        })
        .then((client) => {
          resolve(client);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection() {
    return this._acquireOnlyConnection()
      .then(async (client) => {
        const session = await client.openSession({
          initialCatalog: this.config.connection.database,
          initialSchema: this.config.connection.schema,
        });
        return session;
      })
      .catch((err) => {
        throw err;
      });
  }

  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  async destroyRawConnection(connection) {
    return new Promise((resolve, reject) => {
      connection.close().then(resolve).catch(reject);
      this.bricksConnection.close().then(resolve).catch(reject);
    });
  }

  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query(connection, obj) {
    if (!obj.sql) throw new Error("The query is empty");

    let queryConfig = {
      text: obj.sql,
      values: obj.bindings || [],
    };

    if (obj.options) {
      queryConfig = extend(queryConfig, obj.options);
    }

    return new Promise(function (resolver, rejecter) {
      connection
        .executeStatement(queryConfig.text, {
          ordinalParameters: queryConfig.values,
        })
        .then((stm) => {
          stm
            .fetchAll()
            .then((res) => {
              obj.response = res;
              resolver(obj);
            })
            .catch((err) => {
              rejecter(err);
            });
        })
        .catch((err) => {
          rejecter(err);
        });
    });
  }

  // Ensures the response is returned in the same format as other clients.
  processResponse(obj, runner) {
    let resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    if (obj.method === "raw") return resp;
    if (obj.method === "first") return resp[0];
    if (obj.method === "pluck") return map(resp, obj.pluck);
    if (obj.method === "select") return resp;
    if (
      obj.method === "insert" ||
      obj.method === "update" ||
      obj.method === "delete"
    ) {
      resp = {
        ...resp[0],
      };
    }
    return resp;
  }

  cancelQuery() {
    throw new Error("Query cancelling not supported for this dialect");
  }

  wrapIdentifierImpl(value) {
    return value !== '*' ? `\`${value.replace(/`/g, '``')}\`` : '*';
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
}

Object.assign(DatabricksClient.prototype, {
  dialect: "databricks",

  driverName: "databricks",
  canCancelQuery: false,
});

module.exports = { DatabricksClient };
