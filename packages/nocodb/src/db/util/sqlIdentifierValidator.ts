/**
 * Validates a database identifier for any SQL dialect
 * Uses more permissive rules than PostgreSQL-specific validation
 * For PostgreSQL-specific validation, use validatePgIdentifier from ~/dbQueryClient/pg
 * @param identifier - The identifier to validate
 * @throws {Error} if identifier contains dangerous characters
 */
export function validateSqlIdentifier(identifier: string): void {
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
