import { isVirtualCol, UITypes } from 'nocodb-sdk';
import type { Column } from '~/models';

// True when the update cannot change any stored or returned cell value, e.g. a new
// select option, a default value, a description or display meta. Clients then
// refresh the field without refetching rows.
export function isRowDataUnchanged(oldColumn: Column, newColumn: Column) {
  if (!oldColumn || !newColumn) return false;

  if (
    oldColumn.uidt !== newColumn.uidt ||
    oldColumn.title !== newColumn.title ||
    oldColumn.column_name !== newColumn.column_name ||
    oldColumn.dt !== newColumn.dt
  ) {
    return false;
  }

  if (
    [UITypes.SingleSelect, UITypes.MultiSelect].includes(
      newColumn.uidt as UITypes,
    )
  ) {
    // Match by id: a swap or rename-and-re-add keeps the title set but moves cell values.
    const newTitleById = new Map(
      (newColumn.colOptions?.options ?? []).map((o) => [o.id, o.title]),
    );
    return (oldColumn.colOptions?.options ?? []).every(
      (o) => newTitleById.get(o.id) === o.title,
    );
  }

  // Virtual columns compute their values from colOptions (formula, rollup, lookup, links).
  if (isVirtualCol(newColumn)) return false;

  return oldColumn.dtxp === newColumn.dtxp;
}
