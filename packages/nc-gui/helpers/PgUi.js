const dbTypes = [
  "int",
  "integer",
  "bigint",
  "bigserial",
  "char",
  "int2",
  "int4",
  "int8",
  "int4range",
  "int8range",
  "serial",
  "serial2",
  "serial8",
  "character",
  "bit",
  "bool",
  "boolean",
  "date",
  "double precision",
  "event_trigger",
  "fdw_handler",
  "float4",
  "float8",
  "uuid",
  "smallint",
  "smallserial",
  "character varying",
  "text",
  "real",
  "time",
  "time without time zone",
  "timestamp",
  "timestamp without time zone",
  "timestamptz",
  "timestamp with time zone",
  "timetz",
  "time with time zone",
  "daterange",
  "json",
  "jsonb",
  "gtsvector",
  "index_am_handler",
  "anyenum",
  "anynonarray",
  "anyrange",
  "box",
  "bpchar",
  "bytea",
  "cid",
  "cidr",
  "circle",
  "cstring",
  "inet",
  "internal",
  "interval",
  "language_handler",
  "line",
  "lsec",
  "macaddr",
  "money",
  "name",
  "numeric",
  "numrange",
  "oid",
  "opaque",
  "path",
  "pg_ddl_command",
  "pg_lsn",
  "pg_node_tree",
  "point",
  "polygon",
  "record",
  "refcursor",
  "regclass",
  "regconfig",
  "regdictionary",
  "regnamespace",
  "regoper",
  "regoperator",
  "regproc",
  "regpreocedure",
  "regrole",
  "regtype",
  "reltime",
  "smgr",
  "tid",
  "tinterval",
  "trigger",
  "tsm_handler",
  "tsquery",
  "tsrange",
  "tstzrange",
  "tsvector",
  "txid_snapshot",
  "unknown",
  "void",
  "xid",
  "xml"]

export class PgUi {

  static getNewTableColumns() {
    return [
      {
        cn: "id",
        dt: "int4",
        dtx: "integer",
        ct: "int(11)",
        nrqd: false,
        rqd: true,
        ck: false,
        pk: true,
        un: false,
        ai: true,
        cdf: null,
        clen: null,
        np: 11,
        ns: 0,
        dtxp: '11',
        dtxs: '',
        altered: 1,
        uidt: "ID",
        uip: "",
        uicn: "",
      },
      {
        cn: "title",
        dt: "character varying",
        dtx: "specificType",
        ct: "varchar(45)",
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: 45,
        np: null,
        ns: null,
        dtxp: '45',
        dtxs: '',
        altered: 1,
        uidt: 'SingleLineText',
        uip: "",
        uicn: "",
      },
      {
        cn: "created_at",
        dt: "timestamp",
        dtx: "specificType",
        ct: "varchar(45)",
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'now()',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'CreateTime',
        uip: "",
        uicn: "",
      },
      {
        cn: "updated_at",
        dt: "timestamp",
        dtx: "specificType",
        ct: "varchar(45)",
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        au: true,
        cdf: 'now()',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'LastModifiedTime',
        uip: "",
        uicn: "",
      }
    ];
  }

  static getNewColumn(suffix) {
    return {
      cn: "title" + suffix,
      dt: "int4",
      dtx: "specificType",
      ct: "integer(11)",
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      //data_type_x_specific: ' ',
      dtxp: '11',
      dtxs: ' ',
      altered: 1,
      uidt: 'Number',
      uip: "",
      uicn: "",
    };
  }


  // static getDefaultLengthForDatatype(type) {
  //   switch (type) {
  //     case "int":
  //       return 11;
  //       break;
  //     case "tinyint":
  //       return 1;
  //       break;
  //     case "smallint":
  //       return 5;
  //       break;
  //
  //     case "mediumint":
  //       return 9;
  //       break;
  //     case "bigint":
  //       return 20;
  //       break;
  //     case "bit":
  //       return 64;
  //       break;
  //     case "boolean":
  //       return '';
  //       break;
  //     case "float":
  //       return 12;
  //       break;
  //     case "decimal":
  //       return 10;
  //       break;
  //     case "double":
  //       return 22;
  //       break;
  //     case "serial":
  //       return 20;
  //       break;
  //     case "date":
  //       return '';
  //       break;
  //     case "datetime":
  //     case "timestamp":
  //       return 6;
  //       break;
  //     case "time":
  //       return '';
  //       break;
  //     case "year":
  //       return '';
  //       break;
  //     case "char":
  //       return 255;
  //       break;
  //     case "varchar":
  //       return 45;
  //       break;
  //     case "nchar":
  //       return 255;
  //       break;
  //     case "text":
  //       return '';
  //       break;
  //     case "tinytext":
  //       return '';
  //       break;
  //     case "mediumtext":
  //       return '';
  //       break;
  //     case "longtext":
  //       return ''
  //       break;
  //     case "binary":
  //       return 255;
  //       break;
  //     case "varbinary":
  //       return 65500;
  //       break;
  //     case "blob":
  //       return '';
  //       break;
  //     case "tinyblob":
  //       return '';
  //       break;
  //     case "mediumblob":
  //       return '';
  //       break;
  //     case "longblob":
  //       return '';
  //       break;
  //     case "enum":
  //       return '\'a\',\'b\'';
  //       break;
  //     case "set":
  //       return '\'a\',\'b\'';
  //       break;
  //     case "geometry":
  //       return '';
  //     case "point":
  //       return '';
  //     case "linestring":
  //       return '';
  //     case "polygon":
  //       return '';
  //     case "multipoint":
  //       return '';
  //     case "multilinestring":
  //       return '';
  //     case "multipolygon":
  //       return '';
  //     case "json":
  //       return ''
  //       break;
  //
  //   }
  //
  // }

