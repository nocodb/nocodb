// Snowflake Schema Compiler
// -------

const SchemaCompiler = require('knex/lib/schema/compiler');

class SchemaCompiler_SF extends SchemaCompiler {
  constructor(client, builder) {
    super(client, builder);

    this.warehouse = client.warehouse;
    this.database = client.database;

    if (client.schema) {
      this.schema = client.schema;
    } else {
      throw new Error('Missing schema in Snowflake configuration');
    }
  }

  // Check whether the current table
  hasTable(tableName) {
    let sql = `select * from "${this.database}".information_schema.tables where table_name = ?`;
    const bindings = [tableName];

    if (this.schema) {
      sql += ' and table_schema = ?';
      bindings.push(this.schema);
    } else {
      sql += ' and table_schema = current_schema()';
    }

    this.pushQuery({
      sql,
      bindings,
      output(resp) {
        return resp.rows.length > 0;
      },
    });
  }

  // Compile the query to determine if a column exists in a table.
  hasColumn(tableName, columnName) {
    let sql = `select * from "${this.database}".information_schema.columns where table_name = ? and column_name = ?`;
    const bindings = [tableName, columnName];

    if (this.schema) {
      sql += ' and table_schema = ?';
      bindings.push(this.schema);
    } else {
      sql += ' and table_schema = current_schema()';
    }

    this.pushQuery({
      sql,
      bindings,
      output(resp) {
        return resp.rows.length > 0;
      },
    });
  }

  qualifiedTableName(tableName) {
    const name = `${this.database}.${this.schema}.${tableName}`;
    return this.formatter.wrap(name);
  }

  createSchema(schemaName) {
    this.pushQuery(
      `create schema ${this.formatter.wrap(
        prefixedName(this.database, schemaName),
      )}`,
    );
  }

  createSchemaIfNotExists(schemaName) {
    this.pushQuery(
      `create schema if not exists ${this.formatter.wrap(
        prefixedName(this.database, schemaName),
      )}`,
    );
  }

  dropSchema(schemaName) {
    this.pushQuery(
      `drop schema ${this.formatter.wrap(
        prefixedName(this.database, schemaName),
      )}`,
    );
  }

  dropSchemaIfExists(schemaName) {
    this.pushQuery(
      `drop schema if exists ${this.formatter.wrap(
        prefixedName(this.database, schemaName),
      )}`,
    );
  }

  dropTable(tableName) {
    this.pushQuery(`drop table ${this.qualifiedTableName(tableName)}`);
  }

  dropTableIfExists(tableName) {
    this.pushQuery(
      `drop table if exists ${this.qualifiedTableName(tableName)}`,
    );
  }

  dropView(viewName) {
    this.pushQuery(`drop view ${this.qualifiedTableName(viewName)}`);
  }

  dropViewIfExists(viewName) {
    this.pushQuery(`drop view if exists ${this.qualifiedTableName(viewName)}`);
  }

  dropMaterializedView(_viewName) {
    throw new Error('materialized views are not supported by this dialect.');
  }

  dropMaterializedViewIfExists(_viewName) {
    throw new Error('materialized views are not supported by this dialect.');
  }

  renameView(_from, _to) {
    throw new Error(
      'rename view is not supported by this dialect (instead drop then create another view).',
    );
  }

  refreshMaterializedView() {
    throw new Error('materialized views are not supported by this dialect.');
  }

  raw(sql, bindings) {
    this.sequence.push(this.client.raw(sql, bindings).toSQL());
  }
}

function prefixedName(...args) {
  return args.filter((v) => v).join('.');
}

function build(builder) {
  // pass queryContext down to tableBuilder but do not overwrite it if already set
  const queryContext = this.builder.queryContext();
  if (queryContext !== undefined && builder.queryContext() === undefined) {
    builder.queryContext(queryContext);
  }

  const sql = builder.toSQL();

  for (let i = 0, l = sql.length; i < l; i++) {
    this.sequence.push(sql[i]);
  }
}

function buildTable(type) {
  if (type === 'createLike') {
    return function (tableName, tableNameLike, fn) {
      const builder = this.client.tableBuilder(
        type,
        prefixedName(this.client.database, this.client.schema, tableName),
        prefixedName(this.client.database, this.client.schema, tableNameLike),
        fn,
      );
      build.call(this, builder);
    };
  } else {
    return function (tableName, fn) {
      const builder = this.client.tableBuilder(
        type,
        prefixedName(this.client.database, this.client.schema, tableName),
        null,
        fn,
      );
      build.call(this, builder);
    };
  }
}

function buildView(type) {
  return function (viewName, fn) {
    const builder = this.client.viewBuilder(
      type,
      prefixedName(this.client.database, this.client.schema, viewName),
      fn,
    );
    build.call(this, builder);
  };
}

SchemaCompiler_SF.prototype.alterTable = buildTable('alter');
SchemaCompiler_SF.prototype.createTable = buildTable('create');
SchemaCompiler_SF.prototype.createTableIfNotExists = buildTable('createIfNot');
SchemaCompiler_SF.prototype.createTableLike = buildTable('createLike');

SchemaCompiler_SF.prototype.createView = buildView('create');
SchemaCompiler_SF.prototype.createViewOrReplace = buildView('createOrReplace');
SchemaCompiler_SF.prototype.createMaterializedView = buildView(
  'createMaterializedView',
);
SchemaCompiler_SF.prototype.alterView = buildView('alter');

module.exports = SchemaCompiler_SF;
