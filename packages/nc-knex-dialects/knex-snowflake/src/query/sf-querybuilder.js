const QueryBuilder = require('knex/lib/query/querybuilder');
module.exports = class QueryBuilder_SF extends QueryBuilder {
  using(tables) {
    this._single.using = tables;
    return this;
  }

  // auto complete missing schema and database
  table(tableName, options = {}) {
    try {
      if (typeof tableName === 'string') {
        if (tableName.indexOf('.') === -1) {
          tableName = `${this.client.database}.${this.client.schema}.${tableName}`;
        } else if (tableName.indexOf('.') === tableName.lastIndexOf('.')) {
          tableName = `${this.client.database}.${tableName}`;
        }
      }
    } catch (e) {
      // do nothing
    }
    this._single.table = tableName;
    this._single.only = options.only === true;
    return this;
  }
};
