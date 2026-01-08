import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class MySqlDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }
  simpleCast(field: string, asType: string) {
    const useAsType = asType.toUpperCase() === 'TEXT' ? 'CHAR' : asType;
    return `CAST(${field} as ${useAsType})`;
  }
}