  static getDefaultLengthForDatatype(type) {
    switch (type) {
      case "int":
        return '';
        break;
      case "tinyint":
        return '';
        break;
      case "smallint":
        return '';
        break;

      case "mediumint":
        return '';
        break;
      case "bigint":
        return '';
        break;
      case "bit":
        return '';
        break;
      case "boolean":
        return '';
        break;
      case "float":
        return '';
        break;
      case "decimal":
        return '';
        break;
      case "double":
        return '';
        break;
      case "serial":
        return '';
        break;
      case "date":
        return '';
        break;
      case "datetime":
      case "timestamp":
        return '';
        break;
      case "time":
        return '';
        break;
      case "year":
        return '';
        break;
      case "char":
        return '';
        break;
      case "varchar":
        return '';
        break;
      case "nchar":
        return '';
        break;
      case "text":
        return '';
        break;
      case "tinytext":
        return '';
        break;
      case "mediumtext":
        return '';
        break;
      case "longtext":
        return '';
        break;
      case "binary":
        return '';
        break;
      case "varbinary":
        return '';
        break;
      case "blob":
        return '';
        break;
      case "tinyblob":
        return '';
        break;
      case "mediumblob":
        return '';
        break;
      case "longblob":
        return '';
        break;
      case "enum":
        return '';
        break;
      case "set":
        return '';
        break;
      case "geometry":
        return '';
      case "point":
        return '';
      case "linestring":
        return '';
      case "polygon":
        return '';
      case "multipoint":
        return '';
      case "multilinestring":
        return '';
      case "multipolygon":
        return '';
      case "json":
        return '';
        break;

    }

  }


  static getDefaultLengthIsDisabled(type) {
    switch (type) {
      case "anyenum":
      case "anynonarray":
      case "anyrange":
      case "bigint":
      case "bigserial":
      case "bit":
      case "bool":
      case "box":
      case "bpchar":
      case "bytea":
      case "char":
      case "character":
      case "cid":
      case "cidr":
      case "circle":
      case "cstring":
      case "date":
      case "daterange":
      case "double precision":
      case "event_trigger":
      case "fdw_handler":
      case "float4":
      case "float8":
      case "gtsvector":
      case "index_am_handler":
      case "inet":
      case "int":
      case "int2":
      case "int4":
      case "int8":
      case "int4range":
      case "int8range":
      case "integer":
      case "internal":
      case "interval":
      case "json":
      case "jsonb":
      case "language_handler":
      case "line":
      case "lsec":
      case "macaddr":
      case "money":
      case "name":
      case "numeric":
      case "numrange":
      case "oid":
      case "opaque":
      case "path":
      case "pg_ddl_command":
      case "pg_lsn":
      case "pg_node_tree":
      case "point":
      case "polygon":
      case "real":
      case "record":
      case "refcursor":
      case "regclass":
      case "regconfig":
      case "regdictionary":
      case "regnamespace":
      case "regoper":
      case "regoperator":
      case "regproc":
      case "regpreocedure":
      case "regrole":
      case "regtype":
      case "reltime":
      case "serial":
      case "serial2":
      case "serial8":
      case "smallint":
      case "smallserial":
      case "smgr":
      case "text":
      case "tid":
      case "time":
      case "time without time zone":
      case "timestamp":
      case "timestamp without time zone":
      case "timestamptz":
      case "timestamp with time zone":
      case "timetz":
      case "time with time zone":
      case "tinterval":
      case "trigger":
      case "tsm_handler":
      case "tsquery":
      case "tsrange":
      case "tstzrange":
      case "tsvector":
      case "txid_snapshot":
      case "unknown":
      case "void":
      case "xid":
      case "xml":
      case "integer":
      case "character varying":
      case "int2":
      case "int4":
      case "int8":
      case "float4":
      case "float8":
      case "interval":
      case "json":
      case "jsonb":
      case "jsonb":
      case "int":
      case "tinyint":
      case "smallint":
      case "mediumint":
      case "bigint":
      case "float":
      case "decimal":
      case "double":
      case "real":
      case "bit":
      case "boolean":
      case "serial":
      case "date":
      case "datetime":
      case "timestamp":
      case "timestamptz":
      case "timetz":
      case "time":
      case "uuid":
      case "year":
      case "char":
      case "varchar":
      case "nchar":
      case "text":
      case "tinytext":
      case "mediumtext":
      case "longtext":
      case "binary":
      case "varbinary":
      case "blob":
      case "tinyblob":
      case "mediumblob":
      case "longblob":
      case "enum":
      case "set":
      case "time":
      case "geometry":
      case "point":
      case "linestring":
      case "polygon":
      case "multipoint":
      case "multilinestring":
      case "multipolygon":
      case  "json":
        return true;
        break;
    }

  }


