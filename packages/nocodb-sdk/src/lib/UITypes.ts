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

export const UITypesName = {
  [UITypes.ID]: 'ID',
  [UITypes.LinkToAnotherRecord]: 'Link to another record',
  [UITypes.ForeignKey]: 'Foreign key',
  [UITypes.Lookup]: 'Lookup',
  [UITypes.SingleLineText]: 'Single line text',
  [UITypes.LongText]: 'Long text',
  RichText: 'Rich text',
  [UITypes.Attachment]: 'Attachment',
  [UITypes.Checkbox]: 'Checkbox',
  [UITypes.MultiSelect]: 'Multi select',
  [UITypes.SingleSelect]: 'Single select',
  [UITypes.Collaborator]: 'Collaborator',
  [UITypes.Date]: 'Date',
  [UITypes.Year]: 'Year',
  [UITypes.Time]: 'Time',
  [UITypes.PhoneNumber]: 'Phone number',
  [UITypes.GeoData]: 'Geo data',
  [UITypes.Email]: 'Email',
  [UITypes.URL]: 'URL',
  [UITypes.Number]: 'Number',
  [UITypes.Decimal]: 'Decimal',
  [UITypes.Currency]: 'Currency',
  [UITypes.Percent]: 'Percent',
  [UITypes.Duration]: 'Duration',
  [UITypes.Rating]: 'Rating',
  [UITypes.Formula]: 'Formula',
  [UITypes.Rollup]: 'Rollup',
  [UITypes.Count]: 'Count',
  [UITypes.DateTime]: 'Date time',
  [UITypes.CreatedTime]: 'Created time',
  [UITypes.LastModifiedTime]: 'Last modified time',
  [UITypes.AutoNumber]: 'Auto number',
  [UITypes.Geometry]: 'Geometry',
  [UITypes.JSON]: 'JSON',
  [UITypes.SpecificDBType]: 'Specific DB type',
  [UITypes.Barcode]: 'Barcode',
  [UITypes.QrCode]: 'Qr code',
  [UITypes.Button]: 'Button',
  [UITypes.Links]: 'Links',
  [UITypes.User]: 'User',
  [UITypes.CreatedBy]: 'Created by',
  [UITypes.LastModifiedBy]: 'Last modified by',
};

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

export function isLinksOrLTAR(
  colOrUidt: ColumnType | { uidt: UITypes | string } | UITypes | string
) {
  return [UITypes.LinkToAnotherRecord, UITypes.Links].includes(
    <UITypes>(typeof colOrUidt === 'object' ? colOrUidt?.uidt : colOrUidt)
  );
}

export default UITypes;
