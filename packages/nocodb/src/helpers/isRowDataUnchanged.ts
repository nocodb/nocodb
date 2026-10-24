import { isRowDataUnchanged as isColumnRowDataUnchanged } from 'nocodb-sdk';
import type { Column } from '~/models';

// Shared with nc-gui, which skips its own refresh on the same rule.
export function isRowDataUnchanged(oldColumn: Column, newColumn: Column) {
  return isColumnRowDataUnchanged(oldColumn, newColumn);
}
