import UITypes from '../UITypes';
import { IDType } from './index';
import { ColumnType } from '~/lib';

const dbTypes = [
  'int',
  'integer',
  'bigint',
  'bigserial',
  'char',
  'int2',
  'int4',
  'int8',
  'int4range',
  'int8range',
  'serial',
  'serial2',
  'serial8',
  'character',
  'bit',
  'bool',
  'boolean',
  'date',
  'double precision',
  'event_trigger',
  'fdw_handler',
  'float4',
  'float8',
  'uuid',
  'smallint',
  'smallserial',
  'character varying',
  'text',
  'real',
  'time',
  'time without time zone',
  'timestamp',
  'timestamp without time zone',
  'timestamptz',
  'timestamp with time zone',
  'timetz',
  'time with time zone',
  'daterange',
  'json',
  'jsonb',
  'gtsvector',
  'index_am_handler',
  'anyenum',
  'anynonarray',
  'anyrange',
  'box',
  'bpchar',
  'bytea',
  'cid',
  'cidr',
  'circle',
  'cstring',
  'inet',
  'internal',
  'interval',
  'language_handler',
  'line',
  'lsec',
  'macaddr',
  'money',
  'name',
  'numeric',
  'numrange',
  'oid',
  'opaque',
  'path',
  'pg_ddl_command',
  'pg_lsn',
  'pg_node_tree',
  'point',
  'polygon',
  'record',
  'refcursor',
  'regclass',
  'regconfig',
  'regdictionary',
  'regnamespace',
  'regoper',
  'regoperator',
  'regproc',
  'regpreocedure',
  'regrole',
  'regtype',
  'reltime',
  'smgr',
  'tid',
  'tinterval',
  'trigger',
  'tsm_handler',
  'tsquery',
  'tsrange',
  'tstzrange',
  'tsvector',
  'txid_snapshot',
  'unknown',
  'void',
  'xid',
  'xml',
];

