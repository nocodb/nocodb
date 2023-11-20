import UITypes from './UITypes';
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
  col &&
  (col.uidt === UITypes.ForeignKey ||
    col.column_name === 'created_at' ||
    col.column_name === 'updated_at' ||
    (col.pk && (col.ai || col.cdf)) ||
    (col.pk && col.meta && col.meta.ag) ||
    col.system);

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

export {
  filterOutSystemColumns,
  getSystemColumnsIds,
  getSystemColumns,
  isSystemColumn,
  extractRolesObj,
  stringifyRolesObj,
};
