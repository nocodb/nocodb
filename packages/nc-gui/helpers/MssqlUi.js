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
  'varchar',
]

export class MssqlUi {

  static getNewTableColumns() {
    return [
      {
        cn: "id",
        dt: "int",
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
        np: null,
        ns: 0,
        dtxp: '',
        dtxs: '',
        altered: 1,
        uidt: "ID",
        uip: "",
        uicn: "",
      },
      {
        cn: "title",
        dt: "varchar",
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
        altered: 1, uidt: 'SingleLineText',
        uip: "",
        uicn: "",
      },
      {
        cn: "created_at",
        dt: "datetime",
        dtx: "specificType",
        ct: "varchar(45)",
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
        uip: "",
        uicn: "",
      },
      {
        cn: "updated_at",
        dt: "datetime",
        dtx: "specificType",
        ct: "varchar(45)",
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
        uip: "",
        uicn: "",
      }
    ];
  }

  static getNewColumn(suffix) {
    return {
      cn: "title" + suffix,
      dt: "int",
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
      dtxp: '',
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
      case 'bigint':
        return '';
        break;
      case 'binary':
        return '';
        break;
      case 'bit':
        return '';
        break;
      case 'char':
        return '';
        break;
      case 'date':
        return '';
        break;
      case 'datetime':
        return '';
        break;
      case 'datetime2':
        return '';
        break;
      case 'datetimeoffset':
        return '';
        break;
      case 'decimal':
        return '';
        break;
      case 'float':
        return '';
        break;
      case 'geography':
        return '';
        break;
      case 'geometry':
        return '';
        break;
      case 'heirarchyid':
        return '';
        break;
      case 'image':
        return '';
        break;
      case 'int':
        return '';
        break;
      case 'money':
        return '';
        break;
      case 'nchar':
        return '';
        break;
      case 'ntext':
        return '';
        break;
      case 'numeric':
        return '';
        break;
      case 'nvarchar':
        return '';
        break;
      case 'real':
        return '';
        break;
      case 'json':
        return '';
        break;
      case 'smalldatetime':
        return '';
        break;
      case 'smallint':
        return '';
        break;
      case 'smallmoney':
        return '';
        break;
      case 'sql_variant':
        return '';
        break;
      case 'sysname':
        return '';
        break;
      case 'text':
        return '';
        break;
      case 'time':
        return '';
        break;
      case 'timestamp':
        return '';
        break;
      case 'tinyint':
        return '';
        break;
      case 'uniqueidentifier':
        return '';
        break;
      case 'varbinary':
        return '';
        break;
      case 'xml':
        return '';
        break;
      case 'varchar':
        return '';
        break;
      default:
        return '';
        break;

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
        break;
      case 'varchar':
        return false;
        break;
      default:
        return true;
        break;
    }

  }


  static getDefaultValueForDatatype(type) {
    switch (type) {
      case 'bigint':
        return 'eg: ';
        break;
      case 'binary':
        return 'eg: ';
        break;
      case 'bit':
        return 'eg: ';
        break;
      case 'char':
        return 'eg: ';
        break;
      case 'date':
        return 'eg: ';
        break;
      case 'datetime':
        return 'eg: ';
        break;
      case 'datetime2':
        return 'eg: ';
        break;
      case 'datetimeoffset':
        return 'eg: ';
        break;
      case 'decimal':
        return 'eg: ';
        break;
      case 'float':
        return 'eg: ';
        break;
      case 'geography':
        return 'eg: ';
        break;
      case 'geometry':
        return 'eg: ';
        break;
      case 'heirarchyid':
        return 'eg: ';
        break;
      case 'image':
        return 'eg: ';
        break;
      case 'int':
        return 'eg: ';
        break;
      case 'money':
        return 'eg: ';
        break;
      case 'nchar':
        return 'eg: ';
        break;
      case 'ntext':
        return 'eg: ';
        break;
      case 'numeric':
        return 'eg: ';
        break;
      case 'nvarchar':
        return 'eg: ';
        break;
      case 'real':
        return 'eg: ';
        break;
      case 'json':
        return 'eg: ';
        break;
      case 'smalldatetime':
        return 'eg: ';
        break;
      case 'smallint':
        return 'eg: ';
        break;
      case 'smallmoney':
        return 'eg: ';
        break;
      case 'sql_variant':
        return 'eg: ';
        break;
      case 'sysname':
        return 'eg: ';
        break;
      case 'text':
        return 'eg: ';
        break;
      case 'time':
        return 'eg: ';
        break;
      case 'timestamp':
        return 'eg: ';
        break;
      case 'tinyint':
        return 'eg: ';
        break;
      case 'uniqueidentifier':
        return 'eg: ';
        break;
      case 'varbinary':
        return 'eg: ';
        break;
      case 'xml':
        return 'eg: ';
        break;
      case 'varchar':
        return 'eg: ';
        break;
      default:
        return ''
        break;
    }
  }


