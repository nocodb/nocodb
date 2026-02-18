import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';
import { NcError } from '~/helpers/catchError';

/**
 * Validates PostgreSQL identifier against SQL injection patterns
 * Convenience function that uses PGDBQueryClient instance
 * @param identifier - The identifier to validate (schema, table, column name)
 * @throws {NcError} if identifier contains dangerous characters
 */
export function validatePgIdentifier(identifier: string): void {
  const pgClient = new PGDBQueryClient();
  pgClient.validateIdentifier(identifier);
}

/**
 * Safely escapes a PostgreSQL identifier by wrapping in double quotes
 * Convenience function that uses PGDBQueryClient instance
 * @param identifier - The identifier to escape
 * @returns Escaped identifier wrapped in double quotes
 */
export function escapePgIdentifier(identifier: string): string {
  const pgClient = new PGDBQueryClient();
  return pgClient.escapeIdentifier(identifier);
}

export class PGDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.PG;
  }

  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }

  simpleCast(field: string, asType: string) {
    return `${field}::${asType}`;
  }

  /**
   * Validates PostgreSQL identifier against SQL injection patterns
   * @param identifier - The identifier to validate (schema, table, column name)
   * @throws {NcError} if identifier contains dangerous characters
   */
  validateIdentifier(identifier: string): void {
    // PostgreSQL identifier rules:
    // - Start with letter or underscore
    // - Contains only letters, digits, underscores
    // - Max 63 bytes
    // - No quotes, semicolons, or SQL keywords

    if (!identifier || typeof identifier !== 'string') {
      NcError._.invalidRequestBody('Identifier must be a non-empty string');
    }

    if (identifier.length > 63) {
      NcError._.invalidRequestBody(
        'PostgreSQL identifier exceeds 63 character limit',
      );
    }

    // Check for dangerous characters
    const dangerousPattern = /[;"'`\\-]|--|\*|\/\*|\*\/|xp_|sp_|exec|execute/i;
    if (dangerousPattern.test(identifier)) {
      NcError._.invalidRequestBody(
        `Invalid identifier: contains dangerous characters or SQL keywords`,
      );
    }

    // Must start with letter or underscore
    if (!/^[a-zA-Z_]/.test(identifier)) {
      NcError._.invalidRequestBody(
        'Identifier must start with letter or underscore',
      );
    }

    // Only alphanumeric and underscores allowed
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
      NcError._.invalidRequestBody('Identifier contains invalid characters');
    }
  }

  /**
   * Safely escapes a PostgreSQL identifier by wrapping in double quotes
   * Still validates to prevent embedded quotes
   * @param identifier - The identifier to escape
   * @returns Escaped identifier wrapped in double quotes
   */
  escapeIdentifier(identifier: string): string {
    this.validateIdentifier(identifier);
    // PostgreSQL identifier quoting: double quotes, escape internal quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
