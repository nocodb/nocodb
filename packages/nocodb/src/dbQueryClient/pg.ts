import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class PGDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }

  simpleCast(field: string, asType: string) {
    return `${field}::${asType}`;
  }
}