  static getDefaultScaleForDatatype(type) {
    switch (type) {
      case 'bigint':
        return '';
        break;
      case 'binary':
        return '';
        break;
      case 'bit':
        return '';
        break;
      case 'char':
        return '';
        break;
      case 'date':
        return '';
        break;
      case 'datetime':
        return '';
        break;
      case 'datetime2':
        return '';
        break;
      case 'datetimeoffset':
        return '';
        break;
      case 'decimal':
        return '';
        break;
      case 'float':
        return '';
        break;
      case 'geography':
        return '';
        break;
      case 'geometry':
        return '';
        break;
      case 'heirarchyid':
        return '';
        break;
      case 'image':
        return '';
        break;
      case 'int':
        return '';
        break;
      case 'money':
        return '';
        break;
      case 'nchar':
        return '';
        break;
      case 'ntext':
        return '';
        break;
      case 'numeric':
        return '';
        break;
      case 'nvarchar':
        return '';
        break;
      case 'real':
        return '';
        break;
      case 'json':
        return '';
        break;
      case 'smalldatetime':
        return '';
        break;
      case 'smallint':
        return '';
        break;
      case 'smallmoney':
        return '';
        break;
      case 'sql_variant':
        return '';
        break;
      case 'sysname':
        return '';
        break;
      case 'text':
        return '';
        break;
      case 'time':
        return '';
        break;
      case 'timestamp':
        return '';
        break;
      case 'tinyint':
        return '';
        break;
      case 'uniqueidentifier':
        return '';
        break;
      case 'varbinary':
        return '';
        break;
      case 'xml':
        return '';
        break;
      case 'varchar':
        return '';
        break;
      default:
        return '';
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
    console.log(result);

    if (Array.isArray(result) && result[0]) {
      const keys = Object.keys(result[0]);
      //set headers before settings result
      for (let i = 0; i < keys.length; i++) {
        const text = keys[i];
        headers.push({text, value: text, sortable: false});
      }
    } else if (result === undefined) {
      headers.push({text: 'Message', value: 'message', sortable: false});
      result = [{message: 'Success'}];
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
                if (MssqlUi.isValidTimestamp(keys[i], json[keys[i]])) {
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
                  "dt": "float",
                  "np": 10,
                  "ns": 2,
                  "dtxp": "11",
                  "dtxs": 2,
                });
              }
              break;
            case 'string':
              if (MssqlUi.isValidDate(json[keys[i]])) {
                Object.assign(column, {
                  "dt": "datetime"
                });
              } else if (json[keys[i]].length <= 255) {
                Object.assign(column, {
                  "dt": "varchar",
                  "np": 255,
                  "ns": 0,
                  "dtxp": "255",
                });
              } else {
                Object.assign(column, {
                  "dt": "text"
                });
              }
              break;
            case 'boolean':
              Object.assign(column, {
                "dt": "bit",
                "np": null,
                "ns": 0,
              });
              break;
            case 'object':
              Object.assign(column, {
                "dt": "varchar",
                "np": 255,
                "ns": 0,
                "dtxp": "255",
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

  static onCheckboxChangeAU(col) {
    console.log(col);
    if (1) {
      col.altered = col.altered || 2;
    }

    // if (!col.ai) {
    //   col.dtx = 'specificType'
    // } else {
    //   col.dtx = ''
    // }
  }

  static colPropAuDisabled(col) {

    if (col.altered !== 1) return true;

    switch (col.dt) {
      case 'date':
      case 'datetime':
      case 'datetime2':
      case 'datetimeoffset':
      case 'time':
      case 'timestamp':
        return false;
        break;
      default:
        return true;
        break;
    }
  }


  static getAbstractType(col) {
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
        return 'string'

      case 'ntext':
        return 'text';
      case 'numeric':
        return 'float'
      case 'nvarchar':
        return 'string';
      case 'real':
        return 'float';

      case 'json':
        return 'json';


      case 'smallmoney':
      case 'sql_variant':
      case 'sysname':
        return 'string'
      case 'text':
        return 'text'
      case 'time':
        return 'time'
      case 'timestamp':
        return 'timestamp';

      case 'uniqueidentifier':
      case 'varbinary':
      case 'xml':
        return "string"
      case 'varchar':
        return 'string';

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
        colProp.validate = {"func": ["isMobilePhone"], "args": [""], "msg": ["Validation failed : isMobilePhone"]}
        break;
      case 'Email':
        colProp.dt = 'varchar';
        colProp.validate = {"func": ["isEmail"], "args": [""], "msg": ["Validation failed : isEmail"]}
        break;
      case 'URL':
        colProp.dt = 'varchar';
        colProp.validate = {"func": ["isURL"], "args": [""], "msg": ["Validation failed : isURL"]}
        break;
      case 'Number':
        colProp.dt = 'int';
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
        colProp.dt = 'varchar';
        break;
      case 'Button':
        colProp.dt = 'varchar';
        break;
      default:
        colProp.dt = 'varchar';
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
          "ntext",
          "text",
          "varchar",
          "nvarchar",
        ];
        break;
      case 'Checkbox':
        return [
          'bigint',
          'bit',
          'int',
          'tinyint',
        ]
        break;
      case 'MultiSelect':
        return [
           "text",'ntext'
        ];
        break;
      case 'SingleSelect':
        return [
          "text",
          "ntext",
        ];
        break;
      case 'Year':
        return ['int'];
        break;
      case 'Time':
        return ["time"];
        break;
      case 'PhoneNumber':
      case 'Email':
        return [
          "varchar",
        ];
        break;
      case 'URL':
        return [
          "varchar",
          "text",
        ];
        break;
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
          'tinyint',
        ]
        break;
      case 'Decimal':
        return [

          'decimal',
          'float',
        ]
        break;
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
          'tinyint',];
        break;
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
          'tinyint',
        ]
        break;
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
          'tinyint',]
        break;
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
          'tinyint',]
        break;
      case 'Formula':
        return [
          "text",
          "ntext",
          "varchar",
          "nvarchar",
        ];
        break;
      case 'Rollup':
        return [
          "varchar",
        ];
        break;
      case 'Count':
        return [
          "int",
          'bigint',
          'smallint',
          'tinyint',
        ];
        break;
      case 'Lookup':
        return [
          "varchar",
        ];
        break;
      case 'Date':
        return [
          "date",

        ];
        break;
      case 'DateTime':
      case 'CreateTime':
      case 'LastModifiedTime':
        return [
          'datetime',
          'datetime2',
          'datetimeoffset',
        ];
        break;
      case 'AutoNumber':
        return
        return [
          "int",
          'bigint',
          'smallint',
          'tinyint',
        ];
        break;
      case 'Barcode':
        return ['varchar'];
        break;
      case 'Geometry':
        return [

          'geometry',
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
