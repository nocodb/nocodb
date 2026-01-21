import type { Knex, XKnex } from '~/db/CustomKnex';

export interface DBQueryClient {
  temporaryTable(payload: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }): Knex.QueryInterface;

  temporaryTableRaw(payload: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }): Knex.Raw;

  concat(fields: string[]);
  simpleCast(field: string, asType: string);
}
