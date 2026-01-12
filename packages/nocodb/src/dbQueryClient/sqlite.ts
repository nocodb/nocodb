import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class SqliteDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  concat(fields: string[]) {
    return `${fields.join(' || ')}`;
  }
  simpleCast(field: string, asType: string) {
    return `CAST(${field} as ${asType})`;
  }
}
