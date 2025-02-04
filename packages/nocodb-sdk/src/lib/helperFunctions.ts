import UITypes, { isNumericCol } from './UITypes';
import { RolesObj, RolesType } from './globals';
import { ClientType } from './enums';
import { ColumnType, FormulaType, IntegrationsType } from './Api';
import { FormulaDataTypes } from './formulaHelpers';

// import {RelationTypes} from "./globals";

// const systemCols = ['created_at', 'updated_at']
const filterOutSystemColumns = (columns) => {
  return (columns && columns.filter((c) => !isSystemColumn(c))) || [];
};
const getSystemColumnsIds = (columns) => {
  return ((columns && columns.filter(isSystemColumn)) || []).map((c) => c.id);
};

const getSystemColumns = (columns) => columns.filter(isSystemColumn) || [];

const isSystemColumn = (col): boolean =>
  !!(
    col &&
    (col.uidt === UITypes.ForeignKey ||
      ((col.column_name === 'created_at' || col.column_name === 'updated_at') &&
        col.uidt === UITypes.DateTime) ||
      (col.pk && (col.ai || col.cdf)) ||
      (col.pk && col.meta && col.meta.ag) ||
      col.system)
  );

const isSelfReferencingTableColumn = (col): boolean => {
  return (
    col &&
    (col.uidt === UITypes.Links || col.uidt === UITypes.LinkToAnotherRecord) &&
    (col?.fk_model_id || col?.colOptions?.fk_model_id) &&
    col?.colOptions?.fk_related_model_id &&
    (col?.fk_model_id || col?.colOptions?.fk_model_id) ===
      col.colOptions.fk_related_model_id
  );
};

const extractRolesObj = (roles: RolesType): RolesObj => {
  if (!roles) return null;

  if (typeof roles === 'object' && !Array.isArray(roles)) return roles;

  if (typeof roles === 'string') {
    roles = roles.split(',');
  }

  if (roles.length === 0) return null;

  return roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});
};

const stringifyRolesObj = (roles?: RolesObj | null): string => {
  if (!roles) return '';
  const rolesArr = Object.keys(roles).filter((r) => roles[r]);
  return rolesArr.join(',');
};
const getAvailableRollupForColumn = (column: ColumnType) => {
  if ([UITypes.Formula].includes(column.uidt as UITypes)) {
    return getAvailableRollupForFormulaType(
      (column.colOptions as FormulaType as any).parsed_tree?.dataType ??
        FormulaDataTypes.UNKNOWN
    );
  } else {
    return getAvailableRollupForUiType(column.uidt);
  }
};
const getAvailableRollupForUiType = (type: string) => {
  if (
    [
      UITypes.Year,
      UITypes.Time,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(type as UITypes)
  ) {
    return ['count', 'min', 'max', 'countDistinct'];
  }
  if (isNumericCol(type as UITypes)) {
    // Number, Currency, Percent, Duration, Rating, Decimal
    return [
      'sum',
      'count',
      'min',
      'max',
      'avg',
      'countDistinct',
      'sumDistinct',
      'avgDistinct',
    ];
  }

  if (
    [
      UITypes.SingleLineText,
      UITypes.LongText,
      UITypes.User,
      UITypes.Email,
      UITypes.PhoneNumber,
      UITypes.URL,
      UITypes.JSON,
    ].includes(type as UITypes)
  ) {
    return ['count', 'countDistinct'];
  }
  if ([UITypes.Checkbox].includes(type as UITypes)) {
    return ['count', 'sum'];
  }
  if ([UITypes.Attachment].includes(type as UITypes)) {
    return [];
  }
  if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(type as UITypes)) {
    return ['count', 'countDistinct'];
  }
  return [
    'sum',
    'count',
    'min',
    'max',
    'avg',
    'countDistinct',
    'sumDistinct',
    'avgDistinct',
  ];
};

