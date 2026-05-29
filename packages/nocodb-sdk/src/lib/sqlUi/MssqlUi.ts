import UITypes from '../UITypes';
import { abstractTypeToMetaUIType } from './metaUiDataType';
import { IDType } from './index';
import { ColumnType } from '~/lib/Api';
import { SqlUi } from './SqlUI.types';

// Microsoft SQL Server data types surfaced in the column-type picker.
// Must stay in sync with MssqlClient.getKnexDataTypes (backend).
const dbTypes = [
  // exact numerics
  'bigint',
  'bit',
  'decimal',
  'int',
  'money',
  'numeric',
  'smallint',
  'smallmoney',
  'tinyint',
  // approximate numerics
  'float',
  'real',
  // date & time
  'date',
  'datetime',
  'datetime2',
  'datetimeoffset',
  'smalldatetime',
  'time',
  // character strings
  'char',
  'varchar',
  'text',
  // unicode character strings
  'nchar',
  'nvarchar',
  'ntext',
  // binary strings
  'binary',
  'varbinary',
  'image',
  // other
  'uniqueidentifier',
  'xml',
  'json',
  'geography',
  'geometry',
  'hierarchyid',
  'sql_variant',
  'rowversion',
  'timestamp',
  // SQL Server 2025+ — k-NN / similarity search. Stored as a fixed-length
  // float vector; tedious returns as a string of comma-separated floats
  // wrapped in brackets (e.g. `[1.0, 2.0, 3.0]`). Treated as opaque string
  // for read; column-create from NocoDB requires the user to specify
  // dimensions explicitly via dtxp (no sensible default).
  'vector',
];