  static getDefaultValueForDatatype(type) {
    switch (type) {
      case "anyenum":
        return "eg: ";
        break;
      case "anynonarray":
        return "eg: ";
        break;
      case "anyrange":
        return "eg: ";
        break;
      case "bigint":
        return "eg: ";
        break;
      case "bigserial":
        return "eg: ";
        break;
      case "bit":
        return "eg: ";
        break;
      case "bool":
        return "eg: ";
        break;
      case "box":
        return "eg: ";
        break;
      case "bpchar":
        return "eg: ";
        break;
      case "bytea":
        return "eg: ";
        break;
      case "char":
        return "eg: ";
        break;
      case "character":
        return "eg: 'sample'";
        break;
      case "cid":
        return "eg: ";
        break;
      case "cidr":
        return "eg: ";
        break;
      case "circle":
        return "eg: ";
        break;
      case "cstring":
        return "eg: ";
        break;
      case "date":
        return "eg: '2020-09-09'";
        break;
      case "daterange":
        return "eg: ";
        break;
      case "double precision":
        return "eg: 1.2";
        break;
      case "event_trigger":
        return "eg: ";
        break;
      case "fdw_handler":
        return "eg: ";
        break;
      case "float4":
        return "eg: 1.2";
        break;
      case "float8":
        return "eg: 1.2";
        break;
      case "gtsvector":
        return "eg: ";
        break;
      case "index_am_handler":
        return "eg: ";
        break;
      case "inet":
        return "eg: ";
        break;
      case "int":
        return "eg: ";
        break;
      case "int2":
        return "eg: ";
        break;
      case "int4":
        return "eg: ";
        break;
      case "int8":
        return "eg: ";
        break;
      case "int4range":
        return "eg: ";
        break;
      case "int8range":
        return "eg: ";
        break;
      case "integer":
        return "eg: ";
        break;
      case "internal":
        return "eg: ";
        break;
      case "interval":
        return "eg: ";
        break;
      case "json":
        return "eg: ";
        break;
      case "jsonb":
        return "eg: ";
        break;
      case "language_handler":
        return "eg: ";
        break;
      case "line":
        return "eg: ";
        break;
      case "lsec":
        return "eg: ";
        break;
      case "macaddr":
        return "eg: ";
        break;
      case "money":
        return "eg: ";
        break;
      case "name":
        return "eg: ";
        break;
      case "numeric":
        return "eg: ";
        break;
      case "numrange":
        return "eg: ";
        break;
      case "oid":
        return "eg: ";
        break;
      case "opaque":
        return "eg: ";
        break;
      case "path":
        return "eg: ";
        break;
      case "pg_ddl_command":
        return "eg: ";
        break;
      case "pg_lsn":
        return "eg: ";
        break;
      case "pg_node_tree":
        return "eg: ";
        break;
      case "point":
        return "eg: ";
        break;
      case "polygon":
        return "eg: ";
        break;
      case "real":
        return "eg: 1.2";
        break;
      case "record":
        return "eg: ";
        break;
      case "refcursor":
        return "eg: ";
        break;
      case "regclass":
        return "eg: ";
        break;
      case "regconfig":
        return "eg: ";
        break;
      case "regdictionary":
        return "eg: ";
        break;
      case "regnamespace":
        return "eg: ";
        break;
      case "regoper":
        return "eg: ";
        break;
      case "regoperator":
        return "eg: ";
        break;
      case "regproc":
        return "eg: ";
        break;
      case "regpreocedure":
        return "eg: ";
        break;
      case "regrole":
        return "eg: ";
        break;
      case "regtype":
        return "eg: ";
        break;
      case "reltime":
        return "eg: ";
        break;
      case "serial":
        return "eg: ";
        break;
      case "serial2":
        return "eg: ";
        break;
      case "serial8":
        return "eg: ";
        break;
      case "smallint":
        return "eg: ";
        break;
      case "smallserial":
        return "eg: ";
        break;
      case "smgr":
        return "eg: ";
        break;
      case "text":
        return "eg: 'sample text'";
        break;
      case "tid":
        return "eg: ";
        break;
      case "time":
        return "eg: now()\n\n'04:05:06.789'";
        break;
      case "time without time zone":
        return "eg: now()\n\n'04:05:06.789'";
        break;
      case "timestamp":
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";
        break;
      case "timestamp without time zone":
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";
        break;
      case "timestamptz":
        return "eg: timezone('America/New_York','2016-06-01 00:00')\n\nnow()\n\n'2016-06-22 19:10:25-07'";
        break;
      case "timestamp with time zone":
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";
        break;
      case "timetz":
        return "eg: now()";
        break;
      case "time with time zone":
        return "eg: now()";
        break;
      case "tinterval":
        return "eg: ";
        break;
      case "trigger":
        return "eg: ";
        break;
      case "tsm_handler":
        return "eg: ";
        break;
      case "tsquery":
        return "eg: ";
        break;
      case "tsrange":
        return "eg: ";
        break;
      case "tstzrange":
        return "eg: ";
        break;
      case "tsvector":
        return "eg: ";
        break;
      case "txid_snapshot":
        return "eg: ";
        break;
      case "unknown":
        return "eg: ";
        break;
      case "void":
        return "eg: ";
        break;
      case "xid":
        return "eg: ";
        break;
      case "xml":
        return "eg: ";
        break;
      case "integer":
        return "eg: ";
        break;
      case "character varying":
        return "eg: ";
        break;
      case "int2":
        return "eg: ";
        break;
      case "int4":
        return "eg: ";
        break;
      case "int8":
        return "eg: ";
        break;
      case "float4":
        return "eg: ";
        break;
      case "float8":
        return "eg: ";
        break;
      case "interval":
        return "eg: ";
        break;
      case "json":
        return "eg: ";
        break;
      case "jsonb":
        return "eg: ";
        break;
      case "jsonb":
        return "eg: ";
        break;
      case "int":
        return "eg: ";
        break;
      case "tinyint":
        return "eg: ";
        break;
      case "smallint":
        return "eg: ";
        break;
      case "mediumint":
        return "eg: ";
        break;
      case "bigint":
        return "eg: ";
        break;
      case "float":
        return "eg: ";
        break;
      case "decimal":
        return "eg: ";
        break;
      case "double":
        return "eg: 1.2";
        break;
      case "real":
        return "eg: ";
        break;
      case "bit":
        return "eg: ";
        break;
      case "boolean":
        return "eg: true\n\nfalse";
        break;
      case "serial":
        return "eg: ";
        break;
      case "date":
        return "eg: ";
        break;
      case "datetime":
        return "eg: ";
        break;
      case "timestamp":
        return "eg: ";
        break;
      case "timestamptz":
        return "eg: ";
        break;
      case "timetz":
        return "eg: ";
        break;
      case "time":
        return "eg: ";
        break;
      case "uuid":
        return "eg: ";
        break;
      case "year":
        return "eg: ";
        break;
      case "char":
        return "eg: 'sample'";
        break;
      case "varchar":
        return "eg: ";
        break;
      case "nchar":
        return "eg: ";
        break;
      case "text":
        return "eg: ";
        break;
      case "tinytext":
        return "eg: ";
        break;
      case "mediumtext":
        return "eg: ";
        break;
      case "longtext":
        return "eg: ";
        break;
      case "binary":
        return "eg: ";
        break;
      case "varbinary":
        return "eg: ";
        break;
      case "blob":
        return "eg: ";
        break;
      case "tinyblob":
        return "eg: ";
        break;
      case "mediumblob":
        return "eg: ";
        break;
      case "longblob":
        return "eg: ";
        break;
      case "enum":
        return "eg: ";
        break;
      case "set":
        return "eg: ";
        break;
      case "time":
        return "eg: ";
        break;
      case "geometry":
        return "eg: ";
        break;
      case "point":
        return "eg: ";
        break;
      case "linestring":
        return "eg: ";
        break;
      case "polygon":
        return "eg: ";
        break;
      case "multipoint":
        return "eg: ";
        break;
      case "multilinestring":
        return "eg: ";
        break;
      case "multipolygon":
        return "eg: ";
        break;
      case "json":
        return "eg: ";
        break;

    }
  }


