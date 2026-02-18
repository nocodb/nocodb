import { expect } from 'chai';
import PGClient from '~/db/sql-client/lib/pg/PgClient';

describe('PgClient SQL Injection Protection', () => {
  let pgClient: PGClient;

  beforeEach(() => {
    // Mock connection config for testing
    const mockConnectionConfig = {
      client: 'pg',
      connection: {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        database: 'test',
      },
    };
    pgClient = new PGClient(mockConnectionConfig);
  });

  describe('afterTableCreate - SQL Injection Protection', () => {
    it('should reject malicious schema name in trigger creation', async () => {
      const maliciousSchema = 'public"; CREATE TABLE pwned (id int)';

      try {
        await pgClient.afterTableCreate({
          schema: maliciousSchema,
          tn: 'test_table',
          columns: [
            {
              cn: 'created_at',
              au: true, // auto-update column
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject SQL comments in schema names', async () => {
      const maliciousSchema = 'public--';

      try {
        await pgClient.afterTableCreate({
          schema: maliciousSchema,
          tn: 'test_table',
          columns: [
            {
              cn: 'created_at',
              au: true,
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject malicious table name', async () => {
      const maliciousTableName = 'table"; DROP TABLE users; --';

      try {
        await pgClient.afterTableCreate({
          schema: 'public',
          tn: maliciousTableName,
          columns: [
            {
              cn: 'created_at',
              au: true,
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject malicious column name', async () => {
      const maliciousColumnName = 'col"; DELETE FROM data; --';

      try {
        await pgClient.afterTableCreate({
          schema: 'public',
          tn: 'test_table',
          columns: [
            {
              cn: maliciousColumnName,
              au: true,
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should accept valid schema, table, and column names', async () => {
      // This test would require a real database connection
      // For now, we just verify it doesn't throw validation errors
      const validArgs = {
        schema: 'public',
        tn: 'test_table',
        columns: [
          {
            cn: 'created_at',
            au: true,
          },
        ],
      };

      // Should not throw validation error
      // Note: Will fail at SQL execution without real DB, but validation should pass
      try {
        await pgClient.afterTableCreate(validArgs);
      } catch (error: any) {
        // If it's a validation error, test should fail
        if (error.message.includes('Invalid identifier')) {
          throw error;
        }
        // Other errors (like connection errors) are expected without real DB
      }
    });
  });

  describe('afterTableUpdate - SQL Injection Protection', () => {
    it('should reject malicious schema name in trigger update', async () => {
      const maliciousSchema = "public'; DROP TABLE users CASCADE; --";

      try {
        await pgClient.afterTableUpdate({
          schema: maliciousSchema,
          tn: 'test_table',
          columns: [
            {
              cn: 'updated_at',
              au: true,
              altered: 1,
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject schema with semicolon', async () => {
      const maliciousSchema = 'public;';

      try {
        await pgClient.afterTableUpdate({
          schema: maliciousSchema,
          tn: 'test_table',
          columns: [
            {
              cn: 'updated_at',
              au: true,
              altered: 1,
            },
          ],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject schema with SQL keywords', async () => {
      const maliciousSchemas = ['exec_schema', 'xp_test', 'sp_something'];

      for (const schema of maliciousSchemas) {
        try {
          await pgClient.afterTableUpdate({
            schema,
            tn: 'test_table',
            columns: [
              {
                cn: 'updated_at',
                au: true,
                altered: 1,
              },
            ],
          });
          throw new Error('Expected validation error but none was thrown');
        } catch (error: any) {
          expect(error.message).to.match(
            /Invalid identifier: contains dangerous characters/,
          );
        }
      }
    });
  });

  describe('Identifier Validation Edge Cases', () => {
    it('should reject identifiers with backslashes', async () => {
      try {
        await pgClient.afterTableCreate({
          schema: 'test\\schema',
          tn: 'table',
          columns: [{ cn: 'col', au: true }],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Invalid identifier: contains dangerous characters/,
        );
      }
    });

    it('should reject identifiers starting with numbers', async () => {
      try {
        await pgClient.afterTableCreate({
          schema: '123schema',
          tn: 'table',
          columns: [{ cn: 'col', au: true }],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(/must start with letter or underscore/);
      }
    });

    it('should reject identifiers with spaces', async () => {
      try {
        await pgClient.afterTableCreate({
          schema: 'my schema',
          tn: 'table',
          columns: [{ cn: 'col', au: true }],
        });
        throw new Error('Expected validation error but none was thrown');
      } catch (error: any) {
        expect(error.message).to.match(
          /Identifier contains invalid characters/,
        );
      }
    });

    it('should accept identifiers with underscores', async () => {
      const validArgs = {
        schema: 'my_schema',
        tn: 'my_table',
        columns: [
          {
            cn: 'my_column',
            au: true,
          },
        ],
      };

      try {
        await pgClient.afterTableCreate(validArgs);
      } catch (error: any) {
        if (error.message.includes('Invalid identifier')) {
          throw error;
        }
      }
    });
  });
});