export class PgUi {
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'int4',
        dtx: 'integer',
        ct: 'int(11)',
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
        uidt: 'ID',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'title',
        title: 'Title',
        dt: 'TEXT',
        dtx: 'specificType',
        ct: null,
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: null,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'SingleLineText',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'created_at',
        title: 'CreatedAt',
        dt: 'timestamp',
        dtx: 'specificType',
        ct: 'timestamp',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: UITypes.CreatedTime,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: 'updated_at',
        title: 'UpdatedAt',
        dt: 'timestamp',
        dtx: 'specificType',
        ct: 'timestamp',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: UITypes.LastModifiedTime,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: 'created_by',
        title: 'nc_created_by',
        dt: 'varchar',
        dtx: 'specificType',
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        clen: 45,
        np: null,
        ns: null,
        dtxp: '45',
        dtxs: '',
        altered: 1,
        uidt: UITypes.CreatedBy,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: 'updated_by',
        title: 'nc_updated_by',
        dt: 'varchar',
        dtx: 'specificType',
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        clen: 45,
        np: null,
        ns: null,
        dtxp: '45',
        dtxs: '',
        altered: 1,
        uidt: UITypes.LastModifiedBy,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: 'nc_order',
        title: 'nc_order',
        dt: 'numeric',
        dtx: 'specificType',
        ct: 'numeric(40,20)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: null,
        np: 40,
        ns: 20,
        dtxp: '40,20',
        dtxs: '',
        altered: 1,
        uidt: UITypes.Order,
        uip: '',
        uicn: '',
        system: true,
      },
    ];
  }

  static getNewColumn(suffix) {
    return {
      column_name: 'title' + suffix,
      dt: 'TEXT',
      dtx: 'specificType',
      ct: null,
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: null,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      altered: 1,
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
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

  static getDefaultLengthForDatatype(type): any {
    switch (type) {
      case 'int':
        return '';

      case 'tinyint':
        return '';

      case 'smallint':
        return '';

      case 'mediumint':
        return '';

      case 'bigint':
        return '';

      case 'bit':
        return '';

      case 'boolean':
        return '';

      case 'float':
        return '';

      case 'decimal':
        return '';

      case 'double':
        return '';

      case 'serial':
        return '';

      case 'date':
        return '';

      case 'datetime':
      case 'timestamp':
        return '';

      case 'time':
        return '';

      case 'year':
        return '';

      case 'char':
        return '';

      case 'varchar':
        return '';

      case 'nchar':
        return '';

      case 'text':
        return '';

      case 'tinytext':
        return '';

      case 'mediumtext':
        return '';

      case 'longtext':
        return '';

      case 'binary':
        return '';

      case 'varbinary':
        return '';

      case 'blob':
        return '';

      case 'tinyblob':
        return '';

      case 'mediumblob':
        return '';

      case 'longblob':
        return '';

      case 'enum':
        return '';

      case 'set':
        return '';

      case 'geometry':
        return '';
      case 'point':
        return '';
      case 'linestring':
        return '';
      case 'polygon':
        return '';
      case 'multipoint':
        return '';
      case 'multilinestring':
        return '';
      case 'multipolygon':
        return '';
      case 'json':
        return '';
    }
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'anyenum':
      case 'anynonarray':
      case 'anyrange':
      case 'bigint':
      case 'bigserial':
      case 'bit':
      case 'bool':
      case 'box':
      case 'bpchar':
      case 'bytea':
      case 'char':
      case 'character':
      case 'cid':
      case 'cidr':
      case 'circle':
      case 'cstring':
      case 'date':
      case 'daterange':
      case 'double precision':
      case 'event_trigger':
      case 'fdw_handler':
      case 'float4':
      case 'float8':
      case 'gtsvector':
      case 'index_am_handler':
      case 'inet':
      case 'int':
      case 'int2':
      case 'int4':
      case 'int8':
      case 'int4range':
      case 'int8range':
      case 'integer':
      case 'internal':
      case 'interval':
      case 'jsonb':
      case 'language_handler':
      case 'line':
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
      case 'real':
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
      case 'serial':
      case 'serial2':
      case 'serial8':
      case 'smallint':
      case 'smallserial':
      case 'smgr':
      case 'text':
      case 'tid':
      case 'time':
      case 'time without time zone':
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timetz':
      case 'time with time zone':
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
      case 'character varying':
      case 'tinyint':
      case 'mediumint':
      case 'float':
      case 'decimal':
      case 'double':
      case 'boolean':
      case 'datetime':
      case 'uuid':
      case 'year':
      case 'varchar':
      case 'nchar':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
      case 'binary':
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
      case 'json':
        return true;
    }
  }

  static getDefaultValueForDatatype(type): any {
    switch (type) {
      case 'anyenum':
        return 'eg: ';

      case 'anynonarray':
        return 'eg: ';

      case 'anyrange':
        return 'eg: ';

      case 'bigint':
        return 'eg: ';

      case 'bigserial':
        return 'eg: ';

      case 'bit':
        return 'eg: ';

      case 'bool':
        return 'eg: ';

      case 'box':
        return 'eg: ';

      case 'bpchar':
        return 'eg: ';

      case 'bytea':
        return 'eg: ';

      case 'char':
        return 'eg: ';

      case 'character':
        return "eg: 'sample'";

      case 'cid':
        return 'eg: ';

      case 'cidr':
        return 'eg: ';

      case 'circle':
        return 'eg: ';

      case 'cstring':
        return 'eg: ';

      case 'date':
        return "eg: '2020-09-09'";

      case 'daterange':
        return 'eg: ';

      case 'double precision':
        return 'eg: 1.2';

      case 'event_trigger':
        return 'eg: ';

      case 'fdw_handler':
        return 'eg: ';

      case 'float4':
        return 'eg: 1.2';

      case 'float8':
        return 'eg: 1.2';

      case 'gtsvector':
        return 'eg: ';

      case 'index_am_handler':
        return 'eg: ';

      case 'inet':
        return 'eg: ';

      case 'int':
        return 'eg: ';

      case 'int2':
        return 'eg: ';

      case 'int4':
        return 'eg: ';

      case 'int8':
        return 'eg: ';

      case 'int4range':
        return 'eg: ';

      case 'int8range':
        return 'eg: ';

      case 'integer':
        return 'eg: ';

      case 'internal':
        return 'eg: ';

      case 'interval':
        return 'eg: ';

      case 'json':
        return 'eg: ';

      case 'jsonb':
        return 'eg: ';

      case 'language_handler':
        return 'eg: ';

      case 'line':
        return 'eg: ';

      case 'lsec':
        return 'eg: ';

      case 'macaddr':
        return 'eg: ';

      case 'money':
        return 'eg: ';

      case 'name':
        return 'eg: ';

      case 'numeric':
        return 'eg: ';

      case 'numrange':
        return 'eg: ';

      case 'oid':
        return 'eg: ';

      case 'opaque':
        return 'eg: ';

      case 'path':
        return 'eg: ';

      case 'pg_ddl_command':
        return 'eg: ';

      case 'pg_lsn':
        return 'eg: ';

      case 'pg_node_tree':
        return 'eg: ';

      case 'point':
        return 'eg: ';

      case 'polygon':
        return 'eg: ';

      case 'real':
        return 'eg: 1.2';

      case 'record':
        return 'eg: ';

      case 'refcursor':
        return 'eg: ';

      case 'regclass':
        return 'eg: ';

      case 'regconfig':
        return 'eg: ';

      case 'regdictionary':
        return 'eg: ';

      case 'regnamespace':
        return 'eg: ';

      case 'regoper':
        return 'eg: ';

      case 'regoperator':
        return 'eg: ';

      case 'regproc':
        return 'eg: ';

      case 'regpreocedure':
        return 'eg: ';

      case 'regrole':
        return 'eg: ';

      case 'regtype':
        return 'eg: ';

      case 'reltime':
        return 'eg: ';

      case 'serial':
        return 'eg: ';

      case 'serial2':
        return 'eg: ';

      case 'serial8':
        return 'eg: ';

      case 'smallint':
        return 'eg: ';

      case 'smallserial':
        return 'eg: ';

      case 'smgr':
        return 'eg: ';

      case 'text':
        return "eg: 'sample text'";

      case 'tid':
        return 'eg: ';

      case 'time':
        return "eg: now()\n\n'04:05:06.789'";

      case 'time without time zone':
        return "eg: now()\n\n'04:05:06.789'";

      case 'timestamp':
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";

      case 'timestamp without time zone':
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";

      case 'timestamptz':
        return "eg: timezone('America/New_York','2016-06-01 00:00')\n\nnow()\n\n'2016-06-22 19:10:25-07'";

      case 'timestamp with time zone':
        return "eg: now()\n\n'2016-06-22 19:10:25-07'";

      case 'timetz':
        return 'eg: now()';

      case 'time with time zone':
        return 'eg: now()';

      case 'tinterval':
        return 'eg: ';

      case 'trigger':
        return 'eg: ';

      case 'tsm_handler':
        return 'eg: ';

      case 'tsquery':
        return 'eg: ';

      case 'tsrange':
        return 'eg: ';

      case 'tstzrange':
        return 'eg: ';

      case 'tsvector':
        return 'eg: ';

      case 'txid_snapshot':
        return 'eg: ';

      case 'unknown':
        return 'eg: ';

      case 'void':
        return 'eg: ';

      case 'xid':
        return 'eg: ';

      case 'xml':
        return 'eg: ';

      case 'character varying':
        return "eg: 'sample text'";

      case 'tinyint':
        return 'eg: ';

      case 'mediumint':
        return 'eg: ';

      case 'float':
        return 'eg: ';

      case 'decimal':
        return 'eg: ';

      case 'double':
        return 'eg: 1.2';

      case 'boolean':
        return 'eg: true\n\nfalse';

      case 'datetime':
        return 'eg: ';

      case 'uuid':
        return 'eg: ';

      case 'year':
        return 'eg: ';

      case 'varchar':
        return 'eg: ';

      case 'nchar':
        return 'eg: ';

      case 'tinytext':
        return 'eg: ';

      case 'mediumtext':
        return 'eg: ';

      case 'longtext':
        return 'eg: ';

      case 'binary':
        return 'eg: ';

      case 'varbinary':
        return 'eg: ';

      case 'blob':
        return 'eg: ';

      case 'tinyblob':
        return 'eg: ';

      case 'mediumblob':
        return 'eg: ';

      case 'longblob':
        return 'eg: ';

      case 'enum':
        return 'eg: ';

      case 'set':
        return 'eg: ';

      case 'geometry':
        return 'eg: ';

      case 'linestring':
        return 'eg: ';

      case 'multipoint':
        return 'eg: ';

      case 'multilinestring':
        return 'eg: ';

      case 'multipolygon':
        return 'eg: ';
    }
  }

  static getDefaultScaleForDatatype(type): any {
    switch (type) {
      case 'int':
        return ' ';

      case 'tinyint':
        return ' ';

      case 'smallint':
        return ' ';

      case 'mediumint':
        return ' ';

      case 'bigint':
        return ' ';

      case 'bit':
        return ' ';

      case 'boolean':
        return ' ';

      case 'float':
        return '2';

      case 'decimal':
        return '2';

      case 'double':
        return '2';

      case 'serial':
        return ' ';

      case 'date':
      case 'datetime':
      case 'timestamp':
        return ' ';

      case 'time':
        return ' ';

      case 'year':
        return ' ';

      case 'char':
        return ' ';

      case 'varchar':
        return ' ';

      case 'nchar':
        return ' ';

      case 'text':
        return ' ';

      case 'tinytext':
        return ' ';

      case 'mediumtext':
        return ' ';

      case 'longtext':
        return ' ';

      case 'binary':
        return ' ';

      case 'varbinary':
        return ' ';

      case 'blob':
        return ' ';

      case 'tinyblob':
        return ' ';

      case 'mediumblob':
        return ' ';

      case 'longblob':
        return ' ';

      case 'enum':
        return ' ';

      case 'set':
        return ' ';

      case 'geometry':
        return ' ';
      case 'point':
        return ' ';
      case 'linestring':
        return ' ';
      case 'polygon':
        return ' ';
      case 'multipoint':
        return ' ';
      case 'multilinestring':
        return ' ';
      case 'multipolygon':
        return ' ';
      case 'json':
        return ' ';
    }
  }

  static colPropAIDisabled(col, columns) {
    // console.log(col);
    if (
      col.dt === 'int4' ||
      col.dt === 'integer' ||
      col.dt === 'bigint' ||
      col.dt === 'smallint'
    ) {
      for (let i = 0; i < columns.length; ++i) {
        if (columns[i].cn !== col.cn && columns[i].ai) {
          return true;
        }
      }
      return false;
    } else {
      return true;
    }
  }

  static colPropUNDisabled(_col) {
    // console.log(col);
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
    if (
      col.dt === 'int' ||
      col.dt === 'bigint' ||
      col.dt === 'smallint' ||
      col.dt === 'tinyint'
    ) {
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
    // if (1) {
    col.altered = col.altered || 2;
    // }
    if (col.au) {
      col.cdf = 'now()';
    }

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static showScale(_columnObj) {
    return false;
  }

  static removeUnsigned(columns) {
    for (let i = 0; i < columns.length; ++i) {
      if (
        columns[i].altered === 1 &&
        !(
          columns[i].dt === 'int' ||
          columns[i].dt === 'bigint' ||
          columns[i].dt === 'tinyint' ||
          columns[i].dt === 'smallint' ||
          columns[i].dt === 'mediumint'
        )
      ) {
        columns[i].un = false;
        console.log('>> resetting unsigned value', columns[i].cn);
      }
      console.log(columns[i].cn);
    }
  }

  static columnEditable(colObj) {
    return colObj.tn !== '_evolutions' || colObj.tn !== 'nc_evolutions';
  }
  /*

  static extractFunctionName(query) {
    const reg =
      /^\s*CREATE\s+(?:OR\s+REPLACE\s*)?\s*FUNCTION\s+(?:[\w\d_]+\.)?([\w_\d]+)/i;
    const match = query.match(reg);
    return match && match[1];
  }

  static extractProcedureName(query) {
    const reg =
      /^\s*CREATE\s+(?:OR\s+REPLACE\s*)?\s*PROCEDURE\s+(?:[\w\d_]+\.)?([\w_\d]+)/i;
    const match = query.match(reg);
    return match && match[1];
  }

  static handleRawOutput(result, headers) {
    if (['DELETE', 'INSERT', 'UPDATE'].includes(result.command.toUpperCase())) {
      headers.push({ text: 'Row count', value: 'rowCount', sortable: false });
      result = [
        {
          rowCount: result.rowCount,
        },
      ];
    } else {
      result = result.rows;
      if (Array.isArray(result) && result[0]) {
        const keys = Object.keys(result[0]);
        // set headers before settings result
        for (let i = 0; i < keys.length; i++) {
          const text = keys[i];
          headers.push({ text, value: text, sortable: false });
        }
      }
    }
    return result;
  }

  static splitQueries(query) {
    /!***
     * we are splitting based on semicolon
     * there are mechanism to escape semicolon within single/double quotes(string)
     *!/
    return query.match(/\b("[^"]*;[^"]*"|'[^']*;[^']*'|[^;])*;/g);
  }

  /!**
   * if sql statement is SELECT - it limits to a number
   * @param args
   * @returns {string|*}
   *!/
  sanitiseQuery(args) {
    let q = args.query.trim().split(';');

    if (q[0].startsWith('Select')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`;
    } else if (q[0].startsWith('select')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`;
    } else if (q[0].startsWith('SELECT')) {
      q = q[0] + ` LIMIT 0,${args.limit ? args.limit : 100};`;
    } else {
      return args.query;
    }

    return q;
  }

  static getColumnsFromJson(json, tn) {
    const columns = [];

    try {
      if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);
        for (let i = 0; i < keys.length; ++i) {
          const column = {
            dp: null,
            tn,
            column_name: keys[i],
            cno: keys[i],
            np: 10,
            ns: 0,
            clen: null,
            cop: 1,
            pk: false,
            nrqd: false,
            rqd: false,
            un: false,
            ct: 'int(11) unsigned',
            ai: false,
            unique: false,
            cdf: null,
            cc: '',
            csn: null,
            dtx: 'specificType',
            dtxp: null,
            dtxs: 0,
            altered: 1,
          };

          switch (typeof json[keys[i]]) {
            case 'number':
              if (Number.isInteger(json[keys[i]])) {
                if (PgUi.isValidTimestamp(keys[i], json[keys[i]])) {
                  Object.assign(column, {
                    dt: 'timestamp',
                  });
                } else {
                  Object.assign(column, {
                    dt: 'int',
                    np: 10,
                    ns: 0,
                  });
                }
              } else {
                Object.assign(column, {
                  dt: 'float4',
                  np: null,
                  ns: null,
                  dtxp: null,
                  dtxs: null,
                });
              }
              break;
            case 'string':
              if (PgUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  dt: 'date',
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  dt: 'character varying',
                  np: null,
                  ns: 0,
                  dtxp: null,
                });
              } else {
                Object.assign(column, {
                  dt: 'text',
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                dt: 'boolean',
                np: 3,
                ns: 0,
              });
              break;
            case 'object':
              Object.assign(column, {
                dt: 'json',
                np: 3,
                ns: 0,
              });
              break;
            default:
              break;
          }
          columns.push(column);
        }
      }
    } catch (e) {
      console.log('Error in getColumnsFromJson', e);
    }

    return columns;
  }

  static isValidTimestamp(key, value) {
    if (typeof value !== 'number') {
      return false;
    }
    return new Date(value).getTime() > 0 && /(?:_|(?=A))[aA]t$/.test(key);
  }

  static isValidDate(value) {
    return new Date(value).getTime() > 0;
  }
*/

  static colPropAuDisabled(col) {
    if (col.altered !== 1) {
      return true;
    }

    switch (col.dt) {
      case 'time':
      case 'time without time zone':
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timetz':
      case 'time with time zone':
        return false;
      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    switch (col.dt?.toLowerCase()) {
      case 'anyenum':
        return 'enum';
      case 'anynonarray':
      case 'anyrange':
        return 'string';

      case 'bit':
        return 'integer';

      case 'bool':
        return 'boolean';

      case 'box':
      case 'bpchar':
      case 'bytea':
      case 'char':
      case 'character':
        return 'string';

      case 'cid':
      case 'cidr':
      case 'circle':
      case 'cstring':
        return 'string';

      case 'date':
        return 'date';
      case 'daterange':
        return 'string';

      case 'event_trigger':
      case 'fdw_handler':
        return 'string';

      case 'double precision':
      case 'float4':
      case 'float8':
        return 'float';

      case 'gtsvector':
      case 'index_am_handler':
      case 'inet':
        return 'string';

      case 'int':
      case 'int2':
      case 'int4':
      case 'int8':
      case 'integer':
      case 'bigint':
      case 'bigserial':
        return 'integer';
      case 'int4range':
      case 'int8range':
      case 'internal':
      case 'interval':
        return 'string';

      case 'language_handler':
      case 'line':
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
      case 'point':
      case 'polygon':
        return 'string';
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
        return 'string';
      case 'serial':
      case 'serial2':
      case 'serial8':
      case 'smallint':
      case 'smallserial':
        return 'integer';
      case 'smgr':
        return 'string';
      case 'text':
        return 'text';
      case 'tid':
        return 'string';
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
      case 'character varying':
      case 'xml':
        return 'string';

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
        return 'string';
      case 'blob':
      case 'tinyblob':
      case 'mediumblob':
      case 'longblob':
        return 'blob';
      case 'enum':
        return 'enum';
      case 'set':
        return 'set';
      case 'geometry':
      case 'linestring':
      case 'multipoint':
      case 'multilinestring':
      case 'multipolygon':
        return 'string';
      case 'json':
      case 'jsonb':
        return 'json';
    }
  }

  static getUIType(col): any {
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
        return 'CreatedTime';
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
        return 'LongText';
    }
  }

  static getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        {
          const isAutoIncId = idType === 'AI';
          const isAutoGenId = idType === 'AG';
          colProp.dt = isAutoGenId ? 'character varying' : 'int4';
          colProp.pk = true;
          colProp.un = isAutoIncId;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'character varying';
        break;
      case 'SingleLineText':
        colProp.dt = 'text';
        break;
      case 'LongText':
        colProp.dt = 'text';
        break;
      case 'Attachment':
        colProp.dt = 'text';
        break;
      case 'GeoData':
        colProp.dt = 'text';
        break;
      case 'Checkbox':
        colProp.dt = 'bool';
        colProp.cdf = 'false';
        break;
      case 'MultiSelect':
        colProp.dt = 'text';
        break;
      case 'SingleSelect':
        colProp.dt = 'text';
        break;
      case 'Collaborator':
        colProp.dt = 'character varying';
        break;
      case 'Date':
        colProp.dt = 'date';

        break;
      case 'Year':
        colProp.dt = 'int';
        break;
      case 'Time':
        colProp.dt = 'time';
        break;
      case 'PhoneNumber':
        colProp.dt = 'character varying';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'character varying';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'text';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'bigint';
        break;
      case 'Decimal':
        colProp.dt = 'decimal';
        break;
      case 'Currency':
        colProp.dt = 'decimal';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'double precision';
        break;
      case 'Duration':
        colProp.dt = 'decimal';
        break;
      case 'Rating':
        colProp.dt = 'smallint';
        colProp.cdf = '0';
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
        colProp.dt = 'timestamp';
        break;
      case 'CreatedTime':
        colProp.dt = 'timestamp';
        break;
      case 'LastModifiedTime':
        colProp.dt = 'timestamp';
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
      case 'JSON':
        colProp.dt = 'json';
        break;
      case 'Order':
        colProp.dt = 'numeric';
        break;
      default:
        colProp.dt = 'character varying';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt?: UITypes }, idType: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['char', 'character', 'character varying'];
        } else if (idType === 'AI') {
          return [
            'int',
            'integer',
            'bigint',
            'bigserial',
            'int2',
            'int4',
            'int8',
            'serial',
            'serial2',
            'serial8',
            'smallint',
            'smallserial',
          ];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return dbTypes;

      case 'SingleLineText':
      case 'LongText':
      case 'Collaborator':
      case 'GeoData':
        return ['text', 'character varying', 'char', 'character'];

      case 'Attachment':
        return ['json', 'text', 'char', 'character', 'character varying'];

      case 'JSON':
        return ['json', 'jsonb', 'text'];
      case 'Checkbox':
        return [
          'bit',
          'bool',
          'int2',
          'int4',
          'int8',
          'boolean',
          'smallint',
          'int',
          'integer',
          'bigint',
          'bigserial',
          'char',
          'int4range',
          'int8range',
          'serial',
          'serial2',
          'serial8',
        ];

      case 'MultiSelect':
        return ['text'];

      case 'SingleSelect':
        return ['text'];

      case 'Year':
        return ['int'];

      case 'Time':
        return [
          'time',
          'time without time zone',
          'timestamp',
          'timestamp without time zone',
          'timestamptz',
          'timestamp with time zone',
          'timetz',
          'time with time zone',
        ];

      case 'PhoneNumber':
      case 'Email':
        return ['character varying'];

      case 'URL':
        return ['text', 'character varying'];

      case 'Number':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'double precision',
          'float4',
          'float8',
          'smallint',
          'smallserial',
          'numeric',
        ];

      case 'Decimal':
        return ['double precision', 'float4', 'float8', 'numeric'];

      case 'Currency':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'double precision',
          'money',
          'float4',
          'float8',
          'numeric',
        ];

      case 'Percent':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'double precision',
          'float4',
          'float8',
          'smallint',
          'smallserial',
          'numeric',
        ];

      case 'Duration':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'double precision',
          'float4',
          'float8',
          'smallint',
          'smallserial',
          'numeric',
        ];

      case 'Rating':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'double precision',
          'float4',
          'float8',
          'smallint',
          'smallserial',
          'numeric',
        ];

      case 'Formula':
      case 'Button':
        return ['text', 'character varying'];

      case 'Rollup':
        return ['character varying'];

      case 'Count':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'smallint',
          'smallserial',
        ];

      case 'Lookup':
        return ['character varying'];

      case 'Date':
        return [
          'date',
          'timestamp',
          'timestamp without time zone',
          'timestamptz',
          'timestamp with time zone',
        ];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return [
          'timestamp',
          'timestamp without time zone',
          'timestamptz',
          'timestamp with time zone',
        ];

      case 'User':
      case 'CreatedBy':
      case 'LastModifiedBy':
        return ['character varying'];

      case 'AutoNumber':
        return [
          'int',
          'integer',
          'bigint',
          'bigserial',
          'int2',
          'int4',
          'int8',
          'serial',
          'serial2',
          'serial8',
          'smallint',
          'smallserial',
        ];

      case 'Order':
        return ['numeric'];

      case 'Barcode':
        return ['character varying'];

      case 'Geometry':
        return [
          'polygon',
          'point',
          'circle',
          'box',
          'line',
          'lseg',
          'path',
          'circle',
        ];

      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [];
  }

  static getCurrentDateDefault(col: Partial<ColumnType>) {
    if (col.uidt === UITypes.DateTime || col.uidt === UITypes.Date) {
      return 'NOW()';
    }
    return null;
  }

  static isEqual(dataType1: string, dataType2: string) {
    if (dataType1?.toLowerCase() === dataType2?.toLowerCase()) return true;

    const abstractType1 = this.getAbstractType({ dt: dataType1 });
    const abstractType2 = this.getAbstractType({ dt: dataType2 });

    if (
      abstractType1 &&
      abstractType1 === abstractType2 &&
      ['integer', 'float'].includes(abstractType1)
    )
      return true;

    return false;
  }
}

// module.exports = PgUiHelp;
