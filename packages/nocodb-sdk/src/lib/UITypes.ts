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
  CreateTime = 'CreateTime',
  LastModifiedTime = 'LastModifiedTime',
  AutoNumber = 'AutoNumber',
  Geometry = 'Geometry',
  JSON = 'JSON',
  SpecificDBType = 'SpecificDBType',
  Barcode = 'Barcode',
  QrCode = 'QrCode',
  Button = 'Button',
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
    // UITypes.Count,
  ].includes(<UITypes>(typeof col === 'object' ? col?.uidt : col));
}

export default UITypes;
