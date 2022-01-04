const dbTypes = [
  'bigint',
  'binary',
  'bit',
  'char',
  'date',
  'datetime',
  'datetime2',
  'datetimeoffset',
  'decimal',
  'float',
  'geography',
  'geometry',
  'heirarchyid',
  'image',
  'int',
  'money',
  'nchar',
  'ntext',
  'numeric',
  'nvarchar',
  'real',
  'json',
  'smalldatetime',
  'smallint',
  'smallmoney',
  'sql_variant',
  'sysname',
  'text',
  'time',
  'timestamp',
  'tinyint',
  'uniqueidentifier',
  'varbinary',
  'xml',
  'varchar'
];

export class MssqlUi {
  static getNewTableColumns() {
    return [
      {
        cn: 'id',
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
        uicn: ''
      },
      {
        cn: 'created_at',
        dt: 'datetime',
        dtx: 'specificType',
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'GETDATE()',
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
        ct: 'varchar(45)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: 'GETDATE()',
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
      dt: 'int',
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
      case 'bigint':
        return '';

      case 'binary':
        return '';

      case 'bit':
        return '';

      case 'char':
        return '';

      case 'date':
        return '';

      case 'datetime':
        return '';

      case 'datetime2':
        return '';

      case 'datetimeoffset':
        return '';

      case 'decimal':
        return '';

      case 'float':
        return '';

      case 'geography':
        return '';

      case 'geometry':
        return '';

      case 'heirarchyid':
        return '';

      case 'image':
        return '';

      case 'int':
        return '';

      case 'money':
        return '';

      case 'nchar':
        return '';

      case 'ntext':
        return '';

      case 'numeric':
        return '';

      case 'nvarchar':
        return '';

      case 'real':
        return '';

      case 'json':
        return '';

      case 'smalldatetime':
        return '';

      case 'smallint':
        return '';

      case 'smallmoney':
        return '';

      case 'sql_variant':
        return '';

      case 'sysname':
        return '';

      case 'text':
        return '';

      case 'time':
        return '';

      case 'timestamp':
        return '';

      case 'tinyint':
        return '';

      case 'uniqueidentifier':
        return '';

      case 'varbinary':
        return '';

      case 'xml':
        return '';

      case 'varchar':
        return '';

      default:
        return '';
    }
  }

  static getDefaultLengthIsDisabled(type) {
    switch (type) {
      case 'bigint':
      case 'binary':
      case 'bit':
      case 'char':
      case 'date':
      case 'datetime':
      case 'datetime2':
      case 'datetimeoffset':
      case 'decimal':
      case 'float':
      case 'geography':
      case 'geometry':
      case 'heirarchyid':
      case 'image':
      case 'int':
      case 'money':
      case 'nchar':
      case 'ntext':
      case 'numeric':
      case 'nvarchar':
      case 'real':
      case 'json':
      case 'smalldatetime':
      case 'smallint':
      case 'smallmoney':
      case 'sql_variant':
      case 'sysname':
      case 'text':
      case 'time':
      case 'timestamp':
      case 'tinyint':
      case 'uniqueidentifier':
      case 'varbinary':
      case 'xml':
        return true;

      case 'varchar':
        return false;

      default:
        return true;
    }
  }

  static getDefaultValueForDatatype(type) {
    switch (type) {
      case 'bigint':
        return 'eg: ';

      case 'binary':
        return 'eg: ';

      case 'bit':
        return 'eg: ';

      case 'char':
        return 'eg: ';

      case 'date':
        return 'eg: ';

      case 'datetime':
        return 'eg: ';

      case 'datetime2':
        return 'eg: ';

      case 'datetimeoffset':
        return 'eg: ';

      case 'decimal':
        return 'eg: ';

      case 'float':
        return 'eg: ';

      case 'geography':
        return 'eg: ';

      case 'geometry':
        return 'eg: ';

      case 'heirarchyid':
        return 'eg: ';

      case 'image':
        return 'eg: ';

      case 'int':
        return 'eg: ';

      case 'money':
        return 'eg: ';

      case 'nchar':
        return 'eg: ';

      case 'ntext':
        return 'eg: ';

      case 'numeric':
        return 'eg: ';

      case 'nvarchar':
        return 'eg: ';

      case 'real':
        return 'eg: ';

      case 'json':
        return 'eg: ';

      case 'smalldatetime':
        return 'eg: ';

      case 'smallint':
        return 'eg: ';

      case 'smallmoney':
        return 'eg: ';

      case 'sql_variant':
        return 'eg: ';

      case 'sysname':
        return 'eg: ';

      case 'text':
        return 'eg: ';

      case 'time':
        return 'eg: ';

      case 'timestamp':
        return 'eg: ';

      case 'tinyint':
        return 'eg: ';

      case 'uniqueidentifier':
        return 'eg: ';

      case 'varbinary':
        return 'eg: ';

      case 'xml':
        return 'eg: ';

      case 'varchar':
        return 'eg: ';

      default:
        return '';
    }
  }

  static getDefaultScaleForDatatype(type) {
    switch (type) {
      case 'bigint':
        return '';

      case 'binary':
        return '';

      case 'bit':
        return '';

      case 'char':
        return '';

      case 'date':
        return '';

      case 'datetime':
        return '';

      case 'datetime2':
        return '';

      case 'datetimeoffset':
        return '';

      case 'decimal':
        return '';

      case 'float':
        return '';

      case 'geography':
        return '';

      case 'geometry':
        return '';

      case 'heirarchyid':
        return '';

      case 'image':
        return '';

      case 'int':
        return '';

      case 'money':
        return '';

      case 'nchar':
        return '';

      case 'ntext':
        return '';

      case 'numeric':
        return '';

      case 'nvarchar':
        return '';

      case 'real':
        return '';

      case 'json':
        return '';

      case 'smalldatetime':
        return '';

      case 'smallint':
        return '';

      case 'smallmoney':
        return '';

      case 'sql_variant':
        return '';

      case 'sysname':
        return '';

      case 'text':
        return '';

      case 'time':
        return '';

      case 'timestamp':
        return '';

      case 'tinyint':
        return '';

      case 'uniqueidentifier':
        return '';

      case 'varbinary':
        return '';

      case 'xml':
        return '';

      case 'varchar':
        return '';

      default:
        return '';
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
    console.log(result);

    if (Array.isArray(result) && result[0]) {
      const keys = Object.keys(result[0]);
      // set headers before settings result
      for (let i = 0; i < keys.length; i++) {
        const text = keys[i];
        headers.push({ text, value: text, sortable: false });
      }
    } else if (result === undefined) {
      headers.push({ text: 'Message', value: 'message', sortable: false });
      result = [{ message: 'Success' }];
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
            altered: 1
          };

          switch (typeof json[keys[i]]) {
            case 'number':
              if (Number.isInteger(json[keys[i]])) {
                if (MssqlUi.isValidTimestamp(keys[i], json[keys[i]])) {
                  Object.assign(column, {
                    dt: 'timestamp'
                  });
                } else {
                  Object.assign(column, {
                    dt: 'int',
                    np: 10,
                    ns: 0
                  });
                }
              } else {
                Object.assign(column, {
                  dt: 'float',
                  np: 10,
                  ns: 2,
                  dtxp: '11',
                  dtxs: 2
                });
              }
              break;
            case 'string':
              if (MssqlUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  dt: 'datetime'
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  dt: 'varchar',
                  np: 255,
                  ns: 0,
                  dtxp: '255'
                });
              } else {
                Object.assign(column, {
                  dt: 'text'
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                dt: 'bit',
                np: null,
                ns: 0
              });
              break;
            case 'object':
              Object.assign(column, {
                dt: 'varchar',
                np: 255,
                ns: 0,
                dtxp: '255'
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
      case 'datetime2':
      case 'datetimeoffset':
      case 'time':
      case 'timestamp':
        return false;

      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    switch ((col.dt || col.dt).toLowerCase()) {
      case 'bigint':
      case 'smallint':
      case 'bit':
      case 'tinyint':
      case 'int':
        return 'integer';

      case 'binary':
        return 'string';

      case 'char':
        return 'string';

      case 'date':
        return 'date';
      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'datetimeoffset':
        return 'datetime';
      case 'decimal':
      case 'float':
        return 'float';

      case 'geography':
      case 'geometry':
      case 'heirarchyid':
      case 'image':
        return 'string';

      case 'money':
      case 'nchar':
        return 'string';

      case 'ntext':
        return 'text';
      case 'numeric':
        return 'float';
      case 'nvarchar':
        return 'string';
      case 'real':
        return 'float';

      case 'json':
        return 'json';

      case 'smallmoney':
      case 'sql_variant':
      case 'sysname':
        return 'string';
      case 'text':
        return 'text';
      case 'time':
        return 'time';
      case 'timestamp':
        return 'timestamp';

      case 'uniqueidentifier':
      case 'varbinary':
      case 'xml':
        return 'string';
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

  static getDataTypeForUiType(
    col
  ): {
    dt: string;
    [key: string]: any;
  } {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        colProp.dt = 'int';
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
        colProp.dt = 'tinyint';
        colProp.dtxp = 1;
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
        colProp.dt = 'varchar';

        break;
      case 'Year':
        colProp.dt = 'int';
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
        colProp.dt = 'int';
        break;
      case 'Decimal':
        colProp.dt = 'decimal';
        break;
      case 'Currency':
        colProp.dt = 'decimal';
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
        colProp.dt = 'int';
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
        colProp.dt = 'int';
        break;
      case 'Lookup':
        colProp.dt = 'varchar';
        break;
      case 'DateTime':
        colProp.dt = 'datetimeoffset';
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
        colProp.dt = 'varchar';
        break;
      case 'Button':
        colProp.dt = 'varchar';
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
        return ['char', 'ntext', 'text', 'varchar', 'nvarchar'];

      case 'JSON':
        return ['text', 'ntext'];

      case 'Checkbox':
        return ['bigint', 'bit', 'int', 'tinyint'];

      case 'MultiSelect':
        return ['text', 'ntext'];

      case 'SingleSelect':
        return ['text', 'ntext'];

      case 'Year':
        return ['int'];

      case 'Time':
        return ['time'];

      case 'PhoneNumber':
      case 'Email':
        return ['varchar'];

      case 'URL':
        return ['varchar', 'text'];

      case 'Number':
        return [
          'int',
          'bigint',
          'bit',
          'decimal',
          'float',
          'numeric',
          'real',
          'smallint',
          'tinyint'
        ];

      case 'Decimal':
        return ['decimal', 'float'];

      case 'Currency':
        return [
          'int',
          'bigint',
          'bit',
          'decimal',
          'float',
          'numeric',
          'real',
          'smallint',
          'tinyint'
        ];

      case 'Percent':
        return [
          'int',
          'bigint',
          'bit',
          'decimal',
          'float',
          'numeric',
          'real',
          'smallint',
          'tinyint'
        ];

      case 'Duration':
        return [
          'int',
          'bigint',
          'bit',
          'decimal',
          'float',
          'numeric',
          'real',
          'smallint',
          'tinyint'
        ];

      case 'Rating':
        return [
          'int',
          'bigint',
          'bit',
          'decimal',
          'float',
          'numeric',
          'real',
          'smallint',
          'tinyint'
        ];

      case 'Formula':
        return ['text', 'ntext', 'varchar', 'nvarchar'];

      case 'Rollup':
        return ['varchar'];

      case 'Count':
        return ['int', 'bigint', 'smallint', 'tinyint'];

      case 'Lookup':
        return ['varchar'];

      case 'Date':
        return ['date'];

      case 'DateTime':
      case 'CreateTime':
      case 'LastModifiedTime':
        return [
          'datetimeoffset',
          'datetime2'
          // 'datetime'
        ];

      case 'AutoNumber':
        return ['int', 'bigint', 'smallint', 'tinyint'];

      case 'Barcode':
        return ['varchar'];

      case 'Geometry':
        return ['geometry'];

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
