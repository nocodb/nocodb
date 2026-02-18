import { arrFlatMap, ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';

export abstract class GenericDBQueryClient implements DBQueryClient {
  get clientType(): ClientType {
    return ClientType.PG;
  }
  validateClientType(client: string) {
    if (client !== this.clientType) {
      throw new Error('Source is not ' + this.clientType);
    }
  }
  temporaryTableRaw({
    knex,
    data,
    fields,
    alias,
  }: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }) {
    const fieldsValuePlaceholder = `(${fields.map(() => '?').join(',')})`;
    const valuesPlaceholder = data.map(() => fieldsValuePlaceholder).join(', ');
    const fieldsPlaceholder = fields.map(() => '??').join(',');
    return knex.raw(
      `(VALUES ${valuesPlaceholder}) AS ?? (${fieldsPlaceholder})`,
      [
        ...arrFlatMap(
          data.map((row) =>
            fields.reduce((acc, field) => {
              acc.push(row[field]);
              return acc;
            }, []),
          ),
        ),
        alias,
        ...fields,
      ],
    );
  }
  temporaryTable(param: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
    asKnexFrom?: boolean;
  }) {
    return param.knex.from(this.temporaryTableRaw(param));
  }

  abstract concat(fields: string[]): string;
  abstract simpleCast(field: string, asType: string): string;

  /**
   * Generic SQL identifier validation
   * Database-specific implementations should override this for stricter rules
   * @param identifier - The identifier to validate
   * @throws {Error} if identifier contains dangerous characters
   */
  validateIdentifier(identifier: string): void {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Identifier must be a non-empty string');
    }

    // Check for SQL injection patterns
    const dangerousPattern =
      /[;"'`]|--|\*|\/\*|\*\/|xp_|sp_|exec|execute|drop\s+table|drop\s+database/i;
    if (dangerousPattern.test(identifier)) {
      throw new Error(
        `Invalid identifier: contains dangerous characters or SQL keywords`,
      );
    }
  }

  /**
   * Generic identifier escaping
   * Database-specific implementations should override this
   * @param identifier - The identifier to escape
   * @returns Escaped identifier
   */
  escapeIdentifier(identifier: string): string {
    this.validateIdentifier(identifier);
    return identifier;
  }

  generateNestedRowSelectQuery(_param: any): Knex.Raw<any> {
    throw new Error('Not implemented');
  }
  async singleQueryList(
    _context: any,
    _ctx: any,
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    throw new Error('Not implemented');
  }
  async singleQueryRead(
    _context: any,
    _ctx: any,
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    throw new Error('Not implemented');
  }

  async extractColumns(_param: any): Promise<void> {
    throw new Error('Not implemented');
  }

  async extractColumn(_param: any): Promise<{
    isArray?: boolean;
  }> {
    throw new Error('Not implemented');
  }
}
