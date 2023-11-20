import UITypes from '../UITypes';
import { IDType } from './index';

const dbTypes = [
  'NUMBER',
  'DECIMAL',
  'NUMERIC',
  'INT',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'BYTEINT',
  'FLOAT',
  'FLOAT4',
  'FLOAT8',
  'DOUBLE',
  'DOUBLE PRECISION',
  'REAL',
  'VARCHAR',
  'CHAR',
  'CHARACTER',
  'STRING',
  'TEXT',
  'BINARY',
  'VARBINARY',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'TIME',
  'TIMESTAMP',
  'TIMESTAMP_LTZ',
  'TIMESTAMP_NTZ',
  'TIMESTAMP_TZ',
  'VARIANT',
  'OBJECT',
  'ARRAY',
  'GEOGRAPHY',
];

export class SnowflakeUi {
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'int',
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
        dt: 'varchar',
        dtx: 'specificType',
        ct: 'varchar(45)',
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
      {
        column_name: 'created_at',
        title: 'CreatedAt',
        dt: 'timestamp',
        dtx: 'specificType',
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'current_timestamp()',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: UITypes.DateTime,
        uip: '',
        uicn: '',
      },
      {
        column_name: 'updated_at',
        title: 'UpdatedAt',
        dt: 'timestamp',
        dtx: 'specificType',
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        au: true,
        cdf: 'current_timestamp()',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: UITypes.DateTime,
        uip: '',
        uicn: '',
      },
    ];
  }

  static getNewColumn(suffix) {
    return {
      column_name: 'title' + suffix,
      dt: 'varchar',
      dtx: 'specificType',
      ct: 'varchar(45)',
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

  static getDefaultLengthForDatatype(type): any {
    switch (type) {
      case 'VARCHAR':
      case 'CHAR':
      case 'CHARACTER':
      case 'STRING':
        return 255;
      case 'NUMBER':
      case 'DECIMAL':
      case 'NUMERIC':
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
      case 'BYTEINT':
      case 'FLOAT':
      case 'FLOAT4':
      case 'FLOAT8':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'REAL':
        return 38;
    }
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'VARCHAR':
      case 'CHAR':
      case 'CHARACTER':
      case 'STRING':
      case 'NUMBER':
      case 'DECIMAL':
      case 'NUMERIC':
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
      case 'BYTEINT':
      case 'FLOAT':
      case 'FLOAT4':
      case 'FLOAT8':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'REAL':
        return false;
      case 'TEXT':
      case 'BINARY':
      case 'VARBINARY':
      case 'BOOLEAN':
      case 'DATE':
      case 'DATETIME':
      case 'TIME':
      case 'TIMESTAMP':
      case 'TIMESTAMP_LTZ':
      case 'TIMESTAMP_NTZ':
      case 'TIMESTAMP_TZ':
      case 'VARIANT':
      case 'OBJECT':
      case 'ARRAY':
      case 'GEOGRAPHY':
        return true;
    }
  }

  static getDefaultValueForDatatype(type): any {
    switch (type) {
      default:
        return 'eg: ';
    }
  }

  static getDefaultScaleForDatatype(type): any {
    switch (type) {
      case 'NUMBER':
      case 'DECIMAL':
      case 'NUMERIC':
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
      case 'BYTEINT':
      case 'FLOAT':
      case 'FLOAT4':
      case 'FLOAT8':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'REAL':
      case 'VARCHAR':
      case 'CHAR':
      case 'CHARACTER':
      case 'STRING':
      case 'TEXT':
      case 'BINARY':
      case 'VARBINARY':
      case 'BOOLEAN':
      case 'DATE':
      case 'DATETIME':
      case 'TIME':
      case 'TIMESTAMP':
      case 'TIMESTAMP_LTZ':
      case 'TIMESTAMP_NTZ':
      case 'TIMESTAMP_TZ':
      case 'VARIANT':
      case 'OBJECT':
      case 'ARRAY':
      case 'GEOGRAPHY':
        return ' ';
    }
  }

  static colPropAIDisabled(col, columns) {
    // console.log(col);
    if (
      col.dt === 'NUMBER' ||
      col.dt === 'DECIMAL' ||
      col.dt === 'NUMERIC' ||
      col.dt === 'INT' ||
      col.dt === 'INTEGER' ||
      col.dt === 'BIGINT' ||
      col.dt === 'SMALLINT'
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
      col.dt === 'NUMBER' ||
      col.dt === 'DECIMAL' ||
      col.dt === 'NUMERIC' ||
      col.dt === 'INT' ||
      col.dt === 'INTEGER' ||
      col.dt === 'BIGINT' ||
      col.dt === 'SMALLINT'
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
      col.cdf = 'current_timestamp()';
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
          columns[i].dt === 'INT' ||
          columns[i].dt === 'BIGINT' ||
          columns[i].dt === 'SMALLINT' ||
          columns[i].dt === 'TINYINT'
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
                if (SnowflakeUi.isValidTimestamp(keys[i], json[keys[i]])) {
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
              if (SnowflakeUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  dt: 'date',
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  dt: 'VARCHAR',
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

    switch (col.dt.toUpperCase()) {
      case 'DATE':
      case 'DATETIME':
      case 'TIME':
      case 'TIMESTAMP':
      case 'TIMESTAMP_LTZ':
      case 'TIMESTAMP_NTZ':
      case 'TIMESTAMP_TZ':
        return false;
      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    switch (col.dt?.toUpperCase()) {
      case 'NUMBER':
      case 'DECIMAL':
      case 'NUMERIC':
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
      case 'BYTEINT':
        return 'integer';
      case 'FLOAT':
      case 'FLOAT4':
      case 'FLOAT8':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'REAL':
        return 'float';
      case 'VARCHAR':
      case 'CHAR':
      case 'CHARACTER':
      case 'STRING':
        return 'string';
      case 'TEXT':
        return 'text';
      case 'BINARY':
      case 'VARBINARY':
        return 'string';
      case 'BOOLEAN':
        return 'boolean';
      case 'DATE':
        return 'date';
      case 'DATETIME':
      case 'TIME':
      case 'TIMESTAMP':
      case 'TIMESTAMP_LTZ':
      case 'TIMESTAMP_NTZ':
      case 'TIMESTAMP_TZ':
        return 'string';
      case 'VARIANT':
        return 'string';
      case 'OBJECT':
        return 'json';
      case 'ARRAY':
        return 'enum';
      case 'GEOGRAPHY':
        return 'string';
      default:
        return 'string';
    }
  }

  static getUIType(col): any {
    switch (this.getAbstractType(col)) {
      case 'NUMBER':
      case 'DECIMAL':
      case 'NUMERIC':
      case 'INT':
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
      case 'BYTEINT':
        return 'Number';
      case 'FLOAT':
      case 'FLOAT4':
      case 'FLOAT8':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'REAL':
        return 'Decimal';
      case 'VARCHAR':
      case 'CHAR':
      case 'CHARACTER':
      case 'STRING':
        return 'SingleLineText';
      case 'TEXT':
        return 'LongText';
      case 'BOOLEAN':
        return 'Checkbox';
      case 'DATE':
        return 'Date';
      case 'DATETIME':
        return 'DateTime';
    }
  }

  static getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        {
          const isAutoIncId = idType === 'AI';
          const isAutoGenId = idType === 'AG';
          colProp.dt = isAutoGenId ? 'VARCHAR' : 'int4';
          colProp.pk = true;
          colProp.un = isAutoIncId;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'VARCHAR';
        break;
      case 'SingleLineText':
        colProp.dt = 'VARCHAR';
        break;
      case 'LongText':
        colProp.dt = 'TEXT';
        break;
      case 'Attachment':
        colProp.dt = 'TEXT';
        break;
      case 'GeoData':
        colProp.dt = 'TEXT';
        break;
      case 'Checkbox':
        colProp.dt = 'BOOLEAN';
        colProp.cdf = '0';
        break;
      case 'MultiSelect':
        colProp.dt = 'TEXT';
        break;
      case 'SingleSelect':
        colProp.dt = 'TEXT';
        break;
      case 'Collaborator':
        colProp.dt = 'VARCHAR';
        break;
      case 'Date':
        colProp.dt = 'DATE';
        break;
      case 'Year':
        colProp.dt = 'INT';
        break;
      case 'Time':
        colProp.dt = 'VARCHAR';
        break;
      case 'PhoneNumber':
        colProp.dt = 'VARCHAR';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'VARCHAR';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'VARCHAR';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'BIGINT';
        break;
      case 'Decimal':
        colProp.dt = 'DECIMAL';
        break;
      case 'Currency':
        colProp.dt = 'DECIMAL';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'DOUBLE PRECISION';
        break;
      case 'Duration':
        colProp.dt = 'DECIMAL';
        break;
      case 'Rating':
        colProp.dt = 'SMALLINT';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'VARCHAR';
        break;
      case 'Rollup':
        colProp.dt = 'VARCHAR';
        break;
      case 'Count':
        colProp.dt = 'INT';
        break;
      case 'Lookup':
        colProp.dt = 'VARCHAR';
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
        colProp.dt = 'INT';
        break;
      case 'Barcode':
        colProp.dt = 'VARCHAR';
        break;
      case 'Button':
        colProp.dt = 'VARCHAR';
        break;
      case 'JSON':
        colProp.dt = 'TEXT';
        break;
      default:
        colProp.dt = 'VARCHAR';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt: UITypes }, idType: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['VARCHAR'];
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
      case 'GeoData':
        return ['CHAR', 'CHARACTER', 'VARCHAR', 'TEXT'];

      case 'Attachment':
        return ['TEXT', 'CHAR', 'CHARACTER', 'VARCHAR', 'text'];

      case 'JSON':
        return ['TEXT'];
      case 'Checkbox':
        return ['BIT', 'BOOLEAN', 'TINYINT', 'INT', 'BIGINT'];

      case 'MultiSelect':
        return ['TEXT'];

      case 'SingleSelect':
        return ['TEXT'];

      case 'Year':
        return ['INT'];

      case 'Time':
        return ['TIMESTAMP', 'VARCHAR'];

      case 'PhoneNumber':
      case 'Email':
        return ['VARCHAR'];

      case 'URL':
        return ['VARCHAR', 'TEXT'];

      case 'Number':
        return [
          'NUMBER',
          'DECIMAL',
          'NUMERIC',
          'INT',
          'INTEGER',
          'BIGINT',
          'SMALLINT',
          'TINYINT',
          'BYTEINT',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'DOUBLE',
          'DOUBLE PRECISION',
          'REAL',
        ];

      case 'Decimal':
        return [
          'DOUBLE',
          'DOUBLE PRECISION',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'NUMERIC',
        ];

      case 'Currency':
        return [
          'NUMBER',
          'DECIMAL',
          'NUMERIC',
          'INT',
          'INTEGER',
          'BIGINT',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'DOUBLE',
          'DOUBLE PRECISION',
        ];

      case 'Percent':
        return [
          'NUMBER',
          'DECIMAL',
          'NUMERIC',
          'INT',
          'INTEGER',
          'BIGINT',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'DOUBLE',
          'DOUBLE PRECISION',
        ];

      case 'Duration':
        return [
          'NUMBER',
          'DECIMAL',
          'NUMERIC',
          'INT',
          'INTEGER',
          'BIGINT',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'DOUBLE',
          'DOUBLE PRECISION',
        ];

      case 'Rating':
        return [
          'NUMBER',
          'DECIMAL',
          'NUMERIC',
          'INT',
          'INTEGER',
          'BIGINT',
          'FLOAT',
          'FLOAT4',
          'FLOAT8',
          'DOUBLE',
          'DOUBLE PRECISION',
        ];

      case 'Formula':
        return ['TEXT', 'VARCHAR'];

      case 'Rollup':
        return ['VARCHAR'];

      case 'Count':
        return ['NUMBER', 'INT', 'INTEGER', 'BIGINT'];

      case 'Lookup':
        return ['VARCHAR'];

      case 'Date':
        return ['DATE', 'TIMESTAMP'];

      case 'DateTime':
      case 'CreateTime':
      case 'LastModifiedTime':
        return ['TIMESTAMP'];

      case 'AutoNumber':
        return ['NUMBER', 'INT', 'INTEGER', 'BIGINT'];

      case 'Barcode':
        return ['VARCHAR'];

      case 'Geometry':
        return ['TEXT'];

      case 'Button':
      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [];
  }
}

// module.exports = SnowflakeUiHelp;
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
