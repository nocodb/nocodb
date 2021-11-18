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
  'timestamp'
];

export class SqliteUi {
  static getNewTableColumns() {
    return [
      {
        cn: 'id',
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
        uicn: ''
      },
      {
        cn: 'title',
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
        uicn: ''
      },
      {
        cn: 'created_at',
        dt: 'datetime',
        dtx: 'specificType',
        ct: 'varchar',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'CURRENT_TIMESTAMP',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'CreateTime',
        uip: '',
        uicn: ''
      },
      {
        cn: 'updated_at',
        dt: 'datetime',
        dtx: 'specificType',
        ct: 'varchar',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'CURRENT_TIMESTAMP',
        clen: 45,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: 'LastModifiedTime',
        uip: '',
        uicn: ''
      }
    ];
  }

  static getNewColumn(suffix) {
    return {
      cn: 'title' + suffix,
      dt: 'integer',
      dtx: 'specificType',
      ct: 'integer(11)',
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
      // data_type_x_specific: ' ',
      dtxp: '',
      dtxs: ' ',
      altered: 1,
      uidt: 'Number',
      uip: '',
      uicn: ''
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
        return ' ';

      case 'text':
        return ' ';

      case 'numeric':
        return ' ';

      case 'real':
        return ' ';

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

  static columnEditable(_colObj) {
    return true; // colObj.altered === 1;
  }

  static handleRawOutput(result, headers) {
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
            cn: keys[i],
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
            altered: 1
          };

          switch (typeof json[keys[i]]) {
            case 'number':
              if (Number.isInteger(json[keys[i]])) {
                if (SqliteUi.isValidTimestamp(keys[i], json[keys[i]])) {
                  Object.assign(column, {
                    dt: 'timestamp'
                  });
                } else {
                  Object.assign(column, {
                    dt: 'integer'
                  });
                }
              } else {
                Object.assign(column, {
                  dt: 'real'
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
                  dt: 'varchar'
                });
              } else {
                Object.assign(column, {
                  dt: 'text'
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                dt: 'integer'
              });
              break;
            case 'object':
              Object.assign(column, {
                dt: 'text',
                np: null,
                dtxp: null
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
    switch ((col.dt || col.dt).toLowerCase()) {
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

  static getDataTypeForUiType(col) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        colProp.dt = 'integer';
        colProp.pk = true;
        colProp.un = true;
        colProp.ai = true;
        colProp.rqd = true;
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
      case 'Checkbox':
        // colProp.dt = 'tinyint';
        // colProp.dtxp = 1;
        colProp.dt = 'boolean';
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
          msg: ['Validation failed : isMobilePhone']
        };
        break;
      case 'Email':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail']
        };
        break;
      case 'URL':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL']
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
          msg: ['Validation failed : isCurrency']
        };
        break;
      case 'Percent':
        colProp.dt = 'double';
        break;
      case 'Duration':
        colProp.dt = 'integer';
        break;
      case 'Rating':
        colProp.dt = 'float';
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
      case 'CreateTime':
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
      default:
        colProp.dt = 'varchar';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col) {
    switch (col.uidt) {
      case 'ID':
      case 'ForeignKey':
        return dbTypes;

      case 'SingleLineText':
      case 'LongText':
      case 'Attachment':
      case 'Collaborator':
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
          'boolean'
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
          'int8'
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
          'int8'
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
          'float'
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
          'numeric'
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
          'numeric'
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
          'int8'
        ];

      case 'Rating':
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
          'numeric'
        ];

      case 'Formula':
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
          'int8'
        ];

      case 'Lookup':
        return ['varchar'];

      case 'Date':
        return ['date', 'varchar'];

      case 'DateTime':
      case 'CreateTime':
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
          'int8'
        ];

      case 'Barcode':
        return ['varchar'];

      case 'Geometry':
        return ['text'];
      case 'JSON':
        return ['text'];

      case 'Button':
      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return ['LOG', 'EXP', 'POWER', 'SQRT'];
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
