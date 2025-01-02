import UITypes from '../UITypes';
import { IDType } from './index';
import { ColumnType } from '~/lib';

const dbTypes = [
  'int',
  'integer',
  'tinyint',
  'smallint',
  'mediumint',
  'bigint',
  'int2',
  'int8',
  'character',
  'blob sub_type text',
  'blob',
  'real',
  'double',
  'double precision',
  'float',
  'numeric',
  'boolean',
  'date',
  'datetime',
  'text',
  'varchar',
  'timestamp',
];

export class SqliteUi {
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'integer',
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
        np: null,
        ns: 0,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'ID',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'title',
        title: 'Title',
        dt: 'varchar',
        dtx: 'specificType',
        ct: 'varchar',
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
        dt: 'datetime',
        dtx: 'specificType',
        ct: 'datetime',
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
        dt: 'datetime',
        dtx: 'specificType',
        ct: 'datetime',
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
        ct: 'varchar',
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
        ct: 'varchar',
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
        uidt: UITypes.LastModifiedBy,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: 'nc_order',
        title: 'nc_order',
        dt: 'real',
        dtx: 'specificType',
        ct: 'real',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        clen: null,
        np: null,
        ns: null,
        dtxp: '',
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
      dt: 'varchar',
      dtx: 'specificType',
      ct: 'varchar',
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
      dtxp: '',
      dtxs: '',
      altered: 1,
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
    };
  }

  static getDefaultLengthForDatatype(_type) {
    return '';
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'integer':
      case 'blob':
      case 'real':
      case 'numeric':
        return true;

      case 'text':
        return false;
    }
  }

  static getDefaultValueForDatatype(type): any {
    switch (type) {
      case 'integer':
        return 'eg : ' + 10;

      case 'text':
        return 'eg : hey';

      case 'numeric':
        return 'eg : ' + 10;

      case 'real':
        return 'eg : ' + 10.0;

      case 'blob':
        return 'eg : ' + 100;
    }
  }

  static getDefaultScaleForDatatype(type): any {
    switch (type) {
      case 'integer':
      case 'text':
      case 'numeric':
      case 'real':
      case 'blob':
        return ' ';
    }
  }

  static colPropAIDisabled(col, columns) {
    // console.log(col);
    if (col.dt === 'integer') {
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
    if (
      col.dt === 'int' ||
      col.dt === 'bigint' ||
      col.dt === 'smallint' ||
      col.dt === 'tinyint'
    ) {
      col.altered = col.altered || 2;
    }
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

  /*static extractFunctionName(query) {
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
  }*/
  static columnEditable(_colObj) {
    return true; // colObj.altered === 1;
  }

  /*static handleRawOutput(result, headers) {
    console.log(result);
    if (Array.isArray(result) && result[0]) {
      const keys = Object.keys(result[0]);
      // set headers before settings result
      for (let i = 0; i < keys.length; i++) {
        const text = keys[i];
        headers.push({ text, value: text, sortable: false });
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
            np: null,
            ns: null,
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
                if (SqliteUi.isValidTimestamp(keys[i], json[keys[i]])) {
                  Object.assign(column, {
                    dt: 'timestamp',
                  });
                } else {
                  Object.assign(column, {
                    dt: 'integer',
                  });
                }
              } else {
                Object.assign(column, {
                  dt: 'real',
                });
              }
              break;
            case 'string':
              // if (SqliteUi.isValidDate(json[keys[i]])) {
              //   Object.assign(column, {
              //     "dt": "datetime"
              //   });
              // } else
              if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  dt: 'varchar',
                });
              } else {
                Object.assign(column, {
                  dt: 'text',
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                dt: 'integer',
              });
              break;
            case 'object':
              Object.assign(column, {
                dt: 'text',
                np: null,
                dtxp: null,
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
  }*/

  static onCheckboxChangeAU(col) {
    console.log(col);
    // if (1) {
    col.altered = col.altered || 2;
    // }

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static colPropAuDisabled(col) {
    if (col.altered !== 1) {
      return true;
    }

    switch (col.dt) {
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'time':
        return false;

      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    switch (col.dt?.replace(/\(\d+\)$/).toLowerCase()) {
      case 'date':
        return 'date';
      case 'datetime':
      case 'timestamp':
        return 'datetime';
      case 'integer':
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'int2':
      case 'int8':
        return 'integer';
      case 'text':
        return 'text';
      case 'boolean':
        return 'boolean';
      case 'real':
      case 'double':
      case 'double precision':
      case 'float':
      case 'decimal':
      case 'numeric':
        return 'float';

      case 'blob sub_type text':
      case 'blob':
        return 'blob';

      case 'character':
      case 'varchar':
        return 'string';
    }
    return 'string';
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
          colProp.dt = isAutoGenId ? 'varchar' : 'integer';
          colProp.pk = true;
          colProp.un = isAutoIncId;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'varchar';
        break;
      case 'SingleLineText':
        colProp.dt = 'varchar';
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
        colProp.dt = 'boolean';
        colProp.cdf = '0';
        break;
      case 'MultiSelect':
        colProp.dt = 'text';
        break;
      case 'SingleSelect':
        colProp.dt = 'text';
        break;
      case 'Collaborator':
        colProp.dt = 'varchar';
        break;
      case 'Date':
        colProp.dt = 'date';

        break;
      case 'Year':
        colProp.dt = 'year';
        break;
      case 'Time':
        colProp.dt = 'time';
        break;
      case 'PhoneNumber':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'integer';
        break;
      case 'Decimal':
        colProp.dt = 'decimal';
        break;
      case 'Currency':
        colProp.dt = 'double precision';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'double';
        break;
      case 'Duration':
        colProp.dt = 'decimal';
        break;
      case 'Rating':
        colProp.dt = 'integer';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'varchar';
        break;
      case 'Rollup':
        colProp.dt = 'varchar';
        break;
      case 'Count':
        colProp.dt = 'integer';
        break;
      case 'Lookup':
        colProp.dt = 'varchar';
        break;
      case 'DateTime':
        colProp.dt = 'datetime';
        break;
      case 'CreatedTime':
        colProp.dt = 'datetime';
        break;
      case 'LastModifiedTime':
        colProp.dt = 'datetime';
        break;
      case 'AutoNumber':
        colProp.dt = 'integer';
        break;
      case 'Barcode':
        colProp.dt = 'varchar';
        break;
      case 'Button':
        colProp.dt = 'varchar';
        break;
      case 'JSON':
        colProp.dt = 'text';
        break;
      case 'Order':
        colProp.dt = 'real';
        break;
      default:
        colProp.dt = 'varchar';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt: UITypes }, idType?: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['character', 'text', 'varchar'];
        } else if (idType === 'AI') {
          return [
            'int',
            'integer',
            'tinyint',
            'smallint',
            'mediumint',
            'bigint',
            'int2',
            'int8',
          ];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return dbTypes;
      case 'SingleLineText':
      case 'LongText':
      case 'Attachment':
      case 'Collaborator':
      case 'GeoData':
        return ['character', 'text', 'varchar'];

      case 'Checkbox':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
          'boolean',
        ];

      case 'MultiSelect':
        return ['text', 'varchar'];

      case 'SingleSelect':
        return ['text', 'varchar'];

      case 'Year':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
        ];

      case 'Time':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
        ];

      case 'PhoneNumber':
      case 'Email':
        return ['varchar', 'text'];

      case 'URL':
        return ['varchar', 'text'];

      case 'Number':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
          'numeric',
          'real',
          'double',
          'double precision',
          'float',
        ];

      case 'Decimal':
        return ['real', 'double', 'double precision', 'float', 'numeric'];

      case 'Currency':
        return [
          'real',
          'double',
          'double precision',
          'float',
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
          'numeric',
        ];

      case 'Percent':
        return [
          'real',
          'double',
          'double precision',
          'float',
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
          'numeric',
        ];

      case 'Duration':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
        ];

      case 'Rating':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
          'numeric',
          'real',
          'double',
          'double precision',
          'float',
        ];

      case 'Formula':
      case 'Button':
        return ['text', 'varchar'];

      case 'Rollup':
        return ['varchar'];

      case 'Count':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
        ];

      case 'Lookup':
        return ['varchar'];

      case 'Date':
        return ['date', 'varchar'];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return ['datetime', 'timestamp'];

      case 'AutoNumber':
        return [
          'int',
          'integer',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'int2',
          'int8',
        ];

      case 'Barcode':
        return ['varchar'];

      case 'Geometry':
        return ['text'];
      case 'JSON':
        return ['text'];
      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [
      'XOR',
      'REGEX_MATCH',
      'REGEX_EXTRACT',
      'REGEX_REPLACE',
      'VALUE',
      'COUNTA',
      'COUNT',
      'DATESTR',
    ];
  }

  static getCurrentDateDefault(_col: Partial<ColumnType>) {
    return null;
  }

  static isEqual(dataType1: string, dataType2: string) {
    if (dataType1 === dataType2) return true;

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
