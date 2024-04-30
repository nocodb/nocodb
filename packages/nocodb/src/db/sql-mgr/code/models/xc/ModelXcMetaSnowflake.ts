import BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaSnowflake extends BaseModelXcMeta {
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
      case 'int':
        str = 'integer';
        break;
      case 'integer':
        str = 'integer';
        break;
      case 'bigint':
        str = 'bigInteger';
        break;
      case 'bigserial':
        str = 'bigserial';
        break;
      case 'char':
        str = 'string';
        break;
      case 'int2':
        str = 'integer';
        break;
      case 'int4':
        str = 'integer';
        break;
      case 'int8':
        str = 'integer';
        break;
      case 'int4range':
        str = 'int4range';
        break;
      case 'int8range':
        str = 'int8range';
        break;
      case 'serial':
        str = 'serial';
        break;
      case 'serial2':
        str = 'serial2';
        break;
      case 'serial8':
        str = 'serial8';
        break;
      case 'character':
        str = 'string';
        break;
      case 'bit':
        str = 'bit';
        break;
      case 'bool':
        str = 'boolean';
        break;
      case 'boolean':
        str = 'boolean';
        break;
      case 'date':
        str = 'date';
        break;
      case 'double precision':
        str = 'double';
        break;
      case 'event_trigger':
        str = 'event_trigger';
        break;
      case 'fdw_handler':
        str = 'fdw_handler';
        break;
      case 'float4':
        str = 'float';
        break;
      case 'float8':
        str = 'float';
        break;
      case 'uuid':
        str = 'uuid';
        break;
      case 'smallint':
        str = 'integer';
        break;
      case 'smallserial':
        str = 'smallserial';
        break;
      case 'character varying':
        str = 'string';
        break;
      case 'text':
        str = 'text';
        break;
      case 'real':
        str = 'float';
        break;
      case 'time':
        str = 'time';
        break;
      case 'time without time zone':
        str = 'time';
        break;
      case 'timestamp':
        str = 'timestamp';
        break;
      case 'timestamp without time zone':
        str = 'timestamp';
        break;
      case 'timestamptz':
        str = 'timestampt';
        break;
      case 'timestamp with time zone':
        str = 'timestamp';
        break;
      case 'timetz':
        str = 'time';
        break;
      case 'time with time zone':
        str = 'time';
        break;
      case 'daterange':
        str = 'daterange';
        break;
      case 'json':
        str = 'json';
        break;
      case 'jsonb':
        str = 'jsonb';
        break;
      case 'gtsvector':
        str = 'gtsvector';
        break;
      case 'index_am_handler':
        str = 'index_am_handler';
        break;
      case 'anyenum':
        str = 'enum';
        break;
      case 'anynonarray':
        str = 'anynonarray';
        break;
      case 'anyrange':
        str = 'anyrange';
        break;
      case 'box':
        str = 'box';
        break;
      case 'bpchar':
        str = 'bpchar';
        break;
      case 'bytea':
        str = 'bytea';
        break;
      case 'cid':
        str = 'cid';
        break;
      case 'cidr':
        str = 'cidr';
        break;
      case 'circle':
        str = 'circle';
        break;
      case 'cstring':
        str = 'cstring';
        break;
      case 'inet':
        str = 'inet';
        break;
      case 'internal':
        str = 'internal';
        break;
      case 'interval':
        str = 'interval';
        break;
      case 'language_handler':
        str = 'language_handler';
        break;
      case 'line':
        str = 'line';
        break;
      case 'lsec':
        str = 'lsec';
        break;
      case 'macaddr':
        str = 'macaddr';
        break;
      case 'money':
        str = 'float';
        break;
      case 'name':
        str = 'name';
        break;
      case 'numeric':
        str = 'numeric';
        break;
      case 'numrange':
        str = 'numrange';
        break;
      case 'oid':
        str = 'oid';
        break;
      case 'opaque':
        str = 'opaque';
        break;
      case 'path':
        str = 'path';
        break;
      case 'pg_ddl_command':
        str = 'pg_ddl_command';
        break;
      case 'pg_lsn':
        str = 'pg_lsn';
        break;
      case 'pg_node_tree':
        str = 'pg_node_tree';
        break;
      case 'point':
        str = 'point';
        break;
      case 'polygon':
        str = 'polygon';
        break;
      case 'record':
        str = 'record';
        break;
      case 'refcursor':
        str = 'refcursor';
        break;
      case 'regclass':
        str = 'regclass';
        break;
      case 'regconfig':
        str = 'regconfig';
        break;
      case 'regdictionary':
        str = 'regdictionary';
        break;
      case 'regnamespace':
        str = 'regnamespace';
        break;
      case 'regoper':
        str = 'regoper';
        break;
      case 'regoperator':
        str = 'regoperator';
        break;
      case 'regproc':
        str = 'regproc';
        break;
      case 'regpreocedure':
        str = 'regpreocedure';
        break;
      case 'regrole':
        str = 'regrole';
        break;
      case 'regtype':
        str = 'regtype';
        break;
      case 'reltime':
        str = 'reltime';
        break;
      case 'smgr':
        str = 'smgr';
        break;
      case 'tid':
        str = 'tid';
        break;
      case 'tinterval':
        str = 'tinterval';
        break;
      case 'trigger':
        str = 'trigger';
        break;
      case 'tsm_handler':
        str = 'tsm_handler';
        break;
      case 'tsquery':
        str = 'tsquery';
        break;
      case 'tsrange':
        str = 'tsrange';
        break;
      case 'tstzrange':
        str = 'tstzrange';
        break;
      case 'tsvector':
        str = 'tsvector';
        break;
      case 'txid_snapshot':
        str = 'txid_snapshot';
        break;
      case 'unknown':
        str = 'unknown';
        break;
      case 'void':
        str = 'void';
        break;
      case 'xid':
        str = 'xid';
        break;
      case 'xml':
        str = 'xml';
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
    const dt = col.dt.toLowerCase();
    switch (dt) {
      case 'anyenum':
        return 'enum';
      case 'anynonarray':
      case 'anyrange':
        return dt;

      case 'bit':
        return 'integer';
      case 'bigint':
      case 'bigserial':
        return 'integer';

      case 'bool':
        return 'boolean';

      case 'bpchar':
      case 'bytea':
        return dt;
      case 'char':
      case 'character':
      case 'character varying':
        return 'string';

      case 'cid':
      case 'cidr':
      case 'cstring':
        return dt;

      case 'date':
        return 'date';
      case 'daterange':
        return 'string';
      case 'double precision':
        return 'string';

      case 'event_trigger':
      case 'fdw_handler':
        return dt;

      case 'float4':
      case 'float8':
        return 'float';

      case 'gtsvector':
      case 'index_am_handler':
      case 'inet':
        return dt;

      case 'int':
      case 'int2':
      case 'int4':
      case 'int8':
      case 'integer':
        return 'integer';
      case 'int4range':
      case 'int8range':
      case 'internal':
      case 'interval':
        return 'string';
      case 'json':
      case 'jsonb':
        return 'json';

      case 'language_handler':
      case 'lsec':
      case 'macaddr':
      case 'money':
      case 'name':
      case 'numeric':
      case 'numrange':
      case 'oid':
      case 'opaque':
      case 'path':
      case 'pg_ddl_command':
      case 'pg_lsn':
      case 'pg_node_tree':
        return dt;
      case 'real':
        return 'float';
      case 'record':
      case 'refcursor':
      case 'regclass':
      case 'regconfig':
      case 'regdictionary':
      case 'regnamespace':
      case 'regoper':
      case 'regoperator':
      case 'regproc':
      case 'regpreocedure':
      case 'regrole':
      case 'regtype':
      case 'reltime':
        return dt;
      case 'serial':
      case 'serial2':
      case 'serial8':
      case 'smallint':
      case 'smallserial':
        return 'integer';
      case 'smgr':
        return dt;
      case 'text':
        if (col.dtxp < 1024) return 'string';
        return 'text';
      case 'tid':
        return dt;
      case 'time':
      case 'time without time zone':
        return 'time';
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'timestamp with time zone':
        return 'datetime';
      case 'timetz':
      case 'time with time zone':
        return 'time';

      case 'tinterval':
      case 'trigger':
      case 'tsm_handler':
      case 'tsquery':
      case 'tsrange':
      case 'tstzrange':
      case 'tsvector':
      case 'txid_snapshot':
      case 'unknown':
      case 'void':
      case 'xid':
      case 'xml':
        return dt;

      case 'tinyint':
      case 'mediumint':
        return 'integer';

      case 'float':
      case 'decimal':
      case 'double':
        return 'float';
      case 'boolean':
        return 'boolean';
      case 'datetime':
        return 'datetime';

      case 'uuid':
      case 'year':
      case 'varchar':
      case 'nchar':
        return 'string';

      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
        return 'text';

      case 'binary':
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

      case 'line':
      case 'point':
      case 'polygon':
      case 'circle':
      case 'box':
      case 'geometry':
      case 'linestring':
      case 'multipoint':
      case 'multilinestring':
      case 'multipolygon':
        return 'geometry';
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

export default ModelXcMetaSnowflake;
