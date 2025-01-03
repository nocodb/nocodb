import UITypes from '../UITypes';
import { IDType } from './index';
import { ColumnType } from '~/lib';

const dbTypes = [
  'BIGINT',
  'BINARY',
  'BOOLEAN',
  'DATE',
  'DECIMAL',
  'DOUBLE',
  'FLOAT',
  'INT',
  'INTERVAL',
  'VOID',
  'SMALLINT',
  'STRING',
  'TIMESTAMP',
  'TIMESTAMP_NTZ',
  'TINYINT',
];

export class DatabricksUi {
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'int',
        dtx: 'int',
        ct: 'int',
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
        dt: 'string',
        dtx: 'specificType',
        ct: 'string',
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
        dt: 'TIMESTAMP',
        dtx: 'specificType',
        ct: 'TIMESTAMP',
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
        dt: 'TIMESTAMP',
        dtx: 'specificType',
        ct: 'TIMESTAMP',
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
        dt: 'string',
        dtx: 'specificType',
        ct: 'string',
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
        dt: 'string',
        dtx: 'specificType',
        ct: 'string',
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
        dt: 'decimal',
        dtx: 'specificType',
        ct: 'decimal(38,18)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: null,
        np: 38,
        ns: 18,
        dtxp: '38,18',
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
      dt: 'string',
      dtx: 'specificType',
      ct: 'string',
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

  static getDefaultLengthForDatatype(_type) {
    return '';
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'decimal':
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
      case 'bigint':
      case 'tinyint':
      case 'int':
      case 'smallint':
        return 'integer';
      case 'decimal':
      case 'double':
      case 'float':
        return 'float';
      case 'boolean':
        return 'boolean';
      case 'timestamp':
      case 'timestamp_ntz':
        return 'datetime';
      case 'date':
        return 'date';
      case 'string':
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

  static getDataTypeForUiType(col: { uidt: UITypes }) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        {
          colProp.dt = 'string';
          colProp.pk = true;
          colProp.rqd = true;
          colProp.meta = { ag: 'nc' };
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'string';
        break;
      case 'SingleLineText':
        colProp.dt = 'string';
        break;
      case 'LongText':
        colProp.dt = 'string';
        break;
      case 'Attachment':
        colProp.dt = 'string';
        break;
      case 'GeoData':
        colProp.dt = 'string';
        break;
      case 'Checkbox':
        colProp.dt = 'boolean';
        break;
      case 'MultiSelect':
        colProp.dt = 'string';
        break;
      case 'SingleSelect':
        colProp.dt = 'string';
        break;
      case 'Collaborator':
        colProp.dt = 'string';
        break;
      case 'Date':
        colProp.dt = 'date';

        break;
      case 'Year':
        colProp.dt = 'number';
        break;
      case 'Time':
        colProp.dt = 'string';
        break;
      case 'PhoneNumber':
        colProp.dt = 'string';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'string';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'string';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'int';
        break;
      case 'Decimal':
        colProp.dt = 'decimal';
        break;
      case 'Currency':
        colProp.dt = 'double';
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
        colProp.dt = 'int';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'string';
        break;
      case 'Rollup':
        colProp.dt = 'string';
        break;
      case 'Count':
        colProp.dt = 'int';
        break;
      case 'Lookup':
        colProp.dt = 'string';
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
        colProp.dt = 'int';
        break;
      case 'Barcode':
        colProp.dt = 'string';
        break;
      case 'Button':
        colProp.dt = 'string';
        break;
      case 'JSON':
        colProp.dt = 'string';
        break;
      case 'Order':
        colProp.dt = 'decimal';
        break;
      default:
        colProp.dt = 'string';
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
        return ['string'];

      case 'Checkbox':
        return ['boolean'];

      case 'MultiSelect':
        return ['string'];

      case 'SingleSelect':
        return ['string'];

      case 'Year':
        return ['int'];

      case 'Time':
        return ['string'];

      case 'PhoneNumber':
      case 'Email':
        return ['string'];

      case 'URL':
        return ['string'];

      case 'Number':
        return ['int'];

      case 'Decimal':
        return ['decimal', 'float', 'double'];

      case 'Currency':
        return ['decimal'];

      case 'Percent':
        return ['decimal'];

      case 'Duration':
        return ['decimal'];

      case 'Rating':
        return ['int'];

      case 'Formula':
      case 'Button':
        return ['string'];

      case 'Rollup':
        return ['string'];

      case 'Count':
        return ['int'];

      case 'Lookup':
        return ['string'];

      case 'Date':
        return ['date'];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return ['datetime'];

      case 'AutoNumber':
        return ['int'];

      case 'Barcode':
        return ['string'];

      case 'Geometry':
        return ['string'];
      case 'JSON':
        return ['string'];

      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [
      'LOG',
      'EXP',
      'POWER',
      'SQRT',
      'XOR',
      'REGEX_MATCH',
      'REGEX_EXTRACT',
      'REGEX_REPLACE',
      'VALUE',
      'COUNTA',
      'COUNT',
      'ROUNDDOWN',
      'ROUNDUP',
      'DATESTR',
      'DAY',
      'MONTH',
      'HOUR',
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
