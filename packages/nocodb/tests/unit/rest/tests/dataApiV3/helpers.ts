import type { ColumnType } from 'nocodb-sdk';

export const normalizeObject = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

export const verifyColumnsInRsp = (
  row: Record<string, any>,
  columns: ColumnType[],
) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const expectedColumnsListStr = columns
    .filter((c) => !c.system || c.pk)
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === expectedColumnsListStr;
};
