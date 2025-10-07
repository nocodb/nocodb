import { type ColumnType, type NcContext } from 'nocodb-sdk';
import type { UITypes } from 'nocodb-sdk';
import {
  deleteColumnSystemPropsFromRequest,
  TableSystemColumns,
} from '~/helpers/columnHelpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';

export const repopulateCreateTableSystemColumns = (
  _context: NcContext,
  { columns }: { columns: (ColumnType & { cn?: string })[] },
) => {
  const tableSystemColumns = TableSystemColumns();
  const strictOneColumnUidt = tableSystemColumns
    .filter((col) => !col.allowNonSystem)
    .map((col) => col.uidt);
  const result = [
    ...tableSystemColumns.map((col) => {
      delete col.allowNonSystem;
      (col as any).cn = col.column_name;
      return col as ColumnType & { cn?: string };
    }),
    // remove all UIDT ID and Order from request
    ...columns.filter(
      (col) => !strictOneColumnUidt.includes(col.uidt as UITypes),
    ),
  ];
  for (let i = result.length - 1; i >= tableSystemColumns.length; i--) {
    const col = result[i];
    // check if title, column name or uidt is intersecting with system columns
    const intersectingSystemCols = tableSystemColumns.filter(
      (sysCol) =>
        sysCol.title === col.title || sysCol.column_name === col.column_name,
    );
    for (const sysCol of intersectingSystemCols) {
      if (
        sysCol.uidt === col.uidt &&
        (sysCol.title === col.title || col.title === undefined) &&
        (sysCol.column_name === col.column_name ||
          col.column_name === undefined)
      ) {
        // identic with system cols, so we remove it
        result.splice(i, 1);
        continue;
      }
      if (col.title && col.title === sysCol.title) {
        col.title = getUniqueColumnAliasName(result as any[], col.title);
      }
      if (col.column_name && col.column_name === sysCol.column_name) {
        col.column_name = getUniqueColumnName(result as any[], col.column_name);
        col.cn = col.column_name;
      }
    }
    deleteColumnSystemPropsFromRequest(col);
  }
  return result;
};
