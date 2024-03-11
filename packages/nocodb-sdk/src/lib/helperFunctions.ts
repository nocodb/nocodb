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
    ].includes(type as UITypes)
  ) {
    return ['count'];
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

function populateUniqueFileName(
  fileName: string,
  attachments: string[],
  mimeType: string
) {
  if (!mimeType) return fileName;

  // If the file extension is not present, the while loop will go into an infinite loop. So, add the extension first if not present.
  if (!fileName?.endsWith(`.${mimeType.split('/')[1]}`)) {
    fileName = `${fileName}.${mimeType.split('/')[1]}`;
  } else if (
    fileName?.endsWith(`.${mimeType.split('/')[1]}`) &&
    fileName.length === `.${mimeType.split('/')[1]}`.length
  ) {
    fileName = `image.${mimeType.split('/')[1]}`;
  }

  const match = fileName.match(/^(.+?)(\((\d+)\))?(\.[^.]+)$/);

  if (!match) return fileName;

  let c = !isNaN(parseInt(match[3])) ? parseInt(match[3]) : 1;

  while (attachments.some((fn) => fn === fileName)) {
    fileName = `${match[1]}(${c++})${match[4]}`;
  }

  return fileName;
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
};
