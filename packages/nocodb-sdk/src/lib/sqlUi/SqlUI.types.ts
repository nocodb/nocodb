import { ColumnType } from '~/lib/Api';
import { IDType } from './index';
import UITypes from '~/lib/UITypes';

export interface SqlUi {
  getNewTableColumns(): readonly any[];

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
  };

  getDefaultLengthForDatatype(type: string): number | string;

  // TODO: change any to better type
  getDefaultLengthIsDisabled(type: string): any;
  getDefaultValueForDatatype(type: string): any;

  getDefaultScaleForDatatype(type): string;
  colPropAIDisabled(col: ColumnType, columns: ColumnType[]): boolean;
  colPropUNDisabled(col: ColumnType): boolean;

  onCheckboxChangeAI(col: ColumnType): void;

  showScale(columnObj: ColumnType): boolean;
  removeUnsigned(columns: ColumnType[]): void;
  columnEditable(colObj: ColumnType): boolean;

  onCheckboxChangeAU(col: ColumnType): void;

  colPropAuDisabled(col: ColumnType): boolean;

  getAbstractType(col: ColumnType): string;

  getUIType(col: ColumnType): string;

  // UIType for an introspected DB column during meta-sync (legacy
  // ModelXcMeta.getUIDataType behaviour). Distinct from getUIType — see
  // metaUiDataType.ts.
  getMetaUIDataType(col: ColumnType): UITypes;

  getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType): any;
  getDataTypeListForUiType(col: { uidt: UITypes }, idType?: IDType): string[];

  getUnsupportedFnList(): string[];
  /**
   * Whether this dialect supports a NocoDB UNIQUE constraint on the given
   * field type. Optional — when absent, unique is allowed for every type in
   * UNIQUE_CONSTRAINT_SUPPORTED_TYPES (pg/mysql/sqlite).
   * MSSQL returns false for the `nvarchar(MAX)`-backed text types
   * (SingleLineText/Email/PhoneNumber/URL — can't be a UNIQUE/index key) but
   * true for the fixed-size numeric/date/uuid types.
   */
  isUniqueSupportedField?(uidt: UITypes): boolean;
  getCurrentDateDefault(_col: Partial<ColumnType>): string | any;
  isEqual(dataType1: string, dataType2: string): boolean;
  adjustLengthAndScale(
    newColumn: Partial<ColumnType>,
    oldColumn?: ColumnType
  ): void;

  isParsedJsonReturnType(col: ColumnType): boolean;

  get tableNameLengthLimit(): number;
}