export class MssqlUi implements SqlUi {
  //#region statics
  static getNewTableColumns() {
    return [
      {
        column_name: 'id',
        title: 'Id',
        dt: 'int',
        dtx: 'integer',
        ct: 'int',
        nrqd: false,
        rqd: true,
        ck: false,
        pk: true,
        un: false,
        ai: true,
        cdf: null,
        clen: null,
        np: 10,
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
        dt: 'nvarchar',
        dtx: 'specificType',
        ct: 'nvarchar(MAX)',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: null,
        clen: -1,
        np: null,
        ns: null,
        dtxp: 'MAX',
        dtxs: '',
        altered: 1,
        uidt: 'SingleLineText',
        uip: '',
        uicn: '',
      },
      {
        column_name: 'created_at',
        title: 'CreatedAt',
        dt: 'datetime2',
        dtx: 'specificType',
        ct: 'datetime2',
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
        dt: 'datetime2',
        dtx: 'specificType',
        ct: 'datetime2',
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
        dt: 'nvarchar',
        dtx: 'specificType',
        ct: 'nvarchar(45)',
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
        dt: 'nvarchar',
        dtx: 'specificType',
        ct: 'nvarchar(45)',
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
        dtx: 'specificType',
        ct: 'decimal(38,20)',
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
        dtxp: '38,20',
        dtxs: '',
        altered: 1,
        uidt: UITypes.Order,
        uip: '',
        uicn: '',
        system: true,
      },
      {
        column_name: '__nc_deleted',
        title: '__nc_deleted',
        dt: 'bit',
        dtx: 'specificType',
        ct: 'bit',
        nrqd: true,
        rqd: false,
        ck: false,
        pk: false,
        un: false,
        ai: false,
        cdf: '0',
        clen: null,
        np: null,
        ns: null,
        dtxp: '',
        dtxs: '',
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
      dt: 'nvarchar',
      dtx: 'specificType',
      ct: 'nvarchar(MAX)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: -1,
      np: null,
      ns: null,
      dtxp: 'MAX',
      dtxs: '',
      altered: 1,
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
    };
  }

  static getDefaultLengthForDatatype(type): any {
    switch (type) {
      case 'char':
      case 'varchar':
      case 'nchar':
      case 'nvarchar':
      case 'binary':
      case 'varbinary':
        return 255;
      default:
        return '';
    }
  }

  static getDefaultLengthIsDisabled(type): any {
    switch (type) {
      case 'char':
      case 'varchar':
      case 'nchar':
      case 'nvarchar':
      case 'binary':
      case 'varbinary':
      case 'decimal':
      case 'numeric':
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
      case 'decimal':
      case 'numeric':
      case 'float':
      case 'real':
      case 'money':
      case 'smallmoney':
        return '2';
      default:
        return ' ';
    }
  }

  static colPropAIDisabled(col, columns) {
    // SQL Server IDENTITY is only valid on integer family columns,
    // and at most one column per table can be IDENTITY.
    if (
      col.dt === 'int' ||
      col.dt === 'bigint' ||
      col.dt === 'smallint' ||
      col.dt === 'tinyint'
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
    // SQL Server has no UNSIGNED modifier.
    return true;
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
  }

  static onCheckboxChangeAU(col) {
    col.altered = col.altered || 2;
    if (col.au) {
      col.cdf = 'GETDATE()';
    }
  }

  static showScale(_columnObj) {
    return false;
  }

  static removeUnsigned(columns) {
    // SQL Server has no UNSIGNED — always clear the flag on altered columns.
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
      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'datetimeoffset':
      case 'time':
        return false;
      default:
        return true;
    }
  }

  static getAbstractType(col): any {
    switch ((col.dt || col.dt_s)?.toLowerCase()) {
      case 'bigint':
      case 'int':
      case 'smallint':
      case 'tinyint':
        return 'integer';

      // SQL Server `bit` is a 0/1 boolean (NocoDB Checkbox), not an integer.
      case 'bit':
        return 'boolean';

      case 'decimal':
      case 'numeric':
      case 'money':
      case 'smallmoney':
      case 'float':
      case 'real':
        return 'float';

      case 'date':
        return 'date';

      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'datetimeoffset':
        return 'datetime';

      case 'time':
        return 'time';

      case 'char':
      case 'varchar':
      case 'nchar':
      case 'nvarchar':
      case 'uniqueidentifier':
      case 'xml':
      case 'sql_variant':
      case 'hierarchyid':
      case 'geography':
      case 'geometry':
        return 'string';

      case 'text':
      case 'ntext':
        return 'text';

      // NOTE: SQL Server `timestamp`/`rowversion` is an 8-byte binary
      // row-version value — NOT a date/time. Treat as a string.
      case 'binary':
      case 'varbinary':
      case 'image':
      case 'rowversion':
      case 'timestamp':
        return 'string';

      case 'json':
        return 'json';
    }
    return 'string';
  }

  // Introspection UIType for meta-sync — the legacy ModelXcMetaMssql.getUIDataType
  // (it inherited the PG abstract→UIType map, and the MSSQL getAbstractType which
  // equals this class's getAbstractType). Distinct from getUIType
  // (column-creation default). See metaUiDataType.ts.
  static getMetaUIDataType(col): any {
    return abstractTypeToMetaUIType(this.getAbstractType(col));
  }

  static getUIType(col): any {
    // (n)varchar(max) introspects with clen normalized to null (was -1) —
    // treat unbounded character columns as LongText rather than SingleLineText.
    const dt = (col?.dt || '').toLowerCase();
    if (
      (dt === 'nvarchar' || dt === 'varchar') &&
      (col?.clen === null || col?.clen === -1)
    ) {
      return 'LongText';
    }
    if (dt === 'uniqueidentifier') {
      return 'UUID';
    }
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
        // Mirrors PgUi/MysqlUi: a bare datetime introspects to CreatedTime.
        // TODO(phase-1): verify against real MSSQL tables; may prefer DateTime.
        return 'CreatedTime';
      case 'time':
        return 'Time';
      case 'string':
        return 'SingleLineText';
      case 'text':
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
          colProp.dt = isAutoGenId ? 'nvarchar' : 'int';
          colProp.pk = true;
          colProp.ai = isAutoIncId;
          colProp.rqd = true;
          colProp.meta = isAutoGenId ? { ag: 'nc' } : undefined;
        }
        break;
      case 'ForeignKey':
        colProp.dt = 'nvarchar';
        break;
      case 'SingleLineText':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'LongText':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Attachment':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'GeoData':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Checkbox':
        colProp.dt = 'bit';
        colProp.cdf = '0';
        break;
      case 'MultiSelect':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'SingleSelect':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Collaborator':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
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
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        colProp.validate = {
          func: ['isMobilePhone'],
          args: [''],
          msg: ['Validation failed : isMobilePhone'],
        };
        break;
      case 'Email':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        colProp.validate = {
          func: ['isEmail'],
          args: [''],
          msg: ['Validation failed : isEmail'],
        };
        break;
      case 'URL':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
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
        // T-SQL `decimal` without precision/scale resolves to `decimal(18, 0)`
        // — fractional values truncate ("12.34" stored as 12). Default to
        // (18, 4) so 4 decimal places fit;
        colProp.dt = 'decimal';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        break;
      case 'Currency':
        colProp.dt = 'decimal';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        colProp.validate = {
          func: ['isCurrency'],
          args: [''],
          msg: ['Validation failed : isCurrency'],
        };
        break;
      case 'Percent':
        colProp.dt = 'float';
        break;
      case 'Duration':
        colProp.dt = 'decimal';
        colProp.dtxp = '18';
        colProp.dtxs = '4';
        break;
      case 'Rating':
        colProp.dt = 'smallint';
        colProp.cdf = '0';
        break;
      case 'Formula':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Rollup':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Count':
        colProp.dt = 'bigint';
        break;
      case 'Lookup':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'DateTime':
        colProp.dt = 'datetime2';
        break;
      case 'CreatedTime':
        colProp.dt = 'datetime2';
        break;
      case 'LastModifiedTime':
        colProp.dt = 'datetime2';
        break;
      case 'AutoNumber':
        colProp.dt = 'bigint';
        colProp.ai = true;
        break;
      case 'Barcode':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Button':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'JSON':
        // SQL Server has no scalar JSON type before 2025 — store as
        // `nvarchar(max)` rather than the deprecated `ntext`. nvarchar(max)
        // supports the full set of string operators (=, DISTINCT, GROUP BY,
        // ORDER BY, LIKE) directly, while ntext requires CAST workarounds.
        // Existing ntext columns introspected via meta-sync still map to
        // JSON / LongText and continue to work via the legacy CAST paths.
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Meta':
        colProp.dt = 'nvarchar';
        colProp.dtxp = 'MAX';
        break;
      case 'Order':
        // BigNumber-style fractional row ordering. Match `getNewTableColumns`
        // (decimal(38, 20)). Without explicit precision, decimal defaults to
        // (18, 0) and loses every fractional reorder.
        colProp.dt = 'decimal';
        colProp.dtxp = '38';
        colProp.dtxs = '20';
        break;
      case UITypes.Deleted:
        colProp.dt = 'bit';
        break;
      case 'UUID':
        colProp.dt = 'uniqueidentifier';
        colProp.cdf = 'NEWID()';
        colProp.rqd = false;
        break;
      default:
        colProp.dt = 'nvarchar';
        break;
    }
    return colProp;
  }

  static getDataTypeListForUiType(col: { uidt?: UITypes }, idType?: IDType) {
    switch (col.uidt) {
      case 'ID':
        if (idType === 'AG') {
          return ['char', 'nchar', 'varchar', 'nvarchar', 'uniqueidentifier'];
        } else if (idType === 'AI') {
          return ['int', 'bigint', 'smallint', 'tinyint'];
        } else {
          return dbTypes;
        }
      case 'ForeignKey':
        return ['char', 'nchar', 'varchar', 'nvarchar', 'int', 'bigint'];

      case 'SingleLineText':
      case 'Collaborator':
      case 'PhoneNumber':
      case 'Email':
      case 'Formula':
      case 'Rollup':
      case 'Lookup':
      case 'Barcode':
      case 'Button':
        return ['char', 'nchar', 'varchar', 'nvarchar'];

      case 'LongText':
      case 'Attachment':
      case 'GeoData':
      case 'URL':
      case 'MultiSelect':
      case 'SingleSelect':
      case 'JSON':
      case 'Meta':
        return ['text', 'ntext', 'varchar', 'nvarchar'];

      case 'Checkbox':
      case UITypes.Deleted:
        return ['bit', 'tinyint', 'int'];

      case 'Number':
      case 'AutoNumber':
      case 'Count':
        return ['int', 'bigint', 'smallint', 'tinyint'];

      case 'Rating':
      case 'Year':
        return ['int', 'smallint', 'tinyint'];

      case 'Decimal':
      case 'Percent':
      case 'Duration':
        return ['decimal', 'numeric', 'float', 'real'];

      case 'Currency':
        return ['decimal', 'numeric', 'money', 'smallmoney'];

      case 'Order':
        return ['decimal', 'numeric'];

      case 'Date':
        return ['date'];

      case 'Time':
        return ['time'];

      case 'DateTime':
      case 'CreatedTime':
      case 'LastModifiedTime':
        return ['datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'];

      case 'CreatedBy':
      case 'LastModifiedBy':
        return ['char', 'nchar', 'varchar', 'nvarchar'];

      case 'UUID':
        return ['uniqueidentifier', 'char', 'nchar', 'varchar', 'nvarchar'];

      default:
        return dbTypes;
    }
  }

  static getUnsupportedFnList() {
    return [
      // Array functions need a native array type (PostgreSQL-only); SQL Server,
      // like MySQL, has none.
      'ARRAYSORT',
      'ARRAYUNIQUE',
      'ARRAYSLICE',
      'ARRAYCOMPACT',
      // SQL Server has no native regex engine before 2025 (no T-SQL equivalent
      // of REGEXP/REGEXP_REPLACE on 2016-2022).
      'REGEX_MATCH',
      'REGEX_EXTRACT',
      'REGEX_REPLACE',
      // VALUE parses a number out of an arbitrary string, which the other
      // dialects do with regex cleanup — not feasible on SQL Server <2025
      // without a CLR/UDF, so it's unsupported for now.
      'VALUE',
    ];
  }

  static getCurrentDateDefault(col: Partial<ColumnType>) {
    if (col.uidt === UITypes.DateTime || col.uidt === UITypes.Date) {
      return 'GETDATE()';
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
    return MssqlUi.getNewTableColumns();
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
    return MssqlUi.getNewColumn(suffix);
  }
  getDefaultLengthForDatatype(type: string): number | string {
    return MssqlUi.getDefaultLengthForDatatype(type);
  }
  getDefaultLengthIsDisabled(type: string) {
    return MssqlUi.getDefaultLengthIsDisabled(type);
  }
  getDefaultValueForDatatype(type: string) {
    return MssqlUi.getDefaultValueForDatatype(type);
  }
  getDefaultScaleForDatatype(type: any): string {
    return MssqlUi.getDefaultScaleForDatatype(type);
  }
  colPropAIDisabled(col: ColumnType, columns: ColumnType[]): boolean {
    return MssqlUi.colPropAIDisabled(col, columns);
  }
  colPropUNDisabled(col: ColumnType): boolean {
    return MssqlUi.colPropUNDisabled(col);
  }
  onCheckboxChangeAI(col: ColumnType): void {
    return MssqlUi.onCheckboxChangeAI(col);
  }
  showScale(columnObj: ColumnType): boolean {
    return MssqlUi.showScale(columnObj);
  }
  removeUnsigned(columns: ColumnType[]): void {
    return MssqlUi.removeUnsigned(columns);
  }
  columnEditable(colObj: ColumnType): boolean {
    return MssqlUi.columnEditable(colObj);
  }
  onCheckboxChangeAU(col: ColumnType): void {
    return MssqlUi.onCheckboxChangeAU(col);
  }
  colPropAuDisabled(col: ColumnType): boolean {
    return MssqlUi.colPropAuDisabled(col);
  }
  getAbstractType(col: ColumnType): string {
    return MssqlUi.getAbstractType(col);
  }
  getUIType(col: ColumnType): string {
    return MssqlUi.getUIType(col);
  }
  getMetaUIDataType(col: ColumnType): UITypes {
    return MssqlUi.getMetaUIDataType(col);
  }
  getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType) {
    return MssqlUi.getDataTypeForUiType(col, idType);
  }
  getDataTypeListForUiType(col: { uidt: UITypes }, idType?: IDType): string[] {
    return MssqlUi.getDataTypeListForUiType(col, idType);
  }
  getUnsupportedFnList(): string[] {
    return MssqlUi.getUnsupportedFnList();
  }
  // SQL Server unique support is per-type: the `nvarchar(MAX)`-backed text
  // types (SingleLineText/Email/PhoneNumber/URL) can't be a UNIQUE/index key,
  // but the fixed-size numeric/date/uuid types can. Return false only for the
  // MAX-backed text types; everything else is uniquely-indexable.
  static isUniqueSupportedField(uidt: UITypes): boolean {
    return ![
      UITypes.SingleLineText,
      UITypes.Email,
      UITypes.PhoneNumber,
      UITypes.URL,
    ].includes(uidt);
  }
  isUniqueSupportedField(uidt: UITypes): boolean {
    return MssqlUi.isUniqueSupportedField(uidt);
  }
  getCurrentDateDefault(_col: Partial<ColumnType>) {
    return MssqlUi.getCurrentDateDefault(_col);
  }
  isEqual(dataType1: string, dataType2: string): boolean {
    return MssqlUi.isEqual(dataType1, dataType2);
  }
  adjustLengthAndScale(
    _newColumn: Partial<ColumnType>,
    _oldColumn?: ColumnType,
  ) {}
  isParsedJsonReturnType(col: ColumnType): boolean {
    return ['json'].includes(col.dt?.toLowerCase());
  }
  get tableNameLengthLimit(): number {
    return 128;
  }
  //#endregion methods
}
