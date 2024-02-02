import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaMssql extends BaseModelXcMeta {
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

  _getAbstractType(column) {
    let str = '';
    switch (column.dt) {
      case 'bigint':
        str = 'bigInteger';
        break;
      case 'binary':
        str = 'binary';
        break;
      case 'bit':
        str = 'bit';
        break;
      case 'char':
        str = 'string';
        break;
      case 'date':
        str = 'date';
        break;
      case 'datetime':
        str = 'datetime';
        break;
      case 'datetime2':
        str = 'datetime';
        break;
      case 'datetimeoffset':
        str = 'datetimeoffset';
        break;
      case 'decimal':
        str = 'decimal';
        break;
      case 'float':
        str = 'float';
        break;
      case 'geography':
        str = 'geography';
        break;
      case 'geometry':
        str = 'geometry';
        break;
      case 'heirarchyid':
        str = 'heirarchyid';
        break;
      case 'image':
        str = 'image';
        break;
      case 'int':
        str = 'integer';
        break;
      case 'money':
        str = 'money';
        break;
      case 'nchar':
        str = 'string';
        break;
      case 'ntext':
        str = 'text';
        break;
      case 'numeric':
        str = 'numeric';
        break;
      case 'nvarchar':
        str = 'string';
        break;
      case 'real':
        str = 'float';
        break;
      case 'json':
        str = 'json';
        break;
      case 'smalldatetime':
        str = 'datetime';
        break;
      case 'smallint':
        str = 'integer';
        break;
      case 'smallmoney':
        str = 'smallmoney';
        break;
      case 'sql_variant':
        str = 'sql_variant';
        break;
      case 'sysname':
        str = 'sysname';
        break;
      case 'text':
        str = 'text';
        break;
      case 'time':
        str = 'time';
        break;
      case 'timestamp':
        str = 'timestamp';
        break;
      case 'tinyint':
        str = 'integer';
        break;
      case 'uniqueidentifier':
        str = 'uniqueidentifier';
        break;
      case 'varbinary':
        str = 'binary';
        break;
      case 'xml':
        str = 'xml';
        break;
      case 'varchar':
        str = 'string';
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

  /*
  getObject() {
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

  }
*/

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
    const dt = (col.dt || col.dt).toLowerCase();
    switch (dt) {
      case 'bigint':
      case 'smallint':
      case 'bit':
      case 'tinyint':
      case 'int':
        return 'integer';

      case 'binary':
        return 'string';

      case 'char':
        return 'string';

      case 'date':
        return 'date';
      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'datetimeoffset':
        return 'datetime';
      case 'decimal':
      case 'float':
        return 'float';

      case 'geometry':
        return 'geometry';

      case 'geography':
      case 'heirarchyid':
      case 'image':
        return 'string';

      case 'money':
      case 'nchar':
        return 'string';

      case 'ntext':
        return 'text';
      case 'numeric':
        return 'float';
      case 'nvarchar':
        return 'string';
      case 'real':
        return 'float';

      case 'json':
        return 'json';

      case 'smallmoney':
      case 'sql_variant':
      case 'sysname':
        return dt;
      case 'text':
        return 'text';
      case 'time':
        return 'time';
      case 'timestamp':
        return 'timestamp';

      case 'uniqueidentifier':
      case 'varbinary':
      case 'xml':
        return dt;
      case 'varchar':
        return 'string';
    }
  }
}

export default ModelXcMetaMssql;
