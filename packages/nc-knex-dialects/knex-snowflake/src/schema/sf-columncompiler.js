// Snowflake Column Compiler
// -------

const ColumnCompiler = require('knex/lib/schema/columncompiler');
const { isObject } = require('knex/lib/util/is');
const { toNumber } = require('knex/lib/util/helpers');
const commentEscapeRegex = /(?<!')'(?!')/g;

class ColumnCompiler_SF extends ColumnCompiler {
  constructor(client, tableCompiler, columnBuilder) {
    super(client, tableCompiler, columnBuilder);
    this.modifiers = ['nullable', 'defaultTo', 'comment'];
    this._addCheckModifiers();
  }

  // Types
  // ------

  bit(column) {
    return column.length !== false ? `bit(${column.length})` : 'bit';
  }

  // Create the column definition for an enum type.
  // Using method "2" here: http://stackoverflow.com/a/10984951/525714
  enu(allowed, options) {
    options = options || {};

    const values =
      options.useNative && options.existingType
        ? undefined
        : allowed.join("', '");

    if (options.useNative) {
      let enumName = '';
      const schemaName = options.schemaName || this.tableCompiler.schemaNameRaw;

      if (schemaName) {
        enumName += `"${schemaName}".`;
      }

      enumName += `"${options.enumName}"`;

      if (!options.existingType) {
        this.tableCompiler.unshiftQuery(
          `create type ${enumName} as enum ('${values}')`,
        );
      }

      return enumName;
    }
    return `text check (${this.formatter.wrap(this.args[0])} in ('${values}'))`;
  }

  decimal(precision, scale) {
    if (precision === null) return 'decimal';
    return `decimal(${toNumber(precision, 8)}, ${toNumber(scale, 2)})`;
  }

  json(jsonb) {
    if (jsonb) this.client.logger.deprecate('json(true)', 'jsonb()');
    return jsonColumn(this.client, jsonb);
  }

  jsonb() {
    return jsonColumn(this.client, true);
  }

  checkRegex(regex, constraintName) {
    return this._check(
      `${this.formatter.wrap(
        this.getColumnName(),
      )} ~ ${this.client._escapeBinding(regex)}`,
      constraintName,
    );
  }

  datetime(withoutTz = false, precision) {
    let useTz;
    if (isObject(withoutTz)) {
      ({ useTz, precision } = withoutTz);
    } else {
      useTz = !withoutTz;
    }
    useTz = typeof useTz === 'boolean' ? useTz : true;
    precision =
      precision !== undefined && precision !== null
        ? '(' + precision + ')'
        : '';

    return `${useTz ? 'timestamptz' : 'timestamp'}${precision}`;
  }

  timestamp(withoutTz = false, precision) {
    return this.datetime(withoutTz, precision);
  }

  // Modifiers:
  // ------
  comment(comment) {
    const columnName = this.args[0] || this.defaults('columnName');
    const escapedComment = comment
      ? `'${comment.replace(commentEscapeRegex, "''")}'`
      : 'NULL';

    this.pushAdditional(function () {
      this.pushQuery(
        `comment on column ${this.tableCompiler.tableName()}.` +
          this.formatter.wrap(columnName) +
          ` is ${escapedComment}`,
      );
    }, comment);
  }

  increments(options = { primaryKey: true }) {
    return (
      'int identity(1,1)' +
      (this.tableCompiler._canBeAddPrimaryKey(options) ? ' primary key' : '')
    );
  }

  uuid(options = { primaryKey: false }) {
    return (
      'uuid' +
      (this.tableCompiler._canBeAddPrimaryKey(options) ? ' primary key' : '')
    );
  }
}

ColumnCompiler_SF.prototype.bigint = 'bigint';
ColumnCompiler_SF.prototype.binary = 'bytea';
ColumnCompiler_SF.prototype.bool = 'boolean';
ColumnCompiler_SF.prototype.double = 'double precision';
ColumnCompiler_SF.prototype.floating = 'real';
ColumnCompiler_SF.prototype.smallint = 'smallint';
ColumnCompiler_SF.prototype.tinyint = 'smallint';

function jsonColumn(client, jsonb) {
  if (
    !client.version ||
    client.config.client === 'cockroachdb' ||
    parseFloat(client.version) >= 9.2
  ) {
    return jsonb ? 'jsonb' : 'json';
  }
  return 'text';
}

module.exports = ColumnCompiler_SF;