  static getDefaultScaleForDatatype(type) {
    switch (type) {
      case "int":
        return ' '
        break;
      case "tinyint":
        return ' '
        break;
      case "smallint":
        return ' '
        break;

      case "mediumint":
        return ' '
        break;
      case "bigint":
        return ' '
        break;
      case "bit":
        return ' '
        break;
      case "boolean":
        return ' '
        break;
      case "float":
        return '2'
        break;
      case "decimal":
        return '2'
        break;
      case "double":
        return '2'
        break;
      case "serial":
        return ' '
        break;
      case "date":
      case "datetime":
      case "timestamp":
        return ' '
        break;
      case "time":
        return ' '
        break;
      case "year":
        return ' '
        break;
      case "char":
        return ' '
        break;
      case "varchar":
        return ' '
        break;
      case "nchar":
        return ' '
        break;
      case "text":
        return ' '
        break;
      case "tinytext":
        return ' '
        break;
      case "mediumtext":
        return ' '
        break;
      case "longtext":
        return ' '
        break;
      case "binary":
        return ' '
        break;
      case "varbinary":
        return ' '
        break;
      case "blob":
        return ' '
        break;
      case "tinyblob":
        return ' '
        break;
      case "mediumblob":
        return ' '
        break;
      case "longblob":
        return ' '
        break;
      case "enum":
        return ' '
        break;
      case "set":
        return ' '
        break;
      case "geometry":
        return ' '
      case "point":
        return ' '
      case "linestring":
        return ' '
      case "polygon":
        return ' '
      case "multipoint":
        return ' '
      case "multilinestring":
        return ' '
      case "multipolygon":
        return ' '
      case "json":
        return ' '
        break;

    }

  }

