import UITypes from '../UITypes';
import { abstractTypeToMetaUIType } from './metaUiDataType';
import { IDType } from './index';
import { ColumnType } from '~/lib/Api';
import { SqlUi } from './SqlUI.types';

// Oracle data types surfaced in the column-type picker.
// Must stay in sync with OracleClient.getKnexDataTypes (backend).
//
// Creation defaults stay 19c-compatible: Checkbox → number(1), JSON/LongText →
// clob, strings → varchar2 (4000-byte cap). The 21c+/23ai native types (json,
// boolean, vector) are listed so introspected columns round-trip, but NocoDB
// doesn't emit them yet.
const dbTypes = [
  // character
  'char',
  'nchar',
  'varchar2',
  'nvarchar2',
  'clob',
  'nclob',
  'long',
  // numeric
  'number',
  'float',
  'binary_float',
  'binary_double',
  // date & time — Oracle DATE carries a time component (to seconds); there is
  // no time-only type.
  'date',
  'timestamp',
  'timestamp with time zone',
  'timestamp with local time zone',
  'interval year to month',
  'interval day to second',
  // binary
  'blob',
  'raw',
  'long raw',
  'bfile',
  // other
  'rowid',
  'urowid',
  'xmltype',
  // 21c+ native JSON; 23ai boolean / vector
  'json',
  'boolean',
  'vector',
];

