import UITypes from '../UITypes';
import { IDType } from './index';

// Ref - https://docs.oracle.com/cd/B28359_01/server.111/b28318/datatype.htm#CNCPT513
const dbTypes = [
  'CHAR',
  'VARCHAR',
  'VARCHAR2',

  'NUMBER',
  'NCHAR',
  'NVARCHAR2',
  'CLOB',
  'NCLOB',
  'BINARY_FLOAT',
  'BINARY_DOUBLE',

  'DATE',

  'TIMESTAMP',
  'TIMESTAMP WITH LOCAL TIME ZONE',
  'TIMESTAMP WITH TIME ZONE',

  'BLOB',
  'CLOB',
  'NCLOB',
  'BFILE',

  'RAW',
  'LONG RAW',

  'ROWID',
  'UROWID',

  'XMLType',
  'UriType',
];
export class OracleUi {
  static getNewTableColumns(): any[] {
    return [
      {
        column_name: 'ID',
        title: 'Id',
        dt: 'NUMBER',
        rqd: true,
        ck: false,
        pk: true,
        un: false,
        ai: true,
        cdf: null,
        clen: null,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'ID',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'TITLE',
        title: 'Title',
        dt: 'VARCHAR2',
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
        uip: '',
        uicn: '',
      },
    ];
  }

  static getNewColumn(suffix) {
    return {
      column_name: 'TITLE' + suffix,
      dt: 'VARCHAR2',
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
      uip: '',
      uicn: '',
    };
  }

