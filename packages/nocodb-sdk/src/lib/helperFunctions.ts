import UITypes from './UITypes';
// import {RelationTypes} from "./globals";

// const systemCols = ['created_at', 'updated_at']
const filterOutSystemColumns = (columns) => {
  return (columns && columns.filter((c) => !isSystemColumn(c))) || [];
};
const getSystemColumnsIds = (columns) => {
  return ((columns && columns.filter(isSystemColumn)) || []).map((c) => c.id);
};

const getSystemColumns = (columns) => columns.filter(isSystemColumn) || [];

// const isColumnEssentialForView = (col) => 
// col && col.vie

const isSystemColumn = (col) =>
  col &&
  (col.uidt === UITypes.ForeignKey ||
    col.column_name === 'created_at' ||
    col.column_name === 'updated_at' ||
    (col.pk && (col.ai || col.cdf)) ||
    (col.pk && col.meta && col.meta.ag) ||
    col.system);

export {
  filterOutSystemColumns,
  getSystemColumnsIds,
  getSystemColumns,
  isSystemColumn,
};
