import { ButtonActionsType, ColumnReqType, ColumnType, TableType } from './Api';
import { FormulaDataTypes } from './formulaHelpers';
import { LongTextAiMetaProp, RelationTypes } from '~/lib/globals';
import { parseProp } from './helperFunctions';

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
  Order = 'Order',
}

export const UITypesName = {
  [UITypes.ID]: 'ID',
  [UITypes.LinkToAnotherRecord]: 'Link to another record',
  [UITypes.ForeignKey]: 'Foreign key',
  [UITypes.Order]: 'Order',
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
  AIButton: 'AI Button',
  AIPrompt: 'AI Prompt',
};

export const columnTypeName = (column?: ColumnType) => {
  if (!column) return '';

  switch (column.uidt) {
    case UITypes.LongText: {
      if (parseProp(column.meta)?.richMode) {
        return UITypesName.RichText;
      }

      if (parseProp(column.meta)[LongTextAiMetaProp]) {
        return UITypesName.AIPrompt;
      }

      return UITypesName[column.uidt];
    }
    case UITypes.Button: {
      if (
        column.uidt === UITypes.Button &&
        (column?.colOptions as any)?.type === 'ai'
      ) {
        return UITypesName.AIButton;
      }

      return UITypesName[column.uidt];
    }
    default: {
      return column.uidt ? UITypesName[column.uidt] : '';
    }
  }
};

export const FieldNameFromUITypes: Record<UITypes, string> = {
  [UITypes.ID]: 'ID',
  [UITypes.LinkToAnotherRecord]: '{TableName}',
  [UITypes.ForeignKey]: 'Foreign key',
  [UITypes.Lookup]: '{FieldName} (from {TableName})',
  [UITypes.SingleLineText]: 'Text',
  [UITypes.LongText]: 'Notes',
  [UITypes.Attachment]: 'Attachment',
  [UITypes.Checkbox]: 'Done',
  [UITypes.MultiSelect]: 'Tags',
  [UITypes.SingleSelect]: 'Status',
  [UITypes.Collaborator]: 'User',
  [UITypes.Date]: 'Date',
  [UITypes.Year]: 'Year',
  [UITypes.Time]: 'Time',
  [UITypes.PhoneNumber]: 'Phone',
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
  [UITypes.Rollup]: '{RollupFunction}({FieldName}) from {TableName}',
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
  [UITypes.Links]: '{TableName}',
  [UITypes.User]: 'User',
  [UITypes.CreatedBy]: 'Created by',
  [UITypes.LastModifiedBy]: 'Last modified by',
  [UITypes.Order]: 'Order',
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
    UITypes.Button,
    // UITypes.Count,
  ].includes(<UITypes>(typeof col === 'object' ? col?.uidt : col));
}