  static colPropAIDisabled(col, columns) {
    //console.log(col);
    if (col.dt === 'int4' ||
      col.dt === 'integer' ||
      col.dt === 'bigint' ||
      col.dt === 'smallint') {
      for (var i = 0; i < columns.length; ++i) {
        if (columns[i].cn !== col.cn && columns[i].ai) {
          return true;
        }
      }
      return false;
    } else {
      return true;
    }
  }

  static colPropUNDisabled(col) {
    //console.log(col);
    return true;
    // if (col.dt === 'int' ||
    //   col.dt === 'tinyint' ||
    //   col.dt === 'smallint' ||
    //   col.dt === 'mediumint' ||
    //   col.dt === 'bigint') {
    //   return false;
    // } else {
    //   return true;
    // }
  }

  static onCheckboxChangeAI(col) {
    console.log(col);
    if (col.dt === 'int' || col.dt === 'bigint' || col.dt === 'smallint' || col.dt === 'tinyint') {
      col.altered = col.altered || 2;
    }

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static onCheckboxChangeAU(col) {
    console.log(col);
    if (1) {
      col.altered = col.altered || 2;
    }
    if (col.au) {
      col.cdf = 'now()';
    }

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static showScale(columnObj) {
    return false;
  }


  static removeUnsigned(columns) {

    for (var i = 0; i < columns.length; ++i) {
      if (columns[i].altered === 1 && (!(columns[i].dt === 'int'
        || columns[i].dt === 'bigint'
        || columns[i].dt === 'tinyint'
        || columns[i].dt === 'smallint'
        || columns[i].dt === 'mediumint'))) {
        columns[i].un = false;
        console.log('>> resetting unsigned value', columns[i].cn);
      }
      console.log(columns[i].cn);
    }

  }

  static columnEditable(colObj) {
    return colObj.tn !== '_evolutions' || colObj.tn !== 'nc_evolutions';
  }


  static extractFunctionName(query) {
    const reg = /^\s*CREATE\s+(?:OR\s+REPLACE\s*)?\s*FUNCTION\s+(?:[\w\d_]+\.)?([\w_\d]+)/i;
    const match = query.match(reg);
    return match && match[1];
  }


  static extractProcedureName(query) {
    const reg = /^\s*CREATE\s+(?:OR\s+REPLACE\s*)?\s*PROCEDURE\s+(?:[\w\d_]+\.)?([\w_\d]+)/i;
    const match = query.match(reg);
    return match && match[1];
  }

  static handleRawOutput(result, headers) {
    if (['DELETE', 'INSERT', 'UPDATE'].includes(result.command.toUpperCase())) {
      headers.push({text: 'Row count', value: 'rowCount', sortable: false})
      result = [{
        rowCount: result.rowCount
      }];
    } else {
      result = result.rows;
      if (Array.isArray(result) && result[0]) {
        const keys = Object.keys(result[0]);
        //set headers before settings result
        for (let i = 0; i < keys.length; i++) {
          const text = keys[i];
          headers.push({text, value: text, sortable: false});
        }
      }
    }
    return result;
  }

  static splitQueries(query) {
    /***
     * we are splitting based on semicolon
     * there are mechanism to escape semicolon within single/double quotes(string)
     */
    return query.match(/\b("[^"]*;[^"]*"|'[^']*;[^']*'|[^;])*;/g);
  }

  /**
   * if sql statement is SELECT - it limits to a number
   * @param args
   * @returns {string|*}
   */
  sanitiseQuery(args) {

    let q = args.query.trim().split(';');

    if (q[0].startsWith('Select')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`
    } else if (q[0].startsWith('select')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`
    } else if (q[0].startsWith('SELECT')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`
    } else {
      return args.query;
    }

    return q;

  }

  static getColumnsFromJson(json, tn) {

    const columns = [];

    try {
      if (typeof json === 'object' && !Array.isArray(json)) {

        let keys = Object.keys(json);
        for (let i = 0; i < keys.length; ++i) {
          const column = {
            "dp": null,
            "tn": tn,
            "cn": keys[i],
            "cno": keys[i],
            "np": 10,
            "ns": 0,
            "clen": null,
            "cop": 1,
            "pk": false,
            "nrqd": false,
            "rqd": false,
            "un": false,
            "ct": "int(11) unsigned",
            "ai": false,
            "unique": false,
            "cdf": null,
            "cc": "",
            "csn": null,
            "dtx": "specificType",
            "dtxp": null,
            "dtxs": 0,
            altered: 1
          };

          switch (typeof json[keys[i]]) {

            case 'number':
              if (Number.isInteger(json[keys[i]])) {
                if (PgUi.isValidTimestamp(keys[i], json[keys[i]])) {
                  Object.assign(column, {
                    "dt": "timestamp"
                  });
                } else {
                  Object.assign(column, {
                    "dt": "int",
                    "np": 10,
                    "ns": 0,
                  });
                }
              } else {
                Object.assign(column, {
                  "dt": "float4",
                  "np": null,
                  "ns": null,
                  "dtxp": null,
                  "dtxs": null,
                });
              }
              break;
            case 'string':
              if (PgUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  "dt": "date"
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  "dt": "character varying",
                  "np": null,
                  "ns": 0,
                  "dtxp": null,
                });
              } else {
                Object.assign(column, {
                  "dt": "text"
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                "dt": "boolean",
                "np": 3,
                "ns": 0,
              });
              break;
            case 'object':
              Object.assign(column, {
                "dt": "json",
                "np": 3,
                "ns": 0,
              });
              break;
            default:
              break;
          }
          columns.push(column)
        }

      }
    } catch (e) {
      console.log('Error in getColumnsFromJson', e);
    } finally {
    }

    return columns;
  }

  static isValidTimestamp(key, value) {
    if (typeof value !== 'number') return false;
    return new Date(value).getTime() > 0 && /(?:_|(?=A))[aA]t$/.test(key);
  }

  static isValidDate(value) {
    return new Date(value).getTime() > 0;
  }


  static colPropAuDisabled(col) {

    if (col.altered !== 1) return true;


    switch (col.dt) {
      case "time":
      case "time without time zone":
      case "timestamp":
      case "timestamp without time zone":
      case "timestamptz":
      case "timestamp with time zone":
      case "timetz":
      case "time with time zone":
        return false;
        break;
      default:
        return true;
    }
  }


  static getAbstractType(col) {
    switch ((col.dt || col.dt).toLowerCase()) {
      case "anyenum":
        return 'enum';
      case "anynonarray":
      case "anyrange":
        return 'string';

      case "bit":
        return 'integer';
      case "bigint":
      case "bigserial":
        return 'string';

      case "bool":
        return 'boolean';

      case "box":
      case "bpchar":
      case "bytea":
      case "char":
      case "character":
        return 'string';

      case "cid":
      case "cidr":
      case "circle":
      case "cstring":
        return 'string'

      case "date":
        return 'date'
      case "daterange":
        return 'string'
      case "double precision":
        return 'string';

      case "event_trigger":
      case "fdw_handler":
        return 'string';

      case "float4":
      case "float8":
        return 'float';

      case "gtsvector":
      case "index_am_handler":
      case "inet":
        return 'string';

      case "int":
      case "int2":
      case "int4":
      case "int8":
      case "integer":
        return 'integer'
      case "int4range":
      case "int8range":
      case "internal":
      case "interval":
        return 'string'
      case "json":
        return 'json'
      case "jsonb":
        return 'string';

      case "language_handler":
      case "line":
      case "lsec":
      case "macaddr":
      case "money":
      case "name":
      case "numeric":
      case "numrange":
      case "oid":
      case "opaque":
      case "path":
      case "pg_ddl_command":
      case "pg_lsn":
      case "pg_node_tree":
      case "point":
      case "polygon":
        return 'string';
      case "real":
        return 'float';
      case "record":
      case "refcursor":
      case "regclass":
      case "regconfig":
      case "regdictionary":
      case "regnamespace":
      case "regoper":
      case "regoperator":
      case "regproc":
      case "regpreocedure":
      case "regrole":
      case "regtype":
      case "reltime":
        return 'string'
      case "serial":
      case "serial2":
      case "serial8":
      case "smallint":
      case "smallserial":
        return 'integer'
      case "smgr":
        return 'string'
      case "text":
        return 'text'
      case "tid":
        return 'string'
      case "time":
      case "time without time zone":
        return 'time'
      case "timestamp":
      case "timestamp without time zone":
      case "timestamptz":
      case "timestamp with time zone":
        return 'datetime'
      case "timetz":
      case "time with time zone":
        return 'time'

      case "tinterval":
      case "trigger":
      case "tsm_handler":
      case "tsquery":
      case "tsrange":
      case "tstzrange":
      case "tsvector":
      case "txid_snapshot":
      case "unknown":
      case "void":
      case "xid":
      case "character varying":
      case "xml":
        return 'string'

      case "tinyint":
      case "mediumint":
        return 'integer'

      case "float":
      case "decimal":
      case "double":
        return 'float'
      case "boolean":
        return 'boolean'
      case "datetime":
        return 'datetime'

      case "uuid":
      case "year":
      case "varchar":
      case "nchar":
        return 'string'
      case "tinytext":
      case "mediumtext":
      case "longtext":
        return 'text'
      case "binary":
      case "varbinary":
        return 'string'
      case "blob":
      case "tinyblob":
      case "mediumblob":
      case "longblob":
        return 'blob'
      case "enum":
        return 'enum'
      case "set":
        return 'set'
      case "geometry":
      case "linestring":
      case "multipoint":
      case "multilinestring":
      case "multipolygon":
        return 'string'
      case  "json":
        return 'json'
    }
  }

  static getUIType(col) {
    switch (this.getAbstractType(col)) {
      case 'integer':
        return 'Number';
      case "boolean":
        return 'Checkbox';
      case  'float':
        return 'Decimal';
      case "date":
        return 'Date';
      case "datetime":
        return 'CreateTime';
      case "time":
        return 'Time';
      case 'year':
        return 'Year';
      case   'string':
        return 'SingleLineText';
      case "text":
        return 'LongText';
      case 'blob':
        return 'Attachment'
      case "enum":
        return 'SingleSelect';
      case "set":
        return 'MultiSelect';
      case "json":
        return 'LongText';
    }

  }


  static getDataTypeForUiType(col) {
    const colProp = {}
    switch (col.uidt) {
      case 'ID':
        colProp.dt = 'int4';
        colProp.pk = true;
        colProp.un = true;
        colProp.ai = true;
        colProp.rqd = true;
        break;
      case 'ForeignKey':
        colProp.dt = 'character varying';
        break;
      case 'SingleLineText':
        colProp.dt = 'character varying';
        break;
      case 'LongText':
        colProp.dt = 'text';
        break;
      case 'Attachment':
        colProp.dt = 'text';
        break;
      case 'Checkbox':
        colProp.dt = 'bool';
        break;
      case 'MultiSelect':
        colProp.dt = 'set';
        break;
      case 'SingleSelect':
        colProp.dt = 'enum';
        break;
      case 'Collaborator':
        colProp.dt = 'character varying';
        break;
      case 'Date':
        colProp.dt = 'character varying';

        break;
      case 'Year':
        colProp.dt = 'year';
        break;
      case 'Time':
        colProp.dt = 'time';
        break;
      case 'PhoneNumber':
        colProp.dt = 'character varying';
        colProp.validate = {"func": ["isMobilePhone"], "args": [""], "msg": ["Validation failed : isMobilePhone"]}
        break;
      case 'Email':
        colProp.dt = 'character varying';
        colProp.validate = {"func": ["isEmail"], "args": [""], "msg": ["Validation failed : isEmail"]}
        break;
      case 'URL':
        colProp.dt = 'character varying';
        colProp.validate = {"func": ["isURL"], "args": [""], "msg": ["Validation failed : isURL"]}
        break;
      case 'Number':
        colProp.dt = 'int8';
        break;
      case 'Decimal':
        colProp.dt = 'decimal';
        break;
      case 'Currency':
        colProp.dt = 'decimal';
        colProp.validate = {"func": ["isCurrency"], "args": [""], "msg": ["Validation failed : isCurrency"]}
        break;
      case 'Percent':
        colProp.dt = 'double';
        break;
      case 'Duration':
        colProp.dt = 'int8';
        break;
      case 'Rating':
        colProp.dt = 'float8';
        break;
      case 'Formula':
        colProp.dt = 'character varying';
        break;
      case 'Rollup':
        colProp.dt = 'character varying';
        break;
      case 'Count':
        colProp.dt = 'int8';
        break;
      case 'Lookup':
        colProp.dt = 'character varying';
        break;
      case 'DateTime':
        colProp.dt = 'datetime';
        break;
      case 'CreateTime':
        colProp.dt = 'datetime';
        break;
      case 'LastModifiedTime':
        colProp.dt = 'datetime';
        break;
      case 'AutoNumber':
        colProp.dt = 'int';
        break;
      case 'Barcode':
        colProp.dt = 'character varying';
        break;
      case 'Button':
        colProp.dt = 'character varying';
        break;
      default:
        colProp.dt = 'character varying';
        break;
    }
    return colProp
  }


  static getDataTypeListForUiType(col) {
    switch (col.uidt) {
      case 'ID':
      case 'ForeignKey':
        return dbTypes;
        break;
      case 'SingleLineText':
      case 'LongText':
      case 'Attachment':
      case 'Collaborator':
        return [
          "char",
          "character",
          "character varying",
          "text",
        ];
        break;
      case 'Checkbox':
        return [
          "bit",
          "bool",
          "int2",
          "int4",
          "int8",
          "boolean",
          "smallint",
          "int",
          "integer",
          "bigint",
          "bigserial",
          "char",
          "int4range",
          "int8range",
          "serial",
          "serial2",
          "serial8",
        ]
        break;
      case 'MultiSelect':
        return [
          'set', "text",
        ];
        break;
      case 'SingleSelect':
        return [
          'anyenum',
          "text",
        ];
        break;
      case 'Year':
        return ['int'];
        break;
      case 'Time':
        return ["time",
          "time without time zone",
          "timestamp",
          "timestamp without time zone",
          "timestamptz",
          "timestamp with time zone",
          "timetz",
          "time with time zone",];
        break;
      case 'PhoneNumber':
      case 'Email':
        return [
          "character varying",
        ];
        break;
      case 'URL':
        return [
          "character varying",
          "text",
        ];
        break;
      case 'Number':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "double precision",
          "float4",
          "float8",
          "smallint",
          "smallserial",
        ]
        break;
      case 'Decimal':
        return [
          "double precision",
          "float4",
          "float8",
        ]
        break;
      case 'Currency':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "double precision",
          "money", "float4",
          "float8",];
        break;
      case 'Percent':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "double precision",
          "float4",
          "float8",
          "smallint",
          "smallserial",
        ]
        break;
      case 'Duration':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "double precision",
          "float4",
          "float8",
          "smallint",
          "smallserial",]
        break;
      case 'Rating':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "double precision",
          "float4",
          "float8",
          "smallint",
          "smallserial",]
        break;
      case 'Formula':
        return [
          "text",
          "character varying",
        ];
        break;
      case 'Rollup':
        return [
          "character varying",
        ];
        break;
      case 'Count':
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "smallint",
          "smallserial",
        ];
        break;
      case 'Lookup':
        return [
          "character varying",
        ];
        break;
      case 'Date':
        return [
          "date",
          "timestamp",
          "timestamp without time zone",
          "timestamptz",
          "timestamp with time zone",
        ];
        break;
      case 'DateTime':
      case 'CreateTime':
      case 'LastModifiedTime':
        return [
          "timestamp",
          "timestamp without time zone",
          "timestamptz",
          "timestamp with time zone",
        ];
        break;
      case 'AutoNumber':
        return
        return [
          "int",
          "integer",
          "bigint",
          "bigserial",
          "int2",
          "int4",
          "int8",
          "serial",
          "serial2",
          "serial8",
          "smallint",
          "smallserial",
        ];
        break;
      case 'Barcode':
        return ['character varying'];
        break;
      case 'Geometry':
        return [
          "polygon",
          "point",
          "circle",
          "box",
          "line",
          'lseg',
          'path',
          'circle'
        ];
        break;
      case 'Button':
      default:
        return dbTypes;
        break;
    }
  }


}


// module.exports = PgUiHelp;
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
