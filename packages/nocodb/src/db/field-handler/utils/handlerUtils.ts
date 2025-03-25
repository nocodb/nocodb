import type { Column } from '~/models';

export function getAs(column: Column) {
  return column.asId || column.id;
}
