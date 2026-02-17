import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class MySqlDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.MYSQL;
  }
  validateClientType(client: string) {
    if (!['mysql', 'mysql2'].includes(client)) {
      throw new Error('Source is not ' + this.clientType);
    }
  }

  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }
  simpleCast(field: string, asType: string) {
    const useAsType = asType.toUpperCase() === 'TEXT' ? 'CHAR' : asType;
    return `CAST(${field} as ${useAsType})`;
  }
}