const getAvailableRollupForFormulaType = (type: FormulaDataTypes) => {
  switch (type) {
    case FormulaDataTypes.DATE:
    case FormulaDataTypes.INTERVAL: {
      return ['count', 'min', 'max', 'countDistinct'];
    }
    case FormulaDataTypes.NUMERIC: {
      return [
        'sum',
        'count',
        'min',
        'max',
        'avg',
        'countDistinct',
        'sumDistinct',
        'avgDistinct',
      ];
    }
    case FormulaDataTypes.BOOLEAN: {
      return ['count', 'sum'];
    }
    case FormulaDataTypes.STRING: {
      return ['count', 'countDistinct'];
    }
    case FormulaDataTypes.UNKNOWN:
    default: {
      return ['count'];
    }
  }
};

const getRenderAsTextFunForUiType = (type: UITypes) => {
  if (
    [
      UITypes.Year,
      UITypes.Time,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Currency,
      UITypes.Duration,
    ].includes(type)
  ) {
    return ['count', 'countDistinct'];
  }

  return [
    'sum',
    'count',
    'avg',
    'min',
    'max',
    'countDistinct',
    'sumDistinct',
    'avgDistinct',
  ];
};

const getFileName = ({ name, count, ext }) =>
  `${name}${count ? `(${count})` : ''}${ext ? `${ext}` : ''}`;

// add count before extension if duplicate name found
function populateUniqueFileName(fileName: string, attachments: string[]) {
  return fileName.replace(
    /^(.+?)(?:\((\d+)\))?(\.(?:tar|min)\.(?:\w{2,4})|\.\w+)$/,
    (fileName, name, count, ext) => {
      let genFileName = fileName;
      let c = count || 1;

      // iterate until a unique name
      while (attachments.some((fn) => fn === genFileName)) {
        genFileName = getFileName({
          name,
          ext,
          count: c++,
        });
      }
      return genFileName;
    }
  );
}

function roundUpToPrecision(number: number, precision: number = 0) {
  precision =
    precision == null
      ? 0
      : precision >= 0
      ? Math.min(precision, 292)
      : Math.max(precision, -292);
  if (precision) {
    // Shift with exponential notation to avoid floating-point issues.
    // See [MDN](https://mdn.io/round#Examples) for more details.
    let pair = `${number}e`.split('e');
    const value = Math.round(Number(`${pair[0]}e${+pair[1] + precision}`));
    pair = `${value}e`.split('e');
    return (+`${pair[0]}e${+pair[1] - precision}`).toFixed(precision);
  }
  return Math.round(number).toFixed(precision);
}

export {
  filterOutSystemColumns,
  getSystemColumnsIds,
  getSystemColumns,
  isSystemColumn,
  isSelfReferencingTableColumn,
  extractRolesObj,
  stringifyRolesObj,
  getAvailableRollupForColumn,
  getAvailableRollupForUiType,
  getAvailableRollupForFormulaType,
  getRenderAsTextFunForUiType,
  populateUniqueFileName,
  roundUpToPrecision,
};

const testDataBaseNames = {
  [ClientType.MYSQL]: null,
  mysql: null,
  [ClientType.PG]: 'postgres',
  oracledb: 'xe',
  [ClientType.MSSQL]: undefined,
  [ClientType.SQLITE]: 'a.sqlite',
};

export const getTestDatabaseName = (db: {
  client: ClientType;
  connection?: { database?: string };
}) => {
  if (db.client === ClientType.PG || db.client === ClientType.SNOWFLAKE)
    return db.connection?.database;
  return testDataBaseNames[db.client as keyof typeof testDataBaseNames];
};

export const integrationCategoryNeedDefault = (category: IntegrationsType) => {
  return [IntegrationsType.Ai].includes(category);
};

export function parseProp(v: any): any {
  if (!v) return {};
  try {
    return typeof v === 'string' ? JSON.parse(v) ?? {} : v;
  } catch {
    return {};
  }
}

export function stringifyProp(v: any): string {
  if (!v) return '{}';
  try {
    return typeof v === 'string' ? v : JSON.stringify(v) ?? '{}';
  } catch {
    return '{}';
  }
}

export function parseHelper(v: any): any {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
}

export function stringifyHelper(v: any): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return v;
  }
}
