import UITypes from '../UITypes';
import { ColumnType, IDType } from '~/lib';

const dbTypes = [
  'int',
  'smallint',
  'mediumint',
  'bigint',
  'bit',
  'boolean',
  'float',
  'decimal',
  'double',
  'serial',
  'tinyint',
  'date',
  'datetime',
  'timestamp',
  'time',
  'year',
  'char',
  'varchar',
  'nchar',
  'text',
  'tinytext',
  'mediumtext',
  'longtext',
  'binary',
  'varbinary',
  'blob',
  'tinyblob',
  'mediumblob',
  'longblob',
  'enum',
  'set',
  'geometry',
  'point',
  'linestring',
  'polygon',
  'multipoint',
  'multilinestring',
  'multipolygon',
  'json',
];

export class MysqlUi {
  static getNewTableColumns(): readonly any[] {
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
        un: true,
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
        cdf: null,
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
        dt: 'decimal',
        dtx: 'decimal',
        ct: 'decimal(40,20)',
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

  static getDefaultLengthForDatatype(type): any {
    switch (type) {
      case 'int':
        return 11;

      case 'tinyint':
        return 1;

      case 'smallint':
        return 5;

      case 'mediumint':
        return 9;

      case 'bigint':
        return 20;

      case 'bit':
        return 64;

      case 'boolean':
        return '';

      case 'float':
        return 12;

      case 'decimal':
        return 10;

      case 'double':
        return 22;

      case 'serial':
        return 20;

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
        return 255;

      case 'varchar':
        return 255;

      case 'nchar':
        return 255;

      case 'text':
        return '';

      case 'tinytext':
        return '';

      case 'mediumtext':
        return '';

      case 'longtext':
        return '';

      case 'binary':
        return 255;

      case 'varbinary':
        return 65500;

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
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'float':
      case 'decimal':
      case 'double':
      case 'serial':
      case 'datetime':
      case 'timestamp':
      case 'char':
      case 'varchar':
      case 'nchar':
      case 'binary':
      case 'varbinary':
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
      case 'bit':
        return false;

      case 'boolean':
      case 'date':
      case 'time':
      case 'year':
      case 'text':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
      case 'blob':
      case 'tinyblob':
      case 'mediumblob':
      case 'longblob':
        return true;
    }
  }

  static getDefaultValueForDatatype(type): any {
    switch (type) {
      case 'int':
        return 'eg : ' + 10;

      case 'tinyint':
        return 'eg : ' + 1;

      case 'smallint':
        return 'eg : ' + 10;

      case 'mediumint':
        return 'eg : ' + 10;

      case 'bigint':
        return 'eg : ' + 100;

      case 'bit':
        return 'eg : ' + 1;

      case 'boolean':
        return 'eg : ' + 1;

      case 'float':
        return 'eg : ' + 10.0;

      case 'decimal':
        return 'eg : ' + 10.0;

      case 'double':
        return 'eg : ' + 10.0;

      case 'serial':
        return 'eg : ' + 100;

      case 'date':
        return 'eg : ' + '2020-09-09';

      case 'datetime':
        return (
          'eg : ' +
          'now()\n\nCURRENT_TIMESTAMP\n\nCURRENT_TIMESTAMP on update CURRENT_TIMESTAMP\n\n1992-10-12 00:00:00'
        );

      case 'timestamp':
        return (
          'eg : ' +
          'now()\n\nCURRENT_TIMESTAMP\n\nCURRENT_TIMESTAMP on update CURRENT_TIMESTAMP\n\n1992-10-12 00:00:00'
        );

      case 'time':
        return 'eg : ' + '00:00:00';

      case 'year':
        return 'eg : ' + '2020';

      case 'char':
        return 'eg : ' + 'a';

      case 'varchar':
        return 'eg : ' + 'hey';

      case 'nchar':
        return 'eg : ' + 'hey';

      case 'text':
        return 'eg : ' + 'hey';

      case 'tinytext':
        return 'eg : ' + 'hey';

      case 'mediumtext':
        return 'eg : ' + 'hey';

      case 'longtext':
        return 'eg : ' + 'hey';

      case 'binary':
        return 'eg : ' + 1;

      case 'varbinary':
        return 'eg : ' + 'hey';

      case 'blob':
        return 'eg : ' + 'hey';

      case 'tinyblob':
        return 'eg : ' + 'hey';

      case 'mediumblob':
        return 'eg : ' + 'hey';

      case 'longblob':
        return 'eg : ' + 'hey';

      case 'enum':
        return 'eg : ' + 'a';

      case 'set':
        return 'eg : ' + 'a';

      case 'geometry':
        return "geometry can't have default value";

      case 'point':
        return "point can't have default value";

      case 'linestring':
        return "linestring can't have default value";

      case 'polygon':
        return "polygon can't have default value";

      case 'multipoint':
        return "multipoint can't have default value";

      case 'multilinestring':
        return "multilinestring can't have default value";

      case 'multipolygon':
        return "multipolygon can't have default value";

      case 'json':
        return "JSON can't have default value";
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
      col.dt === 'int' ||
      col.dt === 'tinyint' ||
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

  static colPropUNDisabled(col) {
    // console.log(col);
    return !(
      col.dt === 'int' ||
      col.dt === 'tinyint' ||
      col.dt === 'smallint' ||
      col.dt === 'mediumint' ||
      col.dt === 'bigint'
    );
  }

  static onCheckboxChangeAI(col) {
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

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static showScale(columnObj) {
    return (
      columnObj.dt === 'float' ||
      columnObj.dt === 'decimal' ||
      columnObj.dt === 'double' ||
      columnObj.dt === 'real'
    );
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
      /^\s*CREATE\s+.*?(?:OR\s+REPLACE\s*)?\s*FUNCTION\s+(?:`?[\w\d_]+`?\.)?`?([\w_\d]+)`?/i;
    const match = query.match(reg);
    return match && match[1];
  }

  static extractProcedureName(query) {
    const reg =
      /^\s*CREATE.*?\s+(?:OR\s+REPLACE\s*)?\s*PROCEDURE\s+(?:[\w\d_]+\.)?([\w_\d]+)/i;
    const match = query.match(reg);
    return match && match[1];
  }

  static handleRawOutput(result, headers) {
    result = result[0] ? result[0] : [];
    if (Array.isArray(result) && result[0]) {
      const keys = Object.keys(result[0]);
      // set headers before settings result
      for (let i = 0; i < keys.length; i++) {
        const text = keys[i];
        headers.push({ text, value: text, sortable: false });
      }
    } else {
      const keys = Object.keys(result);
      for (let i = 0; i < keys.length; i++) {
        const text = keys[i];
        if (typeof text !== 'function') {
          headers.push({ text, value: text, sortable: false });
        }
      }
      result = [result];
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
  static sanitiseQuery(args) {
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
                if (MysqlUi.isValidTimestamp(keys[i], json[keys[i]])) {
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
                  dt: 'float',
                  np: 10,
                  ns: 2,
                  dtxp: '11',
                  dtxs: 2,
                });
              }
              break;
            case 'string':
              if (MysqlUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  dt: 'datetime',
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  dt: 'varchar',
                  np: 255,
                  ns: 0,
                  dtxp: '255',
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

  static colPropAuDisabled(_col) {
    return true;
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
        return 'DateTime';
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

  static getAbstractType(col): any {
    switch (col.dt?.toLowerCase()) {
      case 'int':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'bit':
        return 'integer';

      case 'boolean':
        return 'boolean';

      case 'float':
      case 'decimal':
      case 'double':
      case 'serial':
        return 'float';
      case 'tinyint':
        if (col.dtxp == '1') {
          return 'boolean';
        } else {
          return 'integer';
        }
      case 'date':
        return 'date';
      case 'datetime':
      case 'timestamp':
        return 'datetime';
      case 'time':
        return 'time';
      case 'year':
        return 'year';
      case 'char':
      case 'varchar':
      case 'nchar':
        return 'string';
      case 'text':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
        return 'text';

      // todo: use proper type
      case 'binary':
        return 'string';
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

      case 'geometry':
      case 'point':
      case 'linestring':
      case 'polygon':
      case 'multipoint':
      case 'multilinestring':
      case 'multipolygon':
        return 'string';

      case 'json':
        return 'json';
    }
  }

  static getDataTypeForUiType(
    col: { uidt: UITypes; dtxp?: string; colOptions?: any },
    idType?: IDType
  ) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        {
          const isAutoIncId = idType === 'AI';
          const isAutoGenId = idType === 'AG';
          colProp.dt = isAutoGenId ? 'varchar' : 'int';
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
        colProp.dt = 'tinyint';
        colProp.dtxp = 1;
        colProp.cdf = '0';
        break;
      case 'MultiSelect':
        colProp.dt = 'set';
        if (
          col.colOptions?.options.length > 64 ||
          col.dtxp?.toString?.()?.split(',').length > 64
        ) {
          colProp.dt = 'text';
        }
        break;
      case 'SingleSelect':
        colProp.dt = 'enum';
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
          msg: ['Validation failed : isMobilePhone ({cn})'],
        };
        break;
      case 'Email':
        colProp.dt = 'varchar';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail ({cn})'],
        };
        break;
      case 'URL':
        colProp.dt = 'text';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL ({cn})'],
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
        colProp.dt = 'varchar';
        break;
      case 'Rollup':
        colProp.dt = 'varchar';
        break;
      case 'Count':
        colProp.dt = 'int';
        break;
      case 'Lookup':
        colProp.dt = 'varchar';
        break;
      case 'DateTime':
        colProp.dt = 'datetime';
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
        colProp.dt = 'varchar';
        break;
      case 'Button':
        colProp.dt = 'varchar';
        break;
      case 'JSON':
        colProp.dt = 'json';
        break;
      case 'Order':
        colProp.dt = 'decimal';
        break;
      default:
        colProp.dt = 'varchar';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col, idType?: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['varchar', 'char', 'nchar'];
        } else if (idType === 'AI') {
          return ['int', 'smallint', 'mediumint', 'bigint', 'bit', 'serial'];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return dbTypes;

      case 'SingleLineText':
      case 'LongText':
      case 'Collaborator':
      case 'GeoData':
        return [
          'text',
          'mediumtext',
          'longtext',
          'varchar',
          'char',
          'nchar',
          'tinytext',
        ];

      case 'Attachment':
        return [
          'json',
          'char',
          'varchar',
          'nchar',
          'text',
          'tinytext',
          'mediumtext',
          'longtext',
        ];

      case 'JSON':
        return ['json', 'text', 'tinytext', 'mediumtext', 'longtext'];

      case 'Checkbox':
        return [
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
          'boolean',
          'serial',
          'tinyint',
        ];

      case 'MultiSelect':
        return ['set', 'text', 'tinytext', 'mediumtext', 'longtext'];

      case 'SingleSelect':
        return ['enum', 'text', 'tinytext', 'mediumtext', 'longtext'];

      case 'Year':
        return ['year'];

      case 'Time':
        return ['time'];

      case 'PhoneNumber':
      case 'Email':
        return ['varchar'];

      case 'URL':
        return ['text', 'tinytext', 'mediumtext', 'longtext', 'varchar'];

      case 'Number':
        return [
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
          'float',
          'decimal',
          'double',
          'serial',
        ];

      case 'Decimal':
        return ['float', 'decimal', 'double', 'serial'];

      case 'Currency':
        return [
          'decimal',
          'float',
          'double',
          'serial',
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
        ];

      case 'Percent':
        return [
          'decimal',
          'float',
          'double',
          'serial',
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
        ];

      case 'Duration':
        return [
          'decimal',
          'float',
          'double',
          'serial',
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
        ];

      case 'Rating':
        return [
          'decimal',
          'float',
          'double',
          'serial',
          'int',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
        ];

      case 'Formula':
      case 'Button':
        return [
          'char',
          'varchar',
          'nchar',
          'text',
          'tinytext',
          'mediumtext',
          'longtext',
        ];

      case 'Rollup':
        return ['varchar'];

      case 'Count':
        return ['int', 'smallint', 'mediumint', 'bigint', 'serial'];

      case 'Lookup':
        return ['varchar'];

      case 'Date':
        return ['date', 'datetime', 'timestamp', 'varchar'];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return ['datetime', 'timestamp', 'varchar'];

      case 'AutoNumber':
        return ['int', 'smallint', 'mediumint', 'bigint'];

      case 'Barcode':
        return ['varchar'];

      case 'Geometry':
        return [
          'geometry',
          'point',
          'linestring',
          'polygon',
          'multipoint',
          'multilinestring',
          'multipolygon',
        ];

      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return ['COUNTA', 'COUNT', 'DATESTR'];
  }

  static getCurrentDateDefault(col: Partial<ColumnType>) {
    // if database datatype timestamp or datetime then return CURRENT_TIMESTAMP
    if (
      col.dt &&
      (col.dt.toLowerCase() === 'timestamp' ||
        col.dt.toLowerCase() === 'datetime')
    ) {
      return 'CURRENT_TIMESTAMP';
    }

    // database type is not defined(means column create) and ui datatype is datetime then return CURRENT_TIMESTAMP
    // in this scenario it will create column with datatype timestamp/datetime
    if (!col.dt && col.uidt === UITypes.DateTime) {
      return 'CURRENT_TIMESTAMP';
    }
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
