import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class SqliteDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.SQLITE;
  }
  concat(fields: string[]) {
    return `${fields.join(' || ')}`;
  }
  simpleCast(field: string, asType: string) {
    return `CAST(${field} as ${asType})`;
  }
}