export class OracleUi implements SqlUi {
  //#region statics
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'number',
        dtx: 'integer',
        ct: 'number(11)',
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
        dtxs: '0',
        altered: 1,
        uidt: 'ID',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'title',
        title: 'Title',
        dt: 'varchar2',
        dtx: 'specificType',
        ct: 'varchar2(4000)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: 4000,
        np: null,
        ns: null,
        dtxp: '4000',
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
        dt: 'varchar2',
        dtx: 'specificType',
        ct: 'varchar2(45)',
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
        dt: 'varchar2',
        dtx: 'specificType',
        ct: 'varchar2(45)',
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
        dt: 'number',
        dtx: 'specificType',
        ct: 'number(38,20)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: null,
        np: 38,
        ns: 20,
        dtxp: '38',
        dtxs: '20',
        altered: 1,
        uidt: UITypes.Order,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: '__nc_deleted',
        title: '__nc_deleted',
        dt: 'number',
        dtx: 'specificType',
        ct: 'number(1)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: '0',
        clen: null,
        np: 1,
        ns: 0,
        dtxp: '1',
        dtxs: '0',
        altered: 1,
        uidt: UITypes.Deleted,
        uip: '',
        uicn: '',
        system: true,
      },
    ];
  }

  static getNewColumn(suffix) {
    return {
      column_name: 'title' + suffix,
      dt: 'varchar2',
      dtx: 'specificType',
      ct: 'varchar2(4000)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 4000,
      np: null,
      ns: null,
      dtxp: '4000',
      dtxs: '',
      altered: 1,
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
    };
  }

  static getDefaultLengthForDatatype(type): any {
    switch (type) {
      // varchar2/nvarchar2 cap at 4000 bytes without MAX_STRING_SIZE=EXTENDED;
      // default to the full width so text doesn't truncate at an arbitrary 255.
      case 'varchar2':
      case 'nvarchar2':
        return 4000;
      case 'char':
      case 'nchar':
      case 'raw':
        return 255;
      default:
        return '';
    }
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'char':
      case 'nchar':
      case 'varchar2':
      case 'nvarchar2':
      case 'raw':
      case 'number':
        return false;
      default:
        return true;
    }
  }

  static getDefaultValueForDatatype(_type): any {
    return 'eg: ';
  }

  static getDefaultScaleForDatatype(type): any {
    switch (type) {
      case 'number':
        return '2';
      default:
        return ' ';
    }
  }

  static colPropAIDisabled(col, columns) {
    // Oracle IDENTITY (12c+) is only valid on NUMBER-family columns,
    // and at most one column per table can be IDENTITY.
    if (col.dt === 'number') {
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
    // Oracle has no UNSIGNED modifier.
    return true;
  }

  static onCheckboxChangeAI(col) {
    if (col.dt === 'number') {
      col.altered = col.altered || 2;
    }
  }

  static onCheckboxChangeAU(col) {
    col.altered = col.altered || 2;
    if (col.au) {
      col.cdf = 'CURRENT_TIMESTAMP';
    }
  }

  static showScale(_columnObj) {
    return false;
  }

  static removeUnsigned(columns) {
    // Oracle has no UNSIGNED — always clear the flag on altered columns.
    for (let i = 0; i < columns.length; ++i) {
      if (columns[i].altered === 1) {
        columns[i].un = false;
      }
    }
  }

  static columnEditable(colObj) {
    return colObj.tn !== '_evolutions' || colObj.tn !== 'nc_evolutions';
  }

  static colPropAuDisabled(col) {
    if (col.altered !== 1) {
      return true;
    }

    switch (col.dt) {
      case 'date':
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp with local time zone':
        return false;
      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    // Oracle has no time-only type — a `Time` column is physically stored as
    // DATE (see getDataTypeForUiType), which would otherwise resolve to the
    // 'datetime' abstract type below. pg/mysql derive 'time' from their native
    // `time` dt; here the authoritative signal is the persisted uidt. Honor it
    // so a Time column reports the 'time' abstract type (drives the frontend
    // Time picker / Time filter widget). Raw introspection passes no uidt, so
    // this guard only fires for already-typed NocoDB columns — a bare DATE with
    // no uidt still falls through to 'datetime'.
    if (col.uidt === UITypes.Time) {
      return 'time';
    }

    const dt = (col.dt || col.dt_s)?.toLowerCase();
    switch (dt) {
      // NUMBER scale decides integer vs float: explicit scale 0 (NUMBER(p),
      // INTEGER) is integral; a fractional or unconstrained scale (bare
      // NUMBER has data_scale = null) can hold fractions. Identity columns
      // are sequence-backed integers regardless of declared scale — a bare
      // NUMBER identity has data_scale = null and would otherwise introspect
      // as float (pg parity: serial/identity → integer).
      case 'number': {
        if (col.ai) return 'integer';
        const scale = col.ns ?? col.dtxs;
        return scale !== null &&
          scale !== undefined &&
          String(scale).trim() !== '' &&
          +scale === 0
          ? 'integer'
          : 'float';
      }

      case 'float':
      case 'binary_float':
      case 'binary_double':
        return 'float';

      case 'boolean':
        return 'boolean';

      // Oracle DATE carries a time component (to seconds) — it is a datetime,
      // not a calendar date.
      case 'date':
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp with local time zone':
        return 'datetime';

      case 'char':
      case 'nchar':
      case 'varchar2':
      case 'nvarchar2':
      case 'raw':
      case 'rowid':
      case 'urowid':
      case 'xmltype':
      case 'interval year to month':
      case 'interval day to second':
      case 'vector':
        return 'string';

      case 'clob':
      case 'nclob':
      case 'long':
        return 'text';

      case 'blob':
      case 'long raw':
      case 'bfile':
        return 'blob';

      case 'json':
        return 'json';
    }
    return 'string';
  }

  static getMetaAbstractType(col): any {
    const dt = (col.dt || col.dt_s)?.toLowerCase();
    switch (dt) {
      case 'number':
      case 'float':
      case 'binary_float':
      case 'binary_double':
      case 'boolean':
      case 'date':
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp with local time zone':
      case 'char':
      case 'nchar':
      case 'varchar2':
      case 'nvarchar2':
      case 'clob':
      case 'nclob':
      case 'long':
      case 'json':
        return this.getAbstractType(col);

      // pg meta-sync parity: interval → 'string' → SingleLineText
      case 'interval year to month':
      case 'interval day to second':
        return 'string';

      // Binary and opaque Oracle-native types intentionally return no
      // abstract type so abstractTypeToMetaUIType falls through to
      // SpecificDBType. NB: unlike PgUi we can't return the raw dt here —
      // Oracle's 'blob' would collide with the mapped 'blob' abstract type
      // (mysql's blob → LongText behavior), and pg maps binary (bytea) to
      // SpecificDBType, which is the reference.
      case 'blob':
      case 'long raw':
      case 'bfile':
      case 'raw':
      case 'rowid':
      case 'urowid':
      case 'xmltype':
      case 'vector':
        return undefined;
    }
    // Unknown native types → SpecificDBType as well (pg parity: unlisted
    // types return undefined from getMetaAbstractType).
    return undefined;
  }

  // Introspection UIType for meta-sync — distinct from getUIType
  // (column-creation default). See metaUiDataType.ts.
  static getMetaUIDataType(col): any {
    return abstractTypeToMetaUIType(this.getMetaAbstractType(col));
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
        // Mirrors PgUi/MysqlUi/MssqlUi: a bare datetime introspects to
        // CreatedTime.
        return 'CreatedTime';
      case 'time':
        return 'Time';
      case 'string':
        return 'SingleLineText';
      case 'text':
      case 'blob':
        return 'LongText';
      case 'json':
        return 'JSON';
    }
  }

  static getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType) {
    const colProp: any = {};
    switch (col.uidt) {
      case 'ID':
        {
          const isAutoIncId = idType === 'AI';
          const isAutoGenId = idType === 'AG';
          colProp.dt = isAutoGenId ? 'varchar2' : 'number';
          colProp.pk = true;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          if (!isAutoGenId) {
            colProp.dtxp = '11';
            colProp.dtxs = '0';
          }
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'SingleLineText':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'LongText':
        colProp.dt = 'clob';
        break;
      case 'Attachment':
        colProp.dt = 'clob';
        break;
      case 'GeoData':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Checkbox':
        colProp.dt = 'number';
        colProp.dtxp = '1';
        colProp.dtxs = '0';
        colProp.cdf = '0';
        break;
      // Select options can be grouped / filtered with equality — keep them on
      // varchar2 (CLOB columns can't be used in GROUP BY / DISTINCT / UNION).
      case 'MultiSelect':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'SingleSelect':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Collaborator':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Date':
        colProp.dt = 'date';
        break;
      case 'Year':
        colProp.dt = 'number';
        colProp.dtxp = '4';
        colProp.dtxs = '0';
        break;
      case 'Time':
        // Oracle has no time-only type — DATE (time component) is the
        // conventional stand-in.
        colProp.dt = 'date';
        break;
      case 'PhoneNumber':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        colProp.validate = {
          func: ['isURL'],
          args: [''],
          msg: ['Validation failed : isURL'],
        };
        break;
      case 'Number':
        colProp.dt = 'number';
        colProp.dtxp = '38';
        colProp.dtxs = '0';
        break;
      case 'Decimal':
        colProp.dt = 'number';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        break;
      case 'Currency':
        colProp.dt = 'number';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'binary_double';
        break;
      case 'Duration':
        colProp.dt = 'number';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        break;
      case 'Rating':
        colProp.dt = 'number';
        colProp.dtxp = '3';
        colProp.dtxs = '0';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Rollup':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Count':
        colProp.dt = 'number';
        colProp.dtxp = '38';
        colProp.dtxs = '0';
        break;
      case 'Lookup':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
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
        colProp.dt = 'number';
        colProp.dtxp = '38';
        colProp.dtxs = '0';
        colProp.ai = true;
        break;
      case 'Barcode':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'Button':
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
      case 'JSON':
        // Stay 19c-compatible: store JSON as CLOB (the native JSON type is
        // 21c+). CLOB never participates in GROUP BY / DISTINCT, which JSON
        // payloads don't need.
        colProp.dt = 'clob';
        break;
      case 'Meta':
        colProp.dt = 'clob';
        break;
      case 'Order':
        // BigNumber-style fractional row ordering. Match `getNewTableColumns`
        // (number(38,20)).
        colProp.dt = 'number';
        colProp.dtxp = '38';
        colProp.dtxs = '20';
        break;
      case UITypes.Deleted:
        colProp.dt = 'number';
        colProp.dtxp = '1';
        colProp.dtxs = '0';
        break;
      case 'UUID':
        // No native UUID type — store the canonical 36-char text form.
        // (SYS_GUID() returns un-dashed RAW(16), a different format — leave
        // generation to the application.)
        colProp.dt = 'varchar2';
        colProp.dtxp = '36';
        colProp.rqd = false;
        break;
      default:
        colProp.dt = 'varchar2';
        colProp.dtxp = '4000';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt?: UITypes }, idType?: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['char', 'nchar', 'varchar2', 'nvarchar2', 'raw'];
        } else if (idType === 'AI') {
          return ['number'];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return ['char', 'nchar', 'varchar2', 'nvarchar2', 'number'];

      case 'SingleLineText':
      case 'Collaborator':
      case 'PhoneNumber':
      case 'Email':
      case 'Formula':
      case 'Rollup':
      case 'Lookup':
      case 'Barcode':
      case 'Button':
        return ['char', 'nchar', 'varchar2', 'nvarchar2'];

      case 'LongText':
      case 'Attachment':
      case 'GeoData':
      case 'Geometry':
      case 'URL':
      case 'MultiSelect':
      case 'SingleSelect':
      case 'JSON':
      case 'Meta':
        return ['clob', 'nclob', 'varchar2', 'nvarchar2'];

      case 'Checkbox':
      case UITypes.Deleted:
        return ['number', 'boolean'];

      case 'Number':
      case 'AutoNumber':
      case 'Count':
      case 'Rating':
      case 'Year':
        return ['number'];

      case 'Decimal':
      case 'Percent':
      case 'Duration':
      case 'Currency':
      case 'Order':
        return ['number', 'float', 'binary_float', 'binary_double'];

      case 'Date':
        return ['date', 'timestamp'];

      case 'Time':
        return ['date', 'timestamp'];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return [
          'timestamp',
          'timestamp with time zone',
          'timestamp with local time zone',
          'date',
        ];

      case 'User':
      case 'CreatedBy':
      case 'LastModifiedBy':
        return ['char', 'nchar', 'varchar2', 'nvarchar2'];

      case 'UUID':
        return ['varchar2', 'char', 'nchar', 'nvarchar2', 'raw'];

      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [
      // Array functions need a native array type (PostgreSQL-only).
      'ARRAYSORT',
      'ARRAYUNIQUE',
      'ARRAYSLICE',
      'ARRAYCOMPACT',
      'EXP',
      // DATETIME_FORMAT is only implemented for PG, MySQL and SQLite.
      'DATETIME_FORMAT',
      // Checksum functions are only mapped for PostgreSQL and MySQL.
      'MD5',
      'SHA256',
      'SHA512',
    ];
  }

  static getCurrentDateDefault(col: Partial<ColumnType>) {
    if (col.uidt === UITypes.DateTime || col.uidt === UITypes.Date) {
      return 'CURRENT_TIMESTAMP';
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
  //#endregion statics

  //#region methods
  getNewTableColumns(): readonly any[] {
    return OracleUi.getNewTableColumns();
  }
  getNewColumn(suffix: string): {
    column_name: string;
    dt: string;
    dtx: string;
    ct: string;
    nrqd: boolean;
    rqd: boolean;
    ck: boolean;
    pk: boolean;
    un: boolean;
    ai: boolean;
    cdf: null;
    clen: number;
    np: number;
    ns: number;
    dtxp: string;
    dtxs: string;
    altered: number;
    uidt: string;
    uip: string;
    uicn: string;
  } {
    return OracleUi.getNewColumn(suffix);
  }
  getDefaultLengthForDatatype(type: string): number | string {
    return OracleUi.getDefaultLengthForDatatype(type);
  }
  getDefaultLengthIsDisabled(type: string) {
    return OracleUi.getDefaultLengthIsDisabled(type);
  }
  getDefaultValueForDatatype(type: string) {
    return OracleUi.getDefaultValueForDatatype(type);
  }
  getDefaultScaleForDatatype(type: any): string {
    return OracleUi.getDefaultScaleForDatatype(type);
  }
  colPropAIDisabled(col: ColumnType, columns: ColumnType[]): boolean {
    return OracleUi.colPropAIDisabled(col, columns);
  }
  colPropUNDisabled(col: ColumnType): boolean {
    return OracleUi.colPropUNDisabled(col);
  }
  onCheckboxChangeAI(col: ColumnType): void {
    return OracleUi.onCheckboxChangeAI(col);
  }
  showScale(columnObj: ColumnType): boolean {
    return OracleUi.showScale(columnObj);
  }
  removeUnsigned(columns: ColumnType[]): void {
    return OracleUi.removeUnsigned(columns);
  }
  columnEditable(colObj: ColumnType): boolean {
    return OracleUi.columnEditable(colObj);
  }
  onCheckboxChangeAU(col: ColumnType): void {
    return OracleUi.onCheckboxChangeAU(col);
  }
  colPropAuDisabled(col: ColumnType): boolean {
    return OracleUi.colPropAuDisabled(col);
  }
  getAbstractType(col: ColumnType): string {
    return OracleUi.getAbstractType(col);
  }
  getUIType(col: ColumnType): string {
    return OracleUi.getUIType(col);
  }
  getMetaUIDataType(col: ColumnType): UITypes {
    return OracleUi.getMetaUIDataType(col);
  }
  getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType) {
    return OracleUi.getDataTypeForUiType(col, idType);
  }
  getDataTypeListForUiType(col: { uidt: UITypes }, idType?: IDType): string[] {
    return OracleUi.getDataTypeListForUiType(col, idType);
  }
  getUnsupportedFnList(): string[] {
    return OracleUi.getUnsupportedFnList();
  }
  // CLOB-backed types can never be a UNIQUE/index key. The varchar2(4000)
  // text types fit inside Oracle's index-key limit (~6398 bytes on 8K
  // blocks with byte-length semantics), so they stay uniquely-indexable.
  static isUniqueSupportedField(uidt: UITypes): boolean {
    return ![UITypes.LongText, UITypes.Attachment, UITypes.JSON].includes(uidt);
  }
  isUniqueSupportedField(uidt: UITypes): boolean {
    return OracleUi.isUniqueSupportedField(uidt);
  }
  getCurrentDateDefault(_col: Partial<ColumnType>) {
    return OracleUi.getCurrentDateDefault(_col);
  }
  isEqual(dataType1: string, dataType2: string): boolean {
    return OracleUi.isEqual(dataType1, dataType2);
  }
  adjustLengthAndScale(
    _newColumn: Partial<ColumnType>,
    _oldColumn?: ColumnType
  ) {}
  isParsedJsonReturnType(col: ColumnType): boolean {
    return ['json'].includes(col.dt?.toLowerCase());
  }
  get tableNameLengthLimit(): number {
    // 12.2+ identifier limit. (Pre-12.2 was 30 — not targeted.)
    return 128;
  }
  //#endregion methods
}
