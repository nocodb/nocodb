import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaOracle extends BaseModelXcMeta {
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
        dbType: this.ctx.dbType,
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        belongsTo: this.ctx.belongsTo,
      },
    };

    return data;
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
      case 'char':
        str = 'string';
        break;
      case 'nchar':
        str = 'string';
        break;
      case 'nvarchar2':
        str = 'string';
        break;
      case 'varchar2':
        str = 'string';
        break;
      case 'long':
        str = 'string';
        break;
      case 'raw':
        // todo: map correct datatype
        str = 'string';
        break;
      case 'long raw':
        // todo: map correct datatype
        str = 'string';
        break;
      case 'number':
        str = 'float';
        break;
      case 'numeric':
        str = 'float';
        break;
      case 'float':
        str = 'float';
        break;
      case 'dec':
        str = 'float';
        break;
      case 'decimal':
        str = 'float';
        break;
      case 'integer':
        str = 'integer';
        break;
      case 'int':
        str = 'integer';
        break;
      case 'smallint':
        str = 'integer';
        break;
      case 'real':
        str = 'float';
        break;
      case 'double precision':
        str = 'float';
        break;
      case 'date':
        str = 'date';
        break;
      case 'timestamp':
        str = 'timestamp';
        break;
      case 'timestamp with time zone':
        str = 'timestamp';
        break;
      case 'timestamp with local time zone':
        str = 'timestamp';
        break;
      case 'interval year to month':
        str = 'string';
        break;
      case 'interval day to second':
        str = 'string';
        break;
      case 'bfile':
        str = 'blob';
        break;
      case 'blob':
        str = 'blob';
        break;
      case 'clob':
        str = 'string';
        break;
      case 'nclob':
        str = 'string';
        break;
      case 'rowid':
        str = 'bigInteger';
        break;
      case 'urowid':
        str = 'bigInteger';
        break;
      default:
        str += `"${column.dt}"`;
        break;
        break;
    }

    return str;
  }

  getAbstractType(col): any {
    switch ((col.dt || col.dt).toLowerCase()) {
      case 'integer':
        return 'integer';
      case 'bfile':
      case 'binary rowid':
      case 'binary double':
      case 'binary_float':
        return 'string';
      case 'blob':
        return 'blob';
      case 'canoical':
      case 'cfile':
      case 'char':
      case 'clob':
      case 'content pointer':
      case 'contigous array':
        return 'string';
      case 'date':
        return 'date';
      case 'decimal':
      case 'double precision':
      case 'float':
        return 'float';
      case 'interval day to second':
      case 'interval year to month':
        return 'string';
      case 'lob pointer':
        return 'string';
      case 'long':
        return 'integer';
      case 'long raw':
        return 'string';
      case 'named collection':
      case 'named object':
      case 'nchar':
      case 'nclob':
        return 'string';
      case 'nvarchar2':
      case 'oid':
      case 'pointer':
      case 'raw':
        return 'string';
      case 'real':
      case 'number':
        return 'float';
      case 'ref':
      case 'ref cursor':
      case 'rowid':
      case 'signed binary integer':
        return 'string';
      case 'smallint':
        return 'integer';
      case 'table':
        return 'string';
      case 'time':
      case 'time with tz':
        return 'time';
      case 'timestamp':
      case 'timestamp with local time zone':
      case 'timestamp with local tz':
      case 'timestamp with timezone':
      case 'timestamp with tz':
        return 'datetime';
      case 'unsigned binary integer':
      case 'urowid':
      case 'varchar':
      case 'varchar2':
        return 'string';
      case 'varray':
      case 'varying array':
        return 'string';
    }
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
      case 'blob':
        return 'Attachment';
      case 'enum':
        return 'SingleSelect';
      case 'set':
        return 'MultiSelect';
      case 'json':
        return 'JSON';
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

  }*/
}

export default ModelXcMetaOracle;
