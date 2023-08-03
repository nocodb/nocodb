import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaMysql extends BaseModelXcMeta {
  /**
   * @param dir
   * @param filename
   * @param ctx
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir, filename, ctx }) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  prepare() {
    const data: any = {};

    /* run of simple variable */
    data.tn = this.ctx.tn;
    data.dbType = this.ctx.dbType;

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.columns = {
      func: this._renderXcColumns.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        relations: this.ctx.relations,
      },
    };

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.hasMany = {
      func: this._renderXcHasMany.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        hasMany: this.ctx.hasMany,
      },
    };

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.belongsTo = {
      func: this._renderXcBelongsTo.bind(this),
      args: {
        dbType: this.ctx.dbType,
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        belongsTo: this.ctx.belongsTo,
      },
    };

    return data;
  }

  _renderXcHasMany(args) {
    return JSON.stringify(args.hasMany);
  }

  _renderXcBelongsTo(args) {
    return JSON.stringify(args.belongsTo);
  }

  /**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  _renderXcColumns(args) {
    let str = '[\r\n';

    for (let i = 0; i < args.columns.length; ++i) {
      str += `{\r\n`;
      str += `cn: '${args.columns[i].cn}',\r\n`;
      str += `type: '${this._getAbstractType(args.columns[i])}',\r\n`;
      str += `dt: '${args.columns[i].dt}',\r\n`;
      if (args.columns[i].rqd) str += `rqd: ${args.columns[i].rqd},\r\n`;

      if (args.columns[i].cdf) {
        str += `default: "${args.columns[i].cdf}",\r\n`;
        str += `columnDefault: "${args.columns[i].cdf}",\r\n`;
      }

      if (args.columns[i].un) str += `un: ${args.columns[i].un},\r\n`;

      if (args.columns[i].pk) str += `pk: ${args.columns[i].pk},\r\n`;

      if (args.columns[i].ai) str += `ai: ${args.columns[i].ai},\r\n`;

      if (args.columns[i].dtxp) str += `dtxp: "${args.columns[i].dtxp}",\r\n`;

      if (args.columns[i].dtxs) str += `dtxs: ${args.columns[i].dtxs},\r\n`;

      str += `validate: {
                func: [],
                args: [],
                msg: []
              },`;
      str += `},\r\n`;
    }

    str += ']\r\n';

    return str;
  }

  /* getXcColumnsObject(args) {
    const columnsArr = [];

    for (const column of args.columns) {
      const columnObj = {
        validate: {
          func: [],
          args: [],
          msg: []
        },
        cn: column.cn,
        _cn: column._cn || column.cn,
        type: this._getAbstractType(column),
        dt: column.dt,

        uidt: column.uidt || this._getUIDataType(column),
        uip: column.uip,
        uicn: column.uicn,
        ...column
      };

      if (column.rqd) {
        columnObj.rqd = column.rqd;
      }

      if (column.cdf) {
        columnObj.default = column.cdf;
        columnObj.columnDefault = column.cdf;
      }

      if (column.un) {
        columnObj.un = column.un;
      }

      if (column.pk) {
        columnObj.pk = column.pk;
      }

      if (column.ai) {
        columnObj.ai = column.ai;
      }

      if (column.dtxp) {
        columnObj.dtxp = column.dtxp;
      }

      if (column.dtxs) {
        columnObj.dtxs = column.dtxs;
      }

      columnsArr.push(columnObj);
    }
    this.mapDefaultDisplayValue(columnsArr);
    return columnsArr;
  }
*/
  _getAbstractType(column) {
    let str = '';
    switch (column.dt) {
      case 'int':
        str = 'integer';
        break;
      case 'tinyint':
        str = 'integer';
        break;
      case 'smallint':
        str = 'integer';
        break;
      case 'mediumint':
        str = 'integer';
        break;
      case 'bigint':
        str = 'bigInteger';
        break;
      case 'float':
        str = 'float';
        break;
      case 'decimal':
        str = 'decimal';
        break;
      case 'double':
        str = 'double';
        break;
      case 'real':
        str = 'real';
        break;
      case 'bit':
        str = 'boolean';
        break;
      case 'boolean':
        str = 'boolean';
        break;
      case 'serial':
        str = 'serial';
        break;
      case 'date':
        str = 'date';
        break;
      case 'datetime':
        str = 'datetime';
        break;
      case 'timestamp':
        str = 'timestamp';
        break;
      case 'time':
        str = 'time';
        break;
      case 'year':
        str = 'year';
        break;
      case 'char':
        str = 'string';
        break;
      case 'varchar':
        str = 'string';
        break;
      case 'nchar':
        str = 'string';
        break;
      case 'text':
        str = 'text';
        break;
      case 'tinytext':
        str = 'text';
        break;
      case 'mediumtext':
        str = 'text';
        break;
      case 'longtext':
        str = 'text';
        break;
      case 'binary':
        str = 'binary';
        break;
      case 'varbinary':
        str = 'binary';
        break;
      case 'blob':
        str = 'blob';
        break;
      case 'tinyblob':
        str = 'tinyblob';
        break;
      case 'mediumblob':
        str = 'mediumblob';
        break;
      case 'longblob':
        str = 'longblob';
        break;
      case 'enum':
        str = 'enum';
        break;
      case 'set':
        str = 'set';
        break;
      case 'geometry':
        str = 'geometry';
        break;
      case 'point':
        str = 'point';
        break;
      case 'linestring':
        str = 'linestring';
        break;
      case 'polygon':
        str = 'polygon';
        break;
      case 'multipoint':
        str = 'multipoint';
        break;
      case 'multilinestring':
        str = 'multilinestring';
        break;
      case 'multipolygon':
        str = 'multipolygon';
        break;
      case 'json':
        str = 'json';
        break;
      default:
        str += `"${column.dt}"`;
        break;
    }
    return str;
  }

  getUIDataType(col): any {
    switch (this.getAbstractType(col)) {
      case 'integer':
        return 'Number';
      case 'boolean':
        return 'Checkbox';
      case 'float':
        return 'Decimal';
      case 'date':
        return 'Date';
      case 'datetime':
        return 'DateTime';
      case 'time':
        return 'Time';
      case 'year':
        return 'Year';
      case 'string':
        return 'SingleLineText';
      case 'text':
        return 'LongText';
      case 'enum':
        return 'SingleSelect';
      case 'set':
        return 'MultiSelect';
      case 'json':
        return 'JSON';
      case 'blob':
        return 'LongText';
      case 'geometry':
        return 'Geometry';
      default:
        return 'SpecificDBType';
    }
  }

  getAbstractType(col): any {
    switch ((col.dt || col.dt).toLowerCase()) {
      case 'int':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'bit':
        return 'integer';

      case 'boolean':
        return 'boolean';

      case 'float':
      case 'decimal':
      case 'double':
      case 'serial':
        return 'float';
      case 'tinyint':
        if (col.dtxp == '1') {
          return 'boolean';
        } else {
          return 'integer';
        }
      case 'date':
        return 'date';
      case 'datetime':
      case 'timestamp':
        return 'datetime';
      case 'time':
        return 'time';
      case 'year':
        return 'year';
      case 'char':
      case 'varchar':
      case 'nchar':
        return 'string';
      case 'text':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
        return 'text';

      // todo: use proper type
      case 'binary':
        return 'string';
      case 'varbinary':
        return 'text';

      case 'blob':
      case 'tinyblob':
      case 'mediumblob':
      case 'longblob':
        return 'blob';

      case 'enum':
        return 'enum';
      case 'set':
        return 'set';

      case 'geometry':
      case 'point':
      case 'linestring':
      case 'polygon':
      case 'multipoint':
      case 'multilinestring':
      case 'multipolygon':
        return 'geometry';

      case 'json':
        return 'json';
    }
  }

  _sequelizeGetDefault(column) {
    let str = '';
    switch (column.dt) {
      case 'int':
        str += `'${column.cdf}'`;
        break;
      case 'tinyint':
        str += `'${column.cdf}'`;
        break;
      case 'smallint':
        str += `'${column.cdf}'`;
        break;
      case 'mediumint':
        str += `'${column.cdf}'`;
        break;
      case 'bigint':
        str += `'${column.cdf}'`;
        break;
      case 'float':
        str += `'${column.cdf}'`;
        break;
      case 'decimal':
        str += `'${column.cdf}'`;
        break;
      case 'double':
        str += `'${column.cdf}'`;
        break;
      case 'real':
        str += `'${column.cdf}'`;
        break;
      case 'bit':
        str += column.cdf ? column.cdf.split('b')[1] : column.cdf;
        break;
      case 'boolean':
        str += column.cdf;
        break;
      case 'serial':
        str += column.cdf;
        break;
      case 'date':
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case 'datetime':
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case 'timestamp':
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case 'time':
        str += `'${column.cdf}'`;
        break;
      case 'year':
        str += `'${column.cdf}'`;
        break;
      case 'char':
        str += `'${column.cdf}'`;
        break;
      case 'varchar':
        str += `'${column.cdf}'`;
        break;
      case 'nchar':
        str += `'${column.cdf}'`;
        break;
      case 'text':
        str += column.cdf;
        break;
      case 'tinytext':
        str += column.cdf;
        break;
      case 'mediumtext':
        str += column.cdf;
        break;
      case 'longtext':
        str += column.cdf;
        break;
      case 'binary':
        str += column.cdf;
        break;
      case 'varbinary':
        str += column.cdf;
        break;
      case 'blob':
        str += column.cdf;
        break;
      case 'tinyblob':
        str += column.cdf;
        break;
      case 'mediumblob':
        str += column.cdf;
        break;
      case 'longblob':
        str += column.cdf;
        break;
      case 'enum':
        str += `'${column.cdf}'`;
        break;
      case 'set':
        str += `'${column.cdf}'`;
        break;
      case 'geometry':
        str += `'${column.cdf}'`;
        break;
      case 'point':
        str += `'${column.cdf}'`;
        break;
      case 'linestring':
        str += `'${column.cdf}'`;
        break;
      case 'polygon':
        str += `'${column.cdf}'`;
        break;
      case 'multipoint':
        str += `'${column.cdf}'`;
        break;
      case 'multilinestring':
        str += `'${column.cdf}'`;
        break;
      case 'multipolygon':
        str += `'${column.cdf}'`;
        break;
      case 'json':
        str += column.cdf;
        break;
    }
    return str;
  }
}

export default ModelXcMetaMysql;
