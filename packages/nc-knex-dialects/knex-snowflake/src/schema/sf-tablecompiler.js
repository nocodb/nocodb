/* eslint max-len: 0 */

// Snowflake Table Builder & Compiler
// -------

const has = require('lodash/has');
const TableCompiler = require('knex/lib/schema/tablecompiler');
const { isObject, isString } = require('knex/lib/util/is');

class TableCompiler_SF extends TableCompiler {
  constructor(client, tableBuilder) {
    super(client, tableBuilder);
  }

  // Compile a rename column command.
  renameColumn(from, to) {
    return this.pushQuery({
      sql: `alter table ${this.tableName()} rename ${this.formatter.wrap(
        from,
      )} to ${this.formatter.wrap(to)}`,
    });
  }

  _setNullableState(column, isNullable) {
    const constraintAction = isNullable ? 'drop not null' : 'set not null';
    const sql = `alter table ${this.tableName()} alter column ${this.formatter.wrap(
      column,
    )} ${constraintAction}`;
    return this.pushQuery({
      sql: sql,
    });
  }

  compileAdd(builder) {
    const table = this.formatter.wrap(builder);
    const columns = this.prefixArray('add column', this.getColumns(builder));
    return this.pushQuery({
      sql: `alter table ${table} ${columns.join(', ')}`,
    });
  }

  // Adds the "create" query to the query sequence.
  createQuery(columns, ifNot, like) {
    const createStatement = ifNot
      ? 'create table if not exists '
      : 'create table ';
    const columnsSql = ` (${columns.sql.join(', ')}${
      this.primaryKeys() || ''
    }${this._addChecks()})`;

    let sql =
      createStatement +
      this.tableName() +
      (like && this.tableNameLike()
        ? ' like ' + this.tableNameLike()
        : columnsSql);
    if (this.single.inherits)
      sql += ` inherits (${this.formatter.wrap(this.single.inherits)})`;
    this.pushQuery({
      sql,
      bindings: columns.bindings,
    });
    const hasComment = has(this.single, 'comment');
    if (hasComment) this.comment(this.single.comment);
  }

  primaryKeys() {
    const pks = (this.grouped.alterTable || []).filter(
      (k) => k.method === 'primary',
    );
    if (pks.length > 0 && pks[0].args.length > 0) {
      const columns = pks[0].args[0];
      let constraintName = pks[0].args[1] || '';
      let deferrable;
      if (isObject(constraintName)) {
        ({ constraintName, deferrable } = constraintName);
      }
      deferrable = deferrable ? ` deferrable initially ${deferrable}` : '';
      constraintName = constraintName
        ? this.formatter.wrap(constraintName)
        : this.formatter.wrap(`${this.tableNameRaw}_pkey`);

      return `, constraint ${constraintName} primary key (${this.formatter.columnize(
        columns,
      )})${deferrable}`;
    }
  }

  addColumns(columns, prefix, colCompilers) {
    if (prefix === this.alterColumnsPrefix) {
      // alter columns
      for (const col of colCompilers) {
        this._addColumn(col);
      }
    } else {
      // base class implementation for normal add
      super.addColumns(columns, prefix);
    }
  }

