import BaseModelXcMeta from './BaseModelXcMeta';
import { UITypes } from 'nocodb-sdk';

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
      case 'CHAR':
      case 'VARCHAR':
      case 'VARCHAR2':
      case 'NCHAR':
      case 'NVARCHAR2':
        return 'string';
      case 'NUMBER':
      case 'BINARY_FLOAT':
      case 'BINARY_DOUBLE':
        return 'float';
      case 'CLOB':
      case 'NCLOB':
        return 'text';

      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMP WITH LOCAL TIME ZONE':
      case 'TIMESTAMP WITH TIME ZONE':
        return 'datetime';

      case 'BLOB':
      case 'BFILE':
      case 'RAW':
      case 'LONG RAW':
      case 'ROWID':
      case 'UROWID':
      case 'XMLType':
      case 'UriType':
        return 'string';
    }
  }

  getUIDataType(col): any {
    switch (this.getAbstractType(col)) {
      case 'integer':
        return UITypes.Number;
      case 'boolean':
        return UITypes.Checkbox;
      case 'float':
        return UITypes.Number;
      case 'date':
        return UITypes.Date;
      case 'datetime':
        return UITypes.DateTime;
      case 'time':
        return UITypes.Time;
      case 'year':
        return UITypes.Year;
      case 'string':
        return UITypes.SingleLineText;
      case 'blob':
        return UITypes.LongText;
      case 'text':
        return UITypes.LongText;
      default:
        return UITypes.SpecificDBType;
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
