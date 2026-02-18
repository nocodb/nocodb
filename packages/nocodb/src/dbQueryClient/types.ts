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

  /**
   * Validates a database identifier against SQL injection patterns
   * @param identifier - The identifier to validate (schema, table, column name)
   * @throws {Error} if identifier contains dangerous characters
   */
  validateIdentifier(identifier: string): void;

  /**
   * Safely escapes a database identifier
   * @param identifier - The identifier to escape
   * @returns Escaped identifier
   */
  escapeIdentifier(identifier: string): string;
}
