import type { ClientType } from 'nocodb-sdk';
import type { Knex, XKnex } from '~/db/CustomKnex';

export interface DBQueryClient {
  get clientType(): ClientType;
  validateClientType(client: string): void;
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

  massUpdate({
    knex,
    tableName,
    data,
    updatingColumns,
    primaryKeyColumns,
  }: {
    knex: Knex;
    tableName: string | Knex.Raw<any>;
    data: Record<string, any>[];
    updatingColumns: string[];
    primaryKeyColumns: string[];
  }): Promise<undefined>;
}
