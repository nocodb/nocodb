import { ColumnType, IDType } from '~/lib';
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

  getDataTypeForUiType(col: { uidt: UITypes }, idType?: IDType): any;
  getDataTypeListForUiType(col: { uidt: UITypes }, idType?: IDType): string[];

  getUnsupportedFnList(): string[];
  getCurrentDateDefault(_col: Partial<ColumnType>): string | any;
  isEqual(dataType1: string, dataType2: string): boolean;
  adjustLengthAndScale(
    newColumn: Partial<ColumnType>,
    oldColumn?: ColumnType
  ): void;

  isParsedJsonReturnType(col: ColumnType): boolean;
}