  _addColumn(col) {
    const quotedTableName = this.tableName();
    const type = col.getColumnType();
    // We'd prefer to call this.formatter.wrapAsIdentifier here instead, however the context passed to
    // `this` instance is not that of the column, but of the table. Thus, we unfortunately have to call
    // `wrapIdentifier` here as well (it is already called once on the initial column operation) to give
    // our `alter` operation the correct `queryContext`. Refer to issue #2606 and PR #2612.
    const colName = this.client.wrapIdentifier(
      col.getColumnName(),
      col.columnBuilder.queryContext(),
    );

    // To alter enum columns they must be cast to text first
    // const isEnum = col.type === 'enu';
    this.pushQuery({
      sql: `alter table ${quotedTableName} alter column ${colName} drop default`,
      bindings: [],
    });

    const alterNullable = col.columnBuilder.alterNullable;
    if (alterNullable) {
      this.pushQuery({
        sql: `alter table ${quotedTableName} alter column ${colName} drop not null`,
        bindings: [],
      });
    }

    const alterType = col.columnBuilder.alterType;
    if (alterType) {
      this.pushQuery({
        sql: `alter table ${quotedTableName} alter ${colName} set data type ${type}`,
        bindings: [],
      });
    }

    const defaultTo = col.modified['defaultTo'];
    if (defaultTo) {
      const modifier = col.defaultTo.apply(col, defaultTo);
      this.pushQuery({
        sql: `alter table ${quotedTableName} alter column ${colName} set ${modifier}`,
        bindings: [],
      });
    }

    if (alterNullable) {
      const nullable = col.modified['nullable'];
      if (nullable && nullable[0] === false) {
        this.pushQuery({
          sql: `alter table ${quotedTableName} alter column ${colName} set not null`,
          bindings: [],
        });
      }
    }
  }

  // Compiles the comment on the table.
  comment(_comment) {
    this.pushQuery(
      `comment on table ${this.tableName()} is '${this.single.comment}'`,
    );
  }

  // Indexes:
  // -------

  primary(columns, constraintName) {
    let deferrable;
    if (isObject(constraintName)) {
      ({ constraintName, deferrable } = constraintName);
    }
    deferrable = deferrable ? ` deferrable initially ${deferrable}` : '';
    constraintName = constraintName
      ? this.formatter.wrap(constraintName)
      : this.formatter.wrap(`${this.tableNameRaw}_pkey`);
    if (this.method !== 'create' && this.method !== 'createIfNot') {
      this.pushQuery(
        `alter table ${this.tableName()} add constraint ${constraintName} primary key (${this.formatter.columnize(
          columns,
        )})${deferrable}`,
      );
    }
  }

  unique(columns, indexName) {
    let deferrable;
    if (isObject(indexName)) {
      ({ indexName, deferrable } = indexName);
    }
    deferrable = deferrable ? ` deferrable initially ${deferrable}` : '';
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand('unique', this.tableNameRaw, columns);
    this.pushQuery(
      `alter table ${this.tableName()} add constraint ${indexName}` +
        ' unique (' +
        this.formatter.columnize(columns) +
        ')' +
        deferrable,
    );
  }

  index(columns, indexName, options) {
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand('index', this.tableNameRaw, columns);

    let predicate;

    if (isString(options)) {
      // indexType = options;
    } else if (isObject(options)) {
      ({ predicate } = options);
    }

    const predicateQuery = predicate
      ? ' ' + this.client.queryCompiler(predicate).where()
      : '';

    this.pushQuery(
      `create index ${indexName}` +
        ' (' +
        this.formatter.columnize(columns) +
        ')' +
        ` on ${this.tableName()} ${predicateQuery}`,
    );
  }

  dropPrimary(constraintName) {
    constraintName = constraintName
      ? this.formatter.wrap(constraintName)
      : this.formatter.wrap(this.tableNameRaw + '_pkey');
    this.pushQuery(
      `alter table ${this.tableName()} drop constraint ${constraintName}`,
    );
  }

  dropIndex(columns, indexName) {
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand('index', this.tableNameRaw, columns);
    indexName = this.schemaNameRaw
      ? `${this.formatter.wrap(this.schemaNameRaw)}.${indexName}`
      : indexName;
    this.pushQuery(`drop index ${indexName} on ${this.tableName()}`);
  }

  dropUnique(columns, indexName) {
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand('unique', this.tableNameRaw, columns);
    this.pushQuery(
      `alter table ${this.tableName()} drop constraint ${indexName}`,
    );
  }

  dropForeign(columns, indexName) {
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand('foreign', this.tableNameRaw, columns);
    this.pushQuery(
      `alter table ${this.tableName()} drop constraint ${indexName}`,
    );
  }
}

module.exports = TableCompiler_SF;
