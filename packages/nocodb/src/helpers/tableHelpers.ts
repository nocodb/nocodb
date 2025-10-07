import {
  type ColumnType,
  generateUniqueCopyName,
  type NcContext,
} from 'nocodb-sdk';
import { TableSystemColumns } from './columnHelpers';
import type { UITypes } from 'nocodb-sdk';

export const repopulateCreateTableSystemColumns = (
  _context: NcContext,
  { columns }: { columns: ColumnType[] },
) => {
  const tableSystemColumns = TableSystemColumns();
  const strictOneColumnUidt = tableSystemColumns
    .filter((col) => !col.allowNonSystem)
    .map((col) => col.uidt);
  const result = [
    ...tableSystemColumns.map((col) => {
      delete col.allowNonSystem;
      return col;
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
      }
      if (col.title && col.title === sysCol.title) {
        col.title = generateUniqueCopyName(col.title, [sysCol.title], {
          prefix: '',
          separator: '',
          counterFormat: '{counter}',
        });
      }
      if (col.column_name && col.column_name === sysCol.column_name) {
        col.column_name = generateUniqueCopyName(
          col.column_name,
          [sysCol.column_name],
          {
            prefix: '',
            separator: '',
            counterFormat: '{counter}',
          },
        );
      }
    }

    {
      // remove all properties not in documentations
      (col as any).dt = undefined;
      (col as any).np = undefined;
      (col as any).ns = undefined;
      (col as any).clen = undefined;
      (col as any).cop = undefined;
      (col as any).pk = undefined;
      (col as any).rqd = undefined;
      (col as any).un = undefined;
      (col as any).ai = undefined;
      (col as any).unique = undefined;
      (col as any).cc = undefined;
      (col as any).csn = undefined;
      (col as any).dtx = undefined;
      (col as any).dtxs = undefined;
      (col as any).au = undefined;
      (col as any).validate = undefined;
      (col as any).system = undefined;
    }
  }
  return result;
};
