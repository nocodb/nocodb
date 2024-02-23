import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaSqlite extends BaseModelXcMeta {
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
      func: this.renderXcColumns.bind(this),
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

  protected _getAbstractType(column) {
    let str = '';
    switch (column.dt) {
      case 'int':
        str = 'integer';
        break;
      case 'integer':
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
      case 'int2':
        str = 'integer';
        break;
      case 'int8':
        str = 'integer';
        break;
      case 'character':
        str = 'string';
        break;
      case 'blob sub_type text':
        str = 'text';
        break;
      case 'numeric':
        str = 'float';
        break;
      case 'blob':
        str = 'blob';
        break;
      case 'real':
        str = 'float';
        break;
      case 'double':
        str = 'decimal';
        break;
      case 'double precision':
        str = 'decimal';
        break;
      case 'float':
        str = 'float';
        break;
      case 'boolean':
        str = 'boolean';
        break;
      case 'date':
        str = 'date';
        break;
      case 'datetime':
        str = 'datetime';
        break;
      case 'text':
        str = 'text';
        break;
      case 'varchar':
        str = 'string';
        break;
      case 'timestamp':
        str = 'timestamp';
        break;
      default:
        str += `"${column.dt}"`;
        break;
    }
    return str;
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

  /*
  public getXcColumnsObject(args): any {
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

  /*  public getObject(): any {
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
        return 'LongText';
      case 'blob':
        return 'LongText';
      case 'geometry':
        return 'Geometry';
      default:
        return 'SpecificDBType';
    }
  }

  private getAbstractType(col): any {
    // remove length value from datatype (for ex. varchar(45) => varchar)
    switch (col.dt?.replace(/\(\d+\)$/, '').toLowerCase()) {
      case 'date':
        return 'date';
      case 'datetime':
      case 'timestamp':
        return 'datetime';
      case 'integer':
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'int2':
      case 'int8':
        return 'integer';
      case 'text':
        return 'text';
      case 'boolean':
        return 'boolean';
      case 'real':
      case 'double':
      case 'double precision':
      case 'float':
      case 'numeric':
        return 'float';

      case 'blob sub_type text':
      case 'blob':
        return 'blob';

      case 'character':
      case 'varchar':
        return 'string';
    }
  }
}

export default ModelXcMetaSqlite;
