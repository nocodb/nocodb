import { ColumnReqType, ColumnType } from './Api';

enum UITypes {
  ID = 'ID',
  LinkToAnotherRecord = 'LinkToAnotherRecord',
  ForeignKey = 'ForeignKey',
  Lookup = 'Lookup',
  SingleLineText = 'SingleLineText',
  LongText = 'LongText',
  Attachment = 'Attachment',
  Checkbox = 'Checkbox',
  MultiSelect = 'MultiSelect',
  SingleSelect = 'SingleSelect',
  Collaborator = 'Collaborator',
  Date = 'Date',
  Year = 'Year',
  Time = 'Time',
  PhoneNumber = 'PhoneNumber',
  GeoData = 'GeoData',
  Email = 'Email',
  URL = 'URL',
  Number = 'Number',
  Decimal = 'Decimal',
  Currency = 'Currency',
  Percent = 'Percent',
  Duration = 'Duration',
  Rating = 'Rating',
  Formula = 'Formula',
  Rollup = 'Rollup',
  Count = 'Count',
  DateTime = 'DateTime',
  CreatedTime = 'CreatedTime',
  LastModifiedTime = 'LastModifiedTime',
  AutoNumber = 'AutoNumber',
  Geometry = 'Geometry',
  JSON = 'JSON',
  SpecificDBType = 'SpecificDBType',
  Barcode = 'Barcode',
  QrCode = 'QrCode',
  Button = 'Button',
  Links = 'Links',
  User = 'User',
  CreatedBy = 'CreatedBy',
  LastModifiedBy = 'LastModifiedBy',
}

export const numericUITypes = [
  UITypes.Duration,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Rating,
  UITypes.Rollup,
  UITypes.Year,
  UITypes.Links,
];

export function isNumericCol(
  col:
    | UITypes
    | { readonly uidt: UITypes | string }
    | ColumnReqType
    | ColumnType
) {
  return numericUITypes.includes(
    <UITypes>(typeof col === 'object' ? col?.uidt : col)
  );
}

export function isVirtualCol(
  col:
    | UITypes
    | { readonly uidt: UITypes | string }
    | ColumnReqType
    | ColumnType
) {
  return [
    // Shouldn't be treated as virtual column (Issue with SQL View column data display)
    // UITypes.SpecificDBType,
    UITypes.LinkToAnotherRecord,
    UITypes.Formula,
    UITypes.QrCode,
    UITypes.Barcode,
    UITypes.Rollup,
    UITypes.Lookup,
    UITypes.Links,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
    UITypes.CreatedBy,
    UITypes.LastModifiedBy,
    // UITypes.Count,
  ].includes(<UITypes>(typeof col === 'object' ? col?.uidt : col));
}
export function isCreatedOrLastModifiedTimeCol(
  col:
    | UITypes
    | { readonly uidt: UITypes | string }
    | ColumnReqType
    | ColumnType
) {
  return [UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
    <UITypes>(typeof col === 'object' ? col?.uidt : col)
  );
}

export function isCreatedOrLastModifiedByCol(
  col:
    | UITypes
    | { readonly uidt: UITypes | string }
    | ColumnReqType
    | ColumnType
) {
  return [UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
    <UITypes>(typeof col === 'object' ? col?.uidt : col)
  );
}

export function isMMSystemCol(
  col: (ColumnReqType | ColumnType) & { system?: number | boolean }
) {
  return (
    col.system && [UITypes.LinkToAnotherRecord].includes(<UITypes>col.uidt)
  );
}

export function isLinksOrLTAR(
  colOrUidt: ColumnType | { uidt: UITypes | string } | UITypes | string
) {
  return [UITypes.LinkToAnotherRecord, UITypes.Links].includes(
    <UITypes>(typeof colOrUidt === 'object' ? colOrUidt?.uidt : colOrUidt)
  );
}

export default UITypes;
