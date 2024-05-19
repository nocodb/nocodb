import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaDatabricks extends BaseModelXcMeta {
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
      func: this.renderXcHasMany.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        hasMany: this.ctx.hasMany,
      },
    };

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.belongsTo = {
      func: this.renderXcBelongsTo.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        belongsTo: this.ctx.belongsTo,
      },
    };

    return data;
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

  _getAbstractType(column) {
    return this.getAbstractType(column);
  }

  getUIDataType(col): any {
    const dt = col.dt.toLowerCase();
    switch (dt) {
      case 'bigint':
      case 'tinyint':
      case 'int':
      case 'smallint':
        return 'Number';
      case 'decimal':
      case 'double':
      case 'float':
        return 'Decimal';
      case 'boolean':
        return 'Checkbox';
      case 'timestamp':
      case 'timestamp_ntz':
        return 'DateTime';

      case 'date':
        return 'Date';

      case 'string':
        return 'LongText';

      case 'interval':
      case 'void':
      case 'binary':
      default:
        return 'SpecificDBType';
    }
  }

  getAbstractType(col): any {
    const dt = col.dt.toLowerCase();
    switch (dt) {
      case 'bigint':
      case 'tinyint':
      case 'decimal':
      case 'double':
      case 'float':
      case 'int':
      case 'smallint':
        return 'integer';
      case 'binary':
        return dt;
      case 'boolean':
        return 'boolean';
      case 'interval':
      case 'void':
        return dt;

      case 'timestamp':
      case 'timestamp_ntz':
        return 'datetime';

      case 'date':
        return 'date';

      case 'string':
        return 'string';
    }
  }

  _sequelizeGetType(column) {
    let str = '';
    switch (column.dt) {
      case 'int':
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un) str += `.UNSIGNED`;
        break;
      case 'tinyint':
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un) str += `.UNSIGNED`;

        break;
      case 'smallint':
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un) str += `.UNSIGNED`;

        break;
      case 'mediumint':
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un) str += `.UNSIGNED`;

        break;
      case 'bigint':
        str += `DataTypes.BIGINT`;
        if (column.un) str += `.UNSIGNED`;

        break;
      case 'float':
        str += `DataTypes.FLOAT`;
        break;
      case 'decimal':
        str += `DataTypes.DECIMAL`;
        break;
      case 'double':
        str += `"DOUBLE(${column.dtxp},${column.ns})"`;
        break;
      case 'real':
        str += `DataTypes.FLOAT`;
        break;
      case 'bit':
        str += `DataTypes.BOOLEAN`;
        break;
      case 'boolean':
        str += `DataTypes.STRING(45)`;
        break;
      case 'serial':
        str += `DataTypes.BIGINT`;
        break;
      case 'date':
        str += `DataTypes.DATEONLY`;
        break;
      case 'datetime':
        str += `DataTypes.DATE`;
        break;
      case 'timestamp':
        str += `DataTypes.DATE`;
        break;
      case 'time':
        str += `DataTypes.TIME`;
        break;
      case 'year':
        str += `"YEAR"`;
        break;
      case 'char':
        str += `DataTypes.CHAR(${column.dtxp})`;
        break;
      case 'varchar':
        str += `DataTypes.STRING(${column.dtxp})`;
        break;
      case 'nchar':
        str += `DataTypes.CHAR(${column.dtxp})`;
        break;
      case 'text':
        str += `DataTypes.TEXT`;
        break;
      case 'tinytext':
        str += `DataTypes.TEXT`;
        break;
      case 'mediumtext':
        str += `DataTypes.TEXT`;
        break;
      case 'longtext':
        str += `DataTypes.TEXT`;
        break;
      case 'binary':
        str += `"BINARY(${column.dtxp})"`;
        break;
      case 'varbinary':
        str += `"VARBINARY(${column.dtxp})"`;
        break;
      case 'blob':
        str += `"BLOB"`;
        break;
      case 'tinyblob':
        str += `"TINYBLOB"`;
        break;
      case 'mediumblob':
        str += `"MEDIUMBLOB"`;
        break;
      case 'longblob':
        str += `"LONGBLOB"`;
        break;
      case 'enum':
        str += `DataTypes.ENUM(${column.dtxp})`;
        break;
      case 'set':
        str += `"SET(${column.dtxp})"`;
        break;
      case 'geometry':
        str += `DataTypes.GEOMETRY`;
        break;
      case 'point':
        str += `"POINT"`;
        break;
      case 'linestring':
        str += `"LINESTRING"`;
        break;
      case 'polygon':
        str += `"POLYGON"`;
        break;
      case 'multipoint':
        str += `"MULTIPOINT"`;
        break;
      case 'multilinestring':
        str += `"MULTILINESTRING"`;
        break;
      case 'multipolygon':
        str += `"MULTIPOLYGON"`;
        break;
      case 'json':
        str += `DataTypes.JSON`;
        break;
      default:
        str += `"${column.dt}"`;
        break;
    }
    return str;
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

  /*  getXcColumnsObject(args) {
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
  }*/

  /*  getObject() {
    return {
      tn: this.ctx.tn,
      _tn: this.ctx._tn,
      columns: this.getXcColumnsObject(this.ctx),
      pks: [],
      hasMany: this.ctx.hasMany,
      belongsTo: this.ctx.belongsTo,
      dbType: this.ctx.dbType,
      type: this.ctx.type,
    }

  }*/
}

export default ModelXcMetaDatabricks;