  static getDefaultLengthForDatatype(type) {
    switch (type) {
      default:
        return '';
    }
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'NUMBER':
      case 'VARCHAR':
      case 'VARCHAR2':
        return true;
      default:
        return false;
    }
  }

  static getDefaultValueForDatatype(type) {
    switch (type) {
      default:
        return '';
    }
  }

  static getDefaultScaleForDatatype(type): any {
    switch (type) {
      case 'VARCHAR2':
      case 'VARCHAR':
      case 'NVARCHAR2':
      case 'NCHAR':
        return 45;
    }
  }

  static colPropAIDisabled(col, columns) {
    // console.log(col);
    if (col.dt === 'NUMBER') {
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
    return true;
  }

  static onCheckboxChangeAI(col) {
    console.log(col);
    if (col.dt === 'NUMBER') {
      col.altered = col.altered || 2;
    }
  }

  static showScale(_columnObj) {
    return false;
  }

  static removeUnsigned(columns) {
    for (let i = 0; i < columns.length; ++i) {
      if (columns[i].altered === 1 && !(columns[i].dt === 'NUMBER')) {
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

  static splitQueries(query) {
    /***
     * we are splitting based on semicolon
     * there are mechanism to escape semicolon within single/double quotes(string)
     */
    return query.match(/\b("[^"]*;[^"]*"|'[^']*;[^']*'|[^;])*;/g);
  }

  static onCheckboxChangeAU(col) {
    col.altered = col.altered || 2;
  }

  /**
   * if sql statement is SELECT - it limits to a number
   * @param args
   * @returns {string|*}
   */
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

  getColumnsFromJson(json, tn) {
    const columns = [];

    try {
      if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);

        for (let i = 0; i < keys.length; ++i) {
          switch (typeof json[keys[i]]) {
            case 'number':
              if (Number.isInteger(json[keys[i]])) {
                columns.push({
                  dp: null,
                  tn,
                  column_name: keys[i],
                  cno: keys[i],
                  dt: 'int',
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
                  dtxp: '11',
                  dtxs: 0,
                  altered: 1,
                });
              } else {
                columns.push({
                  dp: null,
                  tn,
                  column_name: keys[i],
                  cno: keys[i],
                  dt: 'float',
                  np: 10,
                  ns: 2,
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
                  dtxp: '11',
                  dtxs: 2,
                  altered: 1,
                });
              }

              break;

            case 'string':
              if (json[keys[i]].length <= 255) {
                columns.push({
                  dp: null,
                  tn,
                  column_name: keys[i],
                  cno: keys[i],
                  dt: 'varchar',
                  np: 45,
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
                  dtxp: '45',
                  dtxs: 0,
                  altered: 1,
                });
              } else {
                columns.push({
                  dp: null,
                  tn,
                  column_name: keys[i],
                  cno: keys[i],
                  dt: 'text',
                  np: null,
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
                });
              }

              break;

            case 'boolean':
              columns.push({
                dp: null,
                tn,
                column_name: keys[i],
                cno: keys[i],
                dt: 'boolean',
                np: 3,
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
                dtxp: '1',
                dtxs: 0,
                altered: 1,
              });
              break;

            case 'object':
              columns.push({
                dp: null,
                tn,
                column_name: keys[i],
                cno: keys[i],
                dt: 'json',
                np: 3,
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
              });
              break;

            default:
              break;
          }
        }
      }
    } catch (e) {
      console.log('Error in getColumnsFromJson', e);
    }
    return columns;
  }

  static colPropAuDisabled(_col) {
    return true;
  }

  static getAbstractType(col): any {
    switch ((col.dt || col.dt).toLowerCase()) {
      case 'CHAR':
      case 'VARCHAR':
      case 'VARCHAR2':
      case 'NCHAR':
      case 'NVARCHAR2':
      case 'CLOB':
      case 'NCLOB':
        return 'string';

      case 'NUMBER':
      case 'BINARY_FLOAT':
      case 'BINARY_DOUBLE':
        return 'float';

      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMP WITH LOCAL TIME ZONE':
      case 'TIMESTAMP WITH TIME ZONE':
        return 'datetime';

      case 'BLOB':
      case 'CLOB':
      case 'NCLOB':
      case 'BFILE':
        return 'blob';

      case 'RAW':
      case 'LONG RAW':
      case 'ROWID':
      case 'UROWID':
      case 'XMLType':
      case 'UriType':
      default:
        return 'string';
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
        return 'CreateTime';
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
          colProp.dt = isAutoGenId ? 'VARCHAR2' : 'NUMBER';
          colProp.pk = true;
          colProp.un = isAutoIncId;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'NUMBER';
        break;
      case 'SingleLineText':
        colProp.dt = 'VARCHAR2';
        break;
      case 'LongText':
        colProp.dt = 'CLOB';
        break;
      case 'Attachment':
        colProp.dt = 'CLOB';
        break;
      case 'Checkbox':
        colProp.dt = 'NUMBER';
        colProp.dtxp = 1;
        colProp.cdf = '0';
        break;
      case 'MultiSelect':
        colProp.dt = 'CLOB';
        break;
      case 'SingleSelect':
        colProp.dt = 'CLOB';
        break;
      case 'Collaborator':
        colProp.dt = 'VARCHAR2';
        break;
      case 'Date':
        colProp.dt = 'DATE';

        break;
      case 'Year':
        colProp.dt = 'NUMBER';
        break;
      case 'Time':
        colProp.dt = 'DATE';
        break;
      case 'PhoneNumber':
        colProp.dt = 'VARCHAR2';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'VARCHAR2';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'VARCHAR2';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'NUMBER';
        break;
      case 'Decimal':
        colProp.dt = 'NUMBER';
        break;
      case 'Currency':
        colProp.dt = 'NUMBER';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'NUMBER';
        break;
      case 'Duration':
        colProp.dt = 'NUMBER';
        break;
      case 'Rating':
        colProp.dt = 'NUMBER';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'VARCHAR2';
        break;
      case 'Rollup':
        colProp.dt = 'VARCHAR2';
        break;
      case 'Count':
        colProp.dt = 'NUMBER';
        break;
      case 'Lookup':
        colProp.dt = 'VARCHAR2';
        break;
      case 'DateTime':
        colProp.dt = 'TIMESTAMP';
        break;
      case 'CreateTime':
        colProp.dt = 'TIMESTAMP';
        break;
      case 'LastModifiedTime':
        colProp.dt = 'TIMESTAMP';
        break;
      case 'AutoNumber':
        colProp.dt = 'NUMBER';
        break;
      case 'Barcode':
        colProp.dt = 'varchar';
        break;
      case 'Button':
        colProp.dt = 'VARCHAR2';
        break;
      default:
        colProp.dt = 'VARCHAR2';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt?: UITypes }, idType: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['VARCHAR2', 'VARCHAR', 'NCHAR', 'NVARCHAR2'];
        } else if (idType === 'AI') {
          return ['NUMBER'];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return dbTypes;

      case 'SingleLineText':
      case 'LongText':
      case 'Collaborator':
        return [
          'CHAR',
          'VARCHAR',
          'VARCHAR2',
          'NCHAR',
          'NVARCHAR2',
          'CLOB',
          'NCLOB',
        ];
      case 'Attachment':
        return [
          'CHAR',
          'VARCHAR',
          'VARCHAR2',
          'NCHAR',
          'NVARCHAR2',
          'CLOB',
          'NCLOB',
        ];
      case 'JSON':
        return [
          'CHAR',
          'VARCHAR',
          'VARCHAR2',
          'NCHAR',
          'NVARCHAR2',
          'CLOB',
          'NCLOB',
        ];
      case 'Checkbox':
        return ['NUMBER'];

      case 'MultiSelect':
      case 'SingleSelect':
        return ['CLOB', 'NCLOB'];

      case 'Year':
        return ['NUMBER'];

      case 'Time':
        return ['DATE', 'VARCHAR', 'VARCHAR2'];

      case 'PhoneNumber':
      case 'Email':
        return [
          'CHAR',
          'VARCHAR',
          'VARCHAR2',
          'NCHAR',
          'NVARCHAR2',
          'CLOB',
          'NCLOB',
        ];

      case 'URL':
        return [
          'CHAR',
          'VARCHAR',
          'VARCHAR2',
          'NCHAR',
          'NVARCHAR2',
          'CLOB',
          'NCLOB',
        ];

      case 'Number':
        return ['NUMBER'];

      case 'Decimal':
        return ['NUMBER'];

      case 'Currency':
        return ['NUMBER'];
      case 'Percent':
        return ['NUMBER'];

      case 'Duration':
        return ['NUMBER'];

      case 'Rating':
        return ['NUMBER'];

      case 'Count':
        return ['NUMBER'];

      case 'Date':
        return [
          'DATE',

          'TIMESTAMP',
          'TIMESTAMP WITH LOCAL TIME ZONE',
          'TIMESTAMP WITH TIME ZONE',
        ];

      case 'DateTime':
      case 'CreateTime':
      case 'LastModifiedTime':
        return [
          'DATE',

          'TIMESTAMP',
          'TIMESTAMP WITH LOCAL TIME ZONE',
          'TIMESTAMP WITH TIME ZONE',
        ];

      case 'Button':
      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [];
  }
}

// module.exports = PgUiHelp;
