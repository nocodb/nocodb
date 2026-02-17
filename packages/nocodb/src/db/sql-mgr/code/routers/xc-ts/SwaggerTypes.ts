const setNullableSwaggerType = ({
  field,
  type,
  openApiVersion,
}: {
  field: any;
  type: string;
  openApiVersion: '3.1' | '3.0';
}) => {
  if (openApiVersion === '3.0') {
    field.type = type;
    field.nullable = true;
  } else {
    field.type = [type, 'null'];
  }
};

class SwaggerTypes {
  static setSwaggerType(
    openApiVersion: '3.1' | '3.0',
    column,
    field,
    dbType = 'mysql',
  ) {
    switch (dbType) {
      case 'mysql':
      case 'mysql2':
      case 'mariadb':
        SwaggerTypes.setSwaggerTypeForMysql(openApiVersion, column, field);
        break;
      case 'pg':
        SwaggerTypes.setSwaggerTypeForPg(openApiVersion, column, field);
        break;
      case 'sqlite3':
        SwaggerTypes.setSwaggerTypeForSqlite(openApiVersion, column, field);
        break;
    }
  }

  static setSwaggerTypeForMysql(openApiVersion: '3.1' | '3.0', column, field) {
    switch (column.dt) {
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
        setNullableSwaggerType({ field, openApiVersion, type: 'integer' });
        break;
      case 'float':
      case 'decimal':
      case 'real':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        break;
      case 'double':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        field.format = 'double';
        break;
      case 'bit':
        setNullableSwaggerType({ field, openApiVersion, type: 'integer' });
        break;
      case 'boolean':
        setNullableSwaggerType({ field, openApiVersion, type: 'boolean' });
        break;
      case 'serial':
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
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
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
      case 'binary':
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        field.format = 'binary';
        break;
      case 'json':
        setNullableSwaggerType({ field, openApiVersion, type: 'object' });
        break;
      default:
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
    }
  }

  static setSwaggerTypeForPg(openApiVersion: '3.1' | '3.0', column, field) {
    switch (column.dt) {
      case 'decimal':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        break;
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
        setNullableSwaggerType({ field, openApiVersion, type: 'integer' });
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
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;

      case 'bool':
      case 'boolean':
        setNullableSwaggerType({ field, openApiVersion, type: 'boolean' });
        break;
      case 'double precision':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        field.format = 'double';
        break;

      case 'event_trigger':
      case 'fdw_handler':
      case 'float4':
      case 'float8':
      case 'real':
      case 'numeric':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        field.format = 'float';
        break;

      case 'uuid':
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        field.format = 'uuid';
        break;

      case 'json':
      case 'jsonb':
        setNullableSwaggerType({ field, openApiVersion, type: 'object' });
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
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
      default:
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
    }
  }

  static setSwaggerTypeForSqlite(openApiVersion: '3.1' | '3.0', column, field) {
    switch (column.dt) {
      case 'int':
      case 'integer':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'int2':
      case 'int8':
        setNullableSwaggerType({ field, openApiVersion, type: 'integer' });
        break;
      case 'character':
      case 'numeric':
      case 'real':
      case 'float':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        break;
      case 'double':
      case 'double precision':
        setNullableSwaggerType({ field, openApiVersion, type: 'number' });
        field.format = 'double';
        break;
      case 'boolean':
        setNullableSwaggerType({ field, openApiVersion, type: 'boolean' });
        break;
      case 'date':
      case 'datetime':
      case 'text':
      case 'blob':
      case 'blob sub_type text':
      case 'varchar':
      case 'timestamp':
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
      default:
        setNullableSwaggerType({ field, openApiVersion, type: 'string' });
        break;
    }
  }
}

export default SwaggerTypes;
