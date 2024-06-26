import UITypes, { isNumericCol } from './UITypes';
import { RolesObj, RolesType } from './globals';

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

const getAvailableRollupForUiType = (type: string) => {
  if (isNumericCol(type as UITypes)) {
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
  } else if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(type as UITypes)
  ) {
    return ['count', 'min', 'max', 'countDistinct'];
  } else if (
    [
      UITypes.SingleLineText,
      UITypes.LongText,
      UITypes.User,
      UITypes.Email,
      UITypes.PhoneNumber,
      UITypes.URL,
      UITypes.Checkbox,
      UITypes.JSON,
    ].includes(type as UITypes)
  ) {
    return ['count'];
  } else if ([UITypes.Attachment].includes(type as UITypes)) {
    return [];
  } else {
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
    return +`${pair[0]}e${+pair[1] - precision}`;
  }
  return Math.round(number);
}

export {
  filterOutSystemColumns,
  getSystemColumnsIds,
  getSystemColumns,
  isSystemColumn,
  isSelfReferencingTableColumn,
  extractRolesObj,
  stringifyRolesObj,
  getAvailableRollupForUiType,
  populateUniqueFileName,
  roundUpToPrecision,
};
