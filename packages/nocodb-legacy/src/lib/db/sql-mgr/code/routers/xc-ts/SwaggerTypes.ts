class SwaggerTypes {
  static setSwaggerType(column, field, dbType = 'mysql') {
    switch (dbType) {
      case 'mysql':
      case 'mysql2':
      case 'mariadb':
        SwaggerTypes.setSwaggerTypeForMysql(column, field);
        break;
      case 'pg':
        SwaggerTypes.setSwaggerTypeForPg(column, field);
        break;
      case 'mssql':
        SwaggerTypes.setSwaggerTypeForMssql(column, field);
        break;
      case 'sqlite3':
        SwaggerTypes.setSwaggerTypeForSqlite(column, field);
        break;
    }
  }

  static setSwaggerTypeForMysql(column, field) {
    switch (column.dt) {
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
        field.type = 'integer';
        break;
      case 'float':
      case 'decimal':
      case 'real':
        field.type = 'number';
        break;
      case 'double':
        field.type = 'number';
        field.format = 'double';
        break;
      case 'bit':
        field.type = 'integer';
        break;
      case 'boolean':
        field.type = 'boolean';
        break;
      case 'serial':
        field.type = 'string';
        break;
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'time':
      case 'year':
      case 'char':
      case 'varchar':
      case 'nchar':
      case 'text':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
      case 'varbinary':
      case 'blob':
      case 'tinyblob':
      case 'mediumblob':
      case 'longblob':
      case 'enum':
      case 'set':
      case 'geometry':
      case 'point':
      case 'linestring':
      case 'polygon':
      case 'multipoint':
      case 'multilinestring':
      case 'multipolygon':
        field.type = 'string';
        break;
      case 'binary':
        field.type = 'string';
        field.format = 'binary';
        break;
      case 'json':
        field.type = 'object';
        break;
      default:
        field.type = 'string';
        break;
    }
  }

  static setSwaggerTypeForPg(column, field) {
    switch (column.dt) {
      case 'int':
      case 'integer':
      case 'bigint':
      case 'bigserial':
      case 'int2':
      case 'int4':
      case 'int8':
      case 'int4range':
      case 'int8range':
      case 'serial':
      case 'serial2':
      case 'serial8':
      case 'smallint':
      case 'smallserial':
        field.type = 'integer';
        break;
      case 'char':
      case 'character':
      case 'bit':
      case 'date':
      case 'character varying':
      case 'text':
      case 'time':
      case 'time without time zone':
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timetz':
      case 'time with time zone':
      case 'daterange':
        field.type = 'string';
        break;

      case 'bool':
      case 'boolean':
        field.type = 'boolean';
        break;
      case 'double precision':
        field.type = 'number';
        field.format = 'double';
        break;

      case 'event_trigger':
      case 'fdw_handler':
      case 'float4':
      case 'float8':
      case 'real':
      case 'numeric':
        field.type = 'number';
        field.format = 'float';
        break;

      case 'uuid':
        field.type = 'string';
        field.format = 'uuid';
        break;

      case 'json':
      case 'jsonb':
        field.type = 'object';
        break;
      case 'gtsvector':
      case 'index_am_handler':
      case 'anyenum':
      case 'anynonarray':
      case 'anyrange':
      case 'box':
      case 'bpchar':
      case 'bytea':
      case 'cid':
      case 'cidr':
      case 'circle':
      case 'cstring':
      case 'inet':
      case 'internal':
      case 'interval':
      case 'language_handler':
      case 'line':
      case 'lsec':
      case 'macaddr':
      case 'money':
      case 'name':
      case 'numrange':
      case 'oid':
      case 'opaque':
      case 'path':
      case 'pg_ddl_command':
      case 'pg_lsn':
      case 'pg_node_tree':
      case 'point':
      case 'polygon':
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
      case 'smgr':
      case 'tid':
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
        field.type = 'string';
        break;
      default:
        field.type = 'string';
        break;
    }
  }

  static setSwaggerTypeForMssql(column, field) {
    switch (column.dt) {
      case 'bigint':
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'bit':
        field.type = 'integer';
        break;
      case 'binary':
        field.type = 'string';
        field.format = 'binary';
        break;
      case 'char':
      case 'date':
      case 'datetime':
      case 'datetime2':
      case 'datetimeoffset':
      case 'geography':
      case 'geometry':
      case 'heirarchyid':
      case 'image':
      case 'money':
      case 'nchar':
      case 'ntext':
      case 'nvarchar':
      case 'smalldatetime':
      case 'smallmoney':
      case 'sql_variant':
      case 'sysname':
      case 'text':
      case 'time':
      case 'timestamp':
      case 'uniqueidentifier':
      case 'varbinary':
      case 'xml':
      case 'varchar':
        field.type = 'string';
        break;

      case 'decimal':
      case 'float':
      case 'numeric':
      case 'real':
        field.type = 'number';
        field.format = 'float';
        break;

      case 'json':
        field.type = 'object';
        break;

      default:
        field.type = 'string';
        break;
    }
  }

  static setSwaggerTypeForSqlite(column, field) {
    switch (column.dt) {
      case 'int':
      case 'integer':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'int2':
      case 'int8':
        field.type = 'integer';
        break;
      case 'character':
      case 'numeric':
      case 'real':
      case 'float':
        field.type = 'number';
        break;
      case 'double':
      case 'double precision':
        field.type = 'number';
        field.format = 'double';
        break;
      case 'boolean':
        field.type = 'boolean';
        break;
      case 'date':
      case 'datetime':
      case 'text':
      case 'blob':
      case 'blob sub_type text':
      case 'varchar':
      case 'timestamp':
        field.type = 'string';
        break;
      default:
        field.type = 'string';
        break;
    }
  }
}

export default SwaggerTypes;
