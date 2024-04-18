const ColumnCompiler = require('knex/lib/schema/columncompiler');
const { isObject } = require('knex/lib/util/is');
const { toNumber } = require('knex/lib/util/helpers');
const commentEscapeRegex = /(?<!')'(?!')/g;

class ColumnCompiler_DB extends ColumnCompiler {
  constructor(client, tableCompiler, columnBuilder) {
    super(client, tableCompiler, columnBuilder);
    this.modifiers = ['nullable', 'defaultTo', 'comment'];
    this._addCheckModifiers();
  }

  // Types
  // ------

  increments(options = { primaryKey: true }) {
    return (
      'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY'
    );
  }

  bigincrements(options = { primaryKey: true }) {
    return (
      'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY'
    );
  }
}

ColumnCompiler_DB.prototype.bigint = 'bigint';
ColumnCompiler_DB.prototype.binary = 'bytea';
ColumnCompiler_DB.prototype.bool = 'boolean';
ColumnCompiler_DB.prototype.double = 'double precision';
ColumnCompiler_DB.prototype.floating = 'real';
ColumnCompiler_DB.prototype.smallint = 'smallint';
ColumnCompiler_DB.prototype.tinyint = 'smallint';

module.exports = ColumnCompiler_DB;
