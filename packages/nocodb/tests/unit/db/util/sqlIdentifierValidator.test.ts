import { expect } from 'chai';
import {
  escapePgIdentifier,
  PGDBQueryClient,
  validatePgIdentifier,
} from '~/dbQueryClient/pg';
import { validateSqlIdentifier } from '~/db/util/sqlIdentifierValidator';

describe('SQL Identifier Validator', () => {
  describe('validatePgIdentifier (convenience function)', () => {
    it('should accept valid identifiers', () => {
      expect(() => validatePgIdentifier('public')).not.throw();
      expect(() => validatePgIdentifier('my_schema')).not.throw();
      expect(() => validatePgIdentifier('Schema123')).not.throw();
      expect(() => validatePgIdentifier('_private')).not.throw();
      expect(() => validatePgIdentifier('abc')).not.throw();
      expect(() =>
        validatePgIdentifier('table_name_with_underscores'),
      ).not.throw();
    });

    it('should reject SQL injection attempts', () => {
      const maliciousInputs = [
        'public"; CREATE TABLE pwned',
        "schema'; DROP TABLE users--",
        'test;DELETE FROM data',
        'schema--comment',
        'schema/*comment*/',
        'xp_cmdshell',
        'sp_executesql',
        'exec something',
        'execute malicious',
      ];

      for (const input of maliciousInputs) {
        expect(() => validatePgIdentifier(input)).throw(/Invalid identifier/);
      }
    });

    it('should reject identifiers with special characters', () => {
      expect(() => validatePgIdentifier('my-schema')).throw(
        /Invalid identifier/,
      );
      expect(() => validatePgIdentifier('my.schema')).throw();
      expect(() => validatePgIdentifier('my schema')).throw();
      expect(() => validatePgIdentifier('my@schema')).throw();
      expect(() => validatePgIdentifier('schema`name')).throw();
      expect(() => validatePgIdentifier('schema\\name')).throw();
    });

    it('should reject identifiers starting with numbers', () => {
      expect(() => validatePgIdentifier('123schema')).throw(
        /must start with letter or underscore/,
      );
      expect(() => validatePgIdentifier('9table')).throw();
    });

    it('should reject identifiers exceeding 63 characters', () => {
      const longName = 'a'.repeat(64);
      expect(() => validatePgIdentifier(longName)).throw(
        /exceeds 63 character limit/,
      );
    });

    it('should accept identifiers with exactly 63 characters', () => {
      const maxName = 'a'.repeat(63);
      expect(() => validatePgIdentifier(maxName)).not.throw();
    });

    it('should reject empty or null identifiers', () => {
      expect(() => validatePgIdentifier('')).throw(
        /must be a non-empty string/,
      );
      expect(() => validatePgIdentifier(null as any)).throw(
        /must be a non-empty string/,
      );
      expect(() => validatePgIdentifier(undefined as any)).throw(
        /must be a non-empty string/,
      );
    });

    it('should reject non-string identifiers', () => {
      expect(() => validatePgIdentifier(123 as any)).throw(
        /must be a non-empty string/,
      );
      expect(() => validatePgIdentifier({} as any)).throw(
        /must be a non-empty string/,
      );
      expect(() => validatePgIdentifier([] as any)).throw(
        /must be a non-empty string/,
      );
    });
  });

  describe('escapePgIdentifier', () => {
    it('should wrap valid identifiers in double quotes', () => {
      expect(escapePgIdentifier('public')).equal('"public"');
      expect(escapePgIdentifier('my_schema')).equal('"my_schema"');
      expect(escapePgIdentifier('Table123')).equal('"Table123"');
    });

    it('should validate before escaping', () => {
      expect(() => escapePgIdentifier('malicious"; DROP TABLE')).throw(
        /Invalid identifier/,
      );
      expect(() => escapePgIdentifier('')).throw(/must be a non-empty string/);
    });
  });

  describe('validateSqlIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(() => validateSqlIdentifier('my_database')).not.throw();
      expect(() => validateSqlIdentifier('table-name')).not.throw();
      expect(() => validateSqlIdentifier('Schema.Name')).not.throw();
    });

    it('should reject SQL injection attempts', () => {
      const maliciousInputs = [
        'db"; CREATE TABLE pwned',
        "table'; DROP TABLE users",
        'name;DELETE FROM data',
        'schema--comment',
        'table/*comment*/',
        'xp_cmdshell',
        'sp_executesql',
        'exec something',
        'DROP TABLE users',
        'drop database test',
      ];

      for (const input of maliciousInputs) {
        expect(() => validateSqlIdentifier(input)).throw(/Invalid identifier/);
      }
    });

    it('should reject empty or null identifiers', () => {
      expect(() => validateSqlIdentifier('')).throw(
        /must be a non-empty string/,
      );
      expect(() => validateSqlIdentifier(null as any)).throw(
        /must be a non-empty string/,
      );
      expect(() => validateSqlIdentifier(undefined as any)).throw(
        /must be a non-empty string/,
      );
    });
  });

  describe('PGDBQueryClient methods', () => {
    let pgClient: PGDBQueryClient;

    beforeEach(() => {
      pgClient = new PGDBQueryClient();
    });

    describe('validateIdentifier', () => {
      it('should accept valid identifiers', () => {
        expect(() => pgClient.validateIdentifier('public')).not.throw();
        expect(() => pgClient.validateIdentifier('my_schema')).not.throw();
        expect(() => pgClient.validateIdentifier('Schema123')).not.throw();
        expect(() => pgClient.validateIdentifier('_private')).not.throw();
      });

      it('should reject SQL injection attempts', () => {
        expect(() =>
          pgClient.validateIdentifier('public"; CREATE TABLE pwned'),
        ).throw(/Invalid identifier/);
        expect(() => pgClient.validateIdentifier('schema--comment')).throw(
          /Invalid identifier/,
        );
      });

      it('should reject identifiers exceeding 63 characters', () => {
        const longName = 'a'.repeat(64);
        expect(() => pgClient.validateIdentifier(longName)).throw(
          /exceeds 63 character limit/,
        );
      });
    });

    describe('escapeIdentifier', () => {
      it('should wrap valid identifiers in double quotes', () => {
        expect(pgClient.escapeIdentifier('public')).equal('"public"');
        expect(pgClient.escapeIdentifier('my_schema')).equal('"my_schema"');
      });

      it('should validate before escaping', () => {
        expect(() => pgClient.escapeIdentifier('malicious"; DROP TABLE')).throw(
          /Invalid identifier/,
        );
      });
    });
  });
});
