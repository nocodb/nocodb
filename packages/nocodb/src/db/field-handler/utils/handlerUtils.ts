import { ncIsNull, ncIsUndefined } from 'nocodb-sdk';
import type { Column } from '~/models';

export function getAs(column: Column) {
  return column.asId || column.id;
}
export function ncIsStringHasValue(val: string | undefined | null) {
  return val !== '' && !ncIsUndefined(val) && !ncIsNull(val);
}