export function isAIPromptCol(col: ColumnReqType | ColumnType) {
  return (
    col.uidt === UITypes.LongText &&
    parseProp((col as any)?.meta)?.[LongTextAiMetaProp]
  );
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

export function isOrderCol(
  col:
    | UITypes
    | { readonly uidt: UITypes | string }
    | ColumnReqType
    | ColumnType
) {
  return [UITypes.Order].includes(
    <UITypes>(typeof col === 'object' ? col?.uidt : col)
  );
}

export function isActionButtonCol(
  col: (ColumnReqType | ColumnType) & {
    colOptions?: any;
  }
) {
  return (
    col.uidt === UITypes.Button &&
    [
      ButtonActionsType.Script,
      ButtonActionsType.Webhook,
      ButtonActionsType.Ai,
    ].includes((col?.colOptions as any)?.type)
  );
}

export function isHiddenCol(
  col: (ColumnReqType | ColumnType) & {
    colOptions?: any;
    system?: number | boolean;
  },
  tableMeta: Partial<TableType>
) {
  if (!col.system) return false;

  // hide belongs to column in mm tables only
  if (col.uidt === UITypes.LinkToAnotherRecord) {
    if (col.colOptions?.type === RelationTypes.BELONGS_TO && tableMeta?.mm) {
      return true;
    }
    // hide system columns in other tables which are has-many used for mm
    return col.colOptions?.type === RelationTypes.HAS_MANY;
  }

  if (col.uidt === UITypes.Order) {
    return true;
  }

  return ([UITypes.CreatedBy, UITypes.LastModifiedBy] as string[]).includes(
    col.uidt
  );
}

export function isLinksOrLTAR(
  colOrUidt: ColumnType | { uidt: UITypes | string } | UITypes | string
) {
  return [UITypes.LinkToAnotherRecord, UITypes.Links].includes(
    <UITypes>(typeof colOrUidt === 'object' ? colOrUidt?.uidt : colOrUidt)
  );
}

export const getEquivalentUIType = ({
  formulaColumn,
}: {
  formulaColumn: ColumnType;
}): void | UITypes => {
  switch ((formulaColumn?.colOptions as any)?.parsed_tree?.dataType) {
    case FormulaDataTypes.NUMERIC:
      return UITypes.Number;
    case FormulaDataTypes.DATE:
      return UITypes.DateTime;
    case FormulaDataTypes.LOGICAL:
    case FormulaDataTypes.COND_EXP:
    case FormulaDataTypes.BOOLEAN:
      return UITypes.Checkbox;
  }
};

export const isSelectTypeCol = (
  colOrUidt: ColumnType | { uidt: UITypes | string } | UITypes | string
) => {
  return [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User].includes(
    <UITypes>(typeof colOrUidt === 'object' ? colOrUidt?.uidt : colOrUidt)
  );
};
export default UITypes;

export const readonlyMetaAllowedTypes = [
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
  UITypes.Button,
  UITypes.Barcode,
  UITypes.QrCode,
];

export const partialUpdateAllowedTypes = [
  // Single/Multi select is disabled for now since it involves updating type in some cases
  // UITypes.SingleSelect,
  // UITypes.MultiSelect,
  UITypes.Checkbox,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Rating,
  UITypes.DateTime,
  UITypes.Date,
  UITypes.Time,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.PhoneNumber,
  UITypes.Email,
  UITypes.URL,
];

export const getUITypesForFormulaDataType = (
  dataType: FormulaDataTypes
): UITypes[] => {
  switch (dataType) {
    case FormulaDataTypes.NUMERIC:
      return [
        UITypes.Decimal,
        UITypes.Currency,
        UITypes.Percent,
        UITypes.Rating,
      ];
    case FormulaDataTypes.DATE:
      return [UITypes.DateTime, UITypes.Date, UITypes.Time];
    case FormulaDataTypes.BOOLEAN:
    case FormulaDataTypes.COND_EXP:
      return [UITypes.Checkbox];
    case FormulaDataTypes.STRING:
      return [UITypes.Email, UITypes.URL, UITypes.PhoneNumber];
    default:
      return [];
  }
};

export const isSupportedDisplayValueColumn = (column: Partial<ColumnType>) => {
  if (!column?.uidt) return false;

  switch (column.uidt) {
    case UITypes.SingleLineText:
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.Time:
    case UITypes.Year:
    case UITypes.PhoneNumber:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.Number:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Decimal:
    case UITypes.Formula: {
      return true;
    }
    case UITypes.LongText: {
      if (
        parseProp(column.meta)?.richMode ||
        parseProp(column.meta)[LongTextAiMetaProp]
      ) {
        return false;
      }
      return true;
    }

    default: {
      return false;
    }
  }
};

export const checkboxIconList = [
  {
    checked: 'mdi-check-bold',
    unchecked: 'mdi-crop-square',
    label: 'square',
  },
  {
    checked: 'mdi-check-circle-outline',
    unchecked: 'mdi-checkbox-blank-circle-outline',
    label: 'circle-check',
  },
  {
    checked: 'mdi-star',
    unchecked: 'mdi-star-outline',
    label: 'star',
  },
  {
    checked: 'mdi-heart',
    unchecked: 'mdi-heart-outline',
    label: 'heart',
  },
  {
    checked: 'mdi-moon-full',
    unchecked: 'mdi-moon-new',
    label: 'circle-filled',
  },
  {
    checked: 'mdi-thumb-up',
    unchecked: 'mdi-thumb-up-outline',
    label: 'thumbs-up',
  },
  {
    checked: 'mdi-flag',
    unchecked: 'mdi-flag-outline',
    label: 'flag',
  },
];

export const ratingIconList = [
  {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
    label: 'star',
  },
  {
    full: 'mdi-heart',
    empty: 'mdi-heart-outline',
    label: 'heart',
  },
  {
    full: 'mdi-moon-full',
    empty: 'mdi-moon-new',
    label: 'circle-filled',
  },
  {
    full: 'mdi-thumb-up',
    empty: 'mdi-thumb-up-outline',
    label: 'thumbs-up',
  },
  {
    full: 'mdi-flag',
    empty: 'mdi-flag-outline',
    label: 'flag',
  },
];

export const durationOptions = [
  {
    id: 0,
    title: 'h:mm',
    example: '(e.g. 1:23)',
    regex: /(\d+)(?::(\d+))?/,
  },
  {
    id: 1,
    title: 'h:mm:ss',
    example: '(e.g. 3:45, 1:23:40)',
    regex: /(?=\d)(\d+)?(?::(\d+))?(?::(\d+))?/,
  },
  {
    id: 2,
    title: 'h:mm:ss.s',
    example: '(e.g. 3:34.6, 1:23:40.0)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 3,
    title: 'h:mm:ss.ss',
    example: '(e.g. 3.45.67, 1:23:40.00)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 4,
    title: 'h:mm:ss.sss',
    example: '(e.g. 3.45.678, 1:23:40.000)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
];
