import type { XKnex } from '~/db/CustomKnex';

export interface DBQueryClient {
  temporaryTable(payload: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  });
}
