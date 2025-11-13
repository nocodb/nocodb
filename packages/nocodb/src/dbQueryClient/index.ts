import { ClientType } from 'nocodb-sdk';
import { PGDBQueryClient } from '~/dbQueryClient/pg';

export class DBQueryClient {
  static get(clientType: ClientType) {
    switch (clientType) {
      case ClientType.PG: {
        return new PGDBQueryClient();
      }
    }
  }
}
