import BaseRender from "../../BaseRender";

class MssqlXcRender extends BaseRender {

  /**
   *
   * @param dir
   * @param filename
   * @param ctx
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({dir, filename, ctx}) {
    super({dir, filename, ctx});
  }

  /**
   *  Prepare variables used in code template
   */
  prepare() {

    const data:any = {};

    /* example of simple variable */
    data.tn = this.ctx.tn;

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.columns = {
      func: this._renderXcColumns.bind(this),
      args: {columns: this.ctx.columns, relations: this.ctx.relations, tn: this.ctx.tn}
    };

    data.pks = {
      func: this._renderXcPks.bind(this),
      args: {columns: this.ctx.columns, relations: this.ctx.relations, tn: this.ctx.tn}
    };

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.relations = {
      func: this._renderXcRelations.bind(this),
      args: {columns: this.ctx.columns, relations: this.ctx.relations, tn: this.ctx.tn}
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
      str += `dt: '${args.columns[i].dt}',\r\n`;
      if (args.columns[i].rqd)
        str += `rqd: ${args.columns[i].rqd},\r\n`;

      if (args.columns[i].cdf)
        str += `default: "${args.columns[i].cdf}",\r\n`;

      if (args.columns[i].un)
        str += `un: ${args.columns[i].un},\r\n`;

      if (args.columns[i].pk)
        str += `pk: ${args.columns[i].pk},\r\n`;

      if (args.columns[i].ai)
        str += `ai: ${args.columns[i].ai},\r\n`;

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

  /**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  _renderXcPks(args) {

    let str = '{\r\n';

    for (let i = 0; i < args.columns.length; ++i) {

      str += `${args.columns[i].cn} : {\r\n`;

      if (args.columns[i].rqd)
        str += `rqd: ${args.columns[i].rqd},`;

      if (args.columns[i].cdf)
        str += `default: "${args.columns[i].cdf}",`;

      if (args.columns[i].un)
        str += `un: ${args.columns[i].un},`;

      if (args.columns[i].pk)
        str += `pk: ${args.columns[i].pk},`;

      if (args.columns[i].ai)
        str += `ai: ${args.columns[i].ai},`;

      str += `validate: {
                func: [],
                args: [],
                msg: []
              },`;
      str += `},\r\n`;

    }

    str += '}\r\n';

    return str;

  }


  /**
   *
   * @param args
   * @param args.tn
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  _renderXcRelations(args) {

    let relationStr = '';

    let belongsToRelations = args.relations.filter(r => r.tn === args.tn);
    let hasManyRelations = args.relations.filter(r => r.rtn === args.tn);

    if (belongsToRelations.length || hasManyRelations.length) {

      relationStr = `${args.tn}.associate = function(models) {`

      for (let i = 0; i < belongsToRelations.length; ++i) {
        relationStr += `${args.tn}.belongsTo(models.${belongsToRelations[i].rtn});\n`
      }

      for (let i = 0; i < hasManyRelations.length; ++i) {
        relationStr += `${args.tn}.hasMany(models.${hasManyRelations[i]._tn});\n`
      }


      relationStr += `}`
    }

    return relationStr;

  }


  _sequelizeGetType(column) {
    let str = '';
    switch (column.dt) {
      case "int":
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un)
          str += `.UNSIGNED`;
        break;
      case "tinyint":
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un)
          str += `.UNSIGNED`;

        break;
      case "smallint":
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un)
          str += `.UNSIGNED`;

        break;
      case "mediumint":
        str += `DataTypes.INTEGER(${column.dtxp})`;
        if (column.un)
          str += `.UNSIGNED`;

        break;
      case "bigint":
        str += `DataTypes.BIGINT`;
        if (column.un)
          str += `.UNSIGNED`;

        break;
      case "float":
        str += `DataTypes.FLOAT`;
        break;
      case "decimal":
        str += `DataTypes.DECIMAL`;
        break;
      case "double":
        str += `"DOUBLE(${column.dtxp},${column.ns})"`;
        break;
      case "real":
        str += `DataTypes.FLOAT`;
        break;
      case "bit":
        str += `DataTypes.BOOLEAN`;
        break;
      case "boolean":
        str += `DataTypes.STRING(45)`;
        break;
      case "serial":
        str += `DataTypes.BIGINT`;
        break;
      case "date":
        str += `DataTypes.DATEONLY`;
        break;
      case "datetime":
        str += `DataTypes.DATE`;
        break;
      case "timestamp":
        str += `DataTypes.DATE`;
        break;
      case "time":
        str += `DataTypes.TIME`;
        break;
      case "year":
        str += `"YEAR"`;
        break;
      case "char":
        str += `DataTypes.CHAR(${column.dtxp})`;
        break;
      case "varchar":
        str += `DataTypes.STRING(${column.dtxp})`;
        break;
      case "nchar":
        str += `DataTypes.CHAR(${column.dtxp})`;
        break;
      case "text":
        str += `DataTypes.TEXT`;
        break;
      case "tinytext":
        str += `DataTypes.TEXT`;
        break;
      case "mediumtext":
        str += `DataTypes.TEXT`;
        break;
      case "longtext":
        str += `DataTypes.TEXT`;
        break;
      case "binary":
        str += `"BINARY(${column.dtxp})"`;
        break;
      case "varbinary":
        str += `"VARBINARY(${column.dtxp})"`;
        break;
      case "blob":
        str += `"BLOB"`;
        break;
      case "tinyblob":
        str += `"TINYBLOB"`;
        break;
      case "mediumblob":
        str += `"MEDIUMBLOB"`;
        break;
      case "longblob":
        str += `"LONGBLOB"`;
        break;
      case "enum":
        str += `DataTypes.ENUM(${column.dtxp})`;
        break;
      case "set":
        str += `"SET(${column.dtxp})"`;
        break;
      case "time":
        str += `DataTypes.TIME`;
        break;
      case "geometry":
        str += `DataTypes.GEOMETRY`;
        break;
      case "point":
        str += `"POINT"`;
        break;
      case "linestring":
        str += `"LINESTRING"`;
        break;
      case "polygon":
        str += `"POLYGON"`;
        break;
      case "multipoint":
        str += `"MULTIPOINT"`;
        break;
      case "multilinestring":
        str += `"MULTILINESTRING"`;
        break;
      case "multipolygon":
        str += `"MULTIPOLYGON"`;
        break;
      case "json":
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
      case "int":
        str += `'${column.cdf}'`;
        break;
      case "tinyint":
        str += `'${column.cdf}'`;
        break;
      case "smallint":
        str += `'${column.cdf}'`;
        break;
      case "mediumint":
        str += `'${column.cdf}'`;
        break;
      case "bigint":
        str += `'${column.cdf}'`;
        break;
      case "float":
        str += `'${column.cdf}'`;
        break;
      case "decimal":
        str += `'${column.cdf}'`;
        break;
      case "double":
        str += `'${column.cdf}'`;
        break;
      case "real":
        str += `'${column.cdf}'`;
        break;
      case "bit":
        str += column.cdf ? column.cdf.split('b')[1] : column.cdf;
        break;
      case "boolean":
        str += column.cdf;
        break;
      case "serial":
        str += column.cdf;
        break;
      case "date":
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case "datetime":
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case "timestamp":
        str += `sequelize.literal('${column.cdf_sequelize}')`;
        break;
      case "time":
        str += `'${column.cdf}'`;
        break;
      case "year":
        str += `'${column.cdf}'`;
        break;
      case "char":
        str += `'${column.cdf}'`;
        break;
      case "varchar":
        str += `'${column.cdf}'`;
        break;
      case "nchar":
        str += `'${column.cdf}'`;
        break;
      case "text":
        str += column.cdf;
        break;
      case "tinytext":
        str += column.cdf;
        break;
      case "mediumtext":
        str += column.cdf;
        break;
      case "longtext":
        str += column.cdf;
        break;
      case "binary":
        str += column.cdf;
        break;
      case "varbinary":
        str += column.cdf;
        break;
      case "blob":
        str += column.cdf;
        break;
      case "tinyblob":
        str += column.cdf;
        break;
      case "mediumblob":
        str += column.cdf;
        break;
      case "longblob":
        str += column.cdf;
        break;
      case "enum":
        str += `'${column.cdf}'`;
        break;
      case "set":
        str += `'${column.cdf}'`;
        break;
      case "geometry":
        str += `'${column.cdf}'`;
        break;
      case "point":
        str += `'${column.cdf}'`;
        break;
      case "linestring":
        str += `'${column.cdf}'`;
        break;
      case "polygon":
        str += `'${column.cdf}'`;
        break;
      case "multipoint":
        str += `'${column.cdf}'`;
        break;
      case "multilinestring":
        str += `'${column.cdf}'`;
        break;
      case "multipolygon":
        str += `'${column.cdf}'`;
        break;
      case "json":
        str += column.cdf;
        break;
    }
    return str;
  }


}


export default MssqlXcRender;
