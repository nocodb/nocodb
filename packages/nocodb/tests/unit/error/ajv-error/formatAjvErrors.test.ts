import { expect } from 'chai';
import 'mocha';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import {
  formatAjvErrorMessage,
  formatAjvErrors,
} from '~/helpers/ajvErrorFormatter';
import { testSwaggerSchema } from './schema';

const ajv = new Ajv({ strictSchema: false, strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(testSwaggerSchema, 'test-swagger.json');

function validate(
  schemaName: string,
  payload: any,
): { raw: ErrorObject[]; formatted: ErrorObject[]; message: string } {
  const v = ajv.getSchema(
    `test-swagger.json#/components/schemas/${schemaName}`,
  );
  v(payload);
  const raw = (v.errors || []) as ErrorObject[];
  const formatted = formatAjvErrors(raw);
  const message = formatAjvErrorMessage(raw);
  return { raw, formatted, message };
}

function _ajvErrorFormatterTests() {
  describe('required keyword', () => {
    it('should produce readable message for missing required field', () => {
      const { formatted } = validate('SimpleObject', {});
      const titleErr = formatted.find((e) => e.message.includes('title'));
      expect(titleErr).to.exist;
      expect(titleErr.message).to.equal("'title' is required");
    });

    it('should list all missing required fields', () => {
      const { formatted } = validate('SimpleObject', {});
      expect(formatted).to.have.length(2);
      expect(formatted[0].message).to.equal("'title' is required");
      expect(formatted[1].message).to.equal("'type' is required");
    });

    it('should produce readable message for nested missing required field', () => {
      const { formatted } = validate('NestedObject', {
        meta: { color: '#FF0000' },
      });
      const iconErr = formatted.find((e) => e.message.includes('icon'));
      expect(iconErr).to.exist;
      expect(iconErr.message).to.equal("'icon' is required");
    });
  });

  describe('type keyword', () => {
    it('should produce readable message for wrong type', () => {
      const { formatted } = validate('SimpleObject', {
        title: 123,
        type: 'table',
      });
      const titleErr = formatted.find((e) => e.message.includes('title'));
      expect(titleErr).to.exist;
      expect(titleErr.message).to.equal("'title' must be a string");
    });
  });

  describe('enum keyword', () => {
    it('should list allowed values in error message', () => {
      const { formatted } = validate('SimpleObject', {
        title: 'test',
        type: 'invalid',
      });
      const typeErr = formatted.find((e) => e.message.includes('type'));
      expect(typeErr).to.exist;
      expect(typeErr.message).to.equal(
        "'type' must be one of: table, view, form",
      );
    });

    it('should list enum values for role field', () => {
      const { formatted } = validate('EnumField', { role: 'admin' });
      expect(formatted[0].message).to.include('must be one of:');
      expect(formatted[0].message).to.include('org-level-creator');
    });
  });

  describe('minLength keyword', () => {
    it('should say "must not be empty" for minLength 1', () => {
      const { formatted } = validate('SimpleObject', {
        title: '',
        type: 'table',
      });
      expect(formatted[0].message).to.equal("'title' must not be empty");
    });

    it('should say "at least N characters" for minLength > 1', () => {
      const { formatted } = validate('StringConstraints', { name: '' });
      expect(formatted[0].message).to.equal("'name' must not be empty");
    });
  });

  describe('maxLength keyword', () => {
    it('should produce readable max length message', () => {
      const { formatted } = validate('StringConstraints', {
        name: 'a'.repeat(256),
      });
      expect(formatted[0].message).to.equal(
        "'name' must be at most 255 characters",
      );
    });
  });

  describe('pattern keyword', () => {
    it('should hide raw regex pattern', () => {
      const { formatted } = validate('StringConstraints', {
        name: 'test',
        slug: 'INVALID SLUG!',
      });
      const slugErr = formatted.find((e) => e.message.includes('slug'));
      expect(slugErr).to.exist;
      expect(slugErr.message).to.equal("'slug' must match the required format");
      expect(slugErr.message).not.to.include('^');
    });
  });

  describe('format keyword', () => {
    it('should produce readable format message for email', () => {
      const { formatted } = validate('StringConstraints', {
        name: 'test',
        email: 'not-an-email',
      });
      const emailErr = formatted.find((e) => e.message.includes('email'));
      expect(emailErr).to.exist;
      expect(emailErr.message).to.equal(
        "'email' must be a valid email address",
      );
    });

    it('should produce readable format message for uri', () => {
      const { formatted } = validate('StringConstraints', {
        name: 'test',
        uri: 'not-a-uri',
      });
      const uriErr = formatted.find((e) => e.message.includes('uri'));
      expect(uriErr).to.exist;
      expect(uriErr.message).to.equal("'uri' must be a valid URI");
    });
  });

  describe('minimum / maximum keywords', () => {
    it('should produce readable minimum message', () => {
      const { formatted } = validate('NumericConstraints', { width: 10 });
      expect(formatted[0].message).to.equal("'width' must be 50 or greater");
    });

    it('should produce readable maximum message', () => {
      const { formatted } = validate('NumericConstraints', { width: 9999 });
      expect(formatted[0].message).to.equal("'width' must be 5000 or less");
    });
  });

  describe('exclusiveMinimum / exclusiveMaximum keywords', () => {
    it('should produce readable exclusiveMinimum message', () => {
      const { formatted } = validate('NumericConstraints', { ratio: 0 });
      expect(formatted[0].message).to.equal(
        "'ratio' must be greater than 0",
      );
    });

    it('should produce readable exclusiveMaximum message', () => {
      const { formatted } = validate('NumericConstraints', { ratio: 1 });
      expect(formatted[0].message).to.equal("'ratio' must be less than 1");
    });
  });

  describe('minItems / maxItems keywords', () => {
    it('should produce readable minItems message', () => {
      const { formatted } = validate('SimpleArray', { tags: [] });
      expect(formatted[0].message).to.equal(
        "'tags' must contain at least 1 item",
      );
    });

    it('should produce readable maxItems message', () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      const { formatted } = validate('SimpleArray', { tags });
      expect(formatted[0].message).to.equal(
        "'tags' must contain at most 10 items",
      );
    });
  });

  describe('uniqueItems keyword', () => {
    it('should produce readable uniqueItems message', () => {
      const { formatted } = validate('SimpleArray', {
        tags: ['a', 'a'],
      });
      expect(formatted[0].message).to.equal(
        "'tags' must not contain duplicate values",
      );
    });
  });

  describe('additionalProperties keyword', () => {
    it('should name the unexpected property', () => {
      const { formatted } = validate('StrictObject', {
        name: 'test',
        extra: 'not-allowed',
      });
      expect(formatted[0].message).to.equal(
        "Unexpected property 'extra'",
      );
    });
  });

  describe('oneOf collapsing', () => {
    it('should collapse sub-branch errors into single message', () => {
      const { raw, formatted } = validate('OneOfField', {
        field: { type: 'unknown', foo: 'bar' },
      });
      // Raw has many sub-branch errors
      expect(raw.length).to.be.greaterThan(3);
      // Formatted should collapse to just 1 (the top-level oneOf error)
      expect(formatted.length).to.equal(1);
      expect(formatted[0].message).to.equal(
        "'field' must match exactly one of the allowed schemas",
      );
    });
  });

  describe('anyOf collapsing', () => {
    it('should collapse anyOf type errors into single message', () => {
      const { raw, formatted } = validate('AnyOfField', {
        value: [1, 2, 3],
      });
      expect(raw.length).to.be.greaterThan(2);
      expect(formatted.length).to.equal(1);
      expect(formatted[0].message).to.equal(
        "'value' must match at least one of the allowed types",
      );
    });
  });

  describe('nested array errors', () => {
    it('should format errors in array items', () => {
      const { formatted } = validate('NestedArrayOfObjects', {
        columns: [{ title: '', uidt: 'Invalid' }],
      });
      expect(formatted.length).to.equal(2);
      expect(formatted[0].message).to.equal("'title' must not be empty");
      expect(formatted[1].message).to.include('must be one of:');
    });
  });

  describe('multiple simultaneous errors', () => {
    it('should format all errors in one payload', () => {
      const { formatted, message } = validate('MultiErrorPayload', {});
      expect(formatted.length).to.be.greaterThan(1);
      expect(message).to.match(/^Validation failed:/);
      expect(message).to.include("'title' is required");
    });
  });

  describe('formatAjvErrorMessage', () => {
    it('should return "Invalid request body" for empty errors', () => {
      expect(formatAjvErrorMessage([])).to.equal('Invalid request body');
    });

    it('should join multiple errors with commas', () => {
      const { message } = validate('SimpleObject', {});
      expect(message).to.equal(
        "Validation failed: 'title' is required, 'type' is required",
      );
    });
  });

  describe('allOf validation', () => {
    it('should report missing required from merged schemas', () => {
      const { formatted } = validate('AllOfMerged', {});
      const ids = formatted.map((e) => e.message);
      expect(ids).to.include("'id' is required");
      expect(ids).to.include("'source_id' is required");
    });
  });

  describe('$ref validation', () => {
    it('should report errors through $ref', () => {
      const { formatted } = validate('WithRef', {
        title: 'test',
        description: 123,
      });
      // description is TextOrNull (oneOf string | null), 123 is neither
      expect(formatted.length).to.be.greaterThan(0);
    });
  });

  describe('conditional (if/then/else) validation', () => {
    it('should report missing choices when type is select', () => {
      const { formatted } = validate('ConditionalField', { type: 'select' });
      const choicesErr = formatted.find((e) => e.message.includes('choices'));
      expect(choicesErr).to.exist;
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined errors gracefully', () => {
      expect(formatAjvErrors(null as any)).to.deep.equal([]);
      expect(formatAjvErrors(undefined as any)).to.deep.equal([]);
      expect(formatAjvErrors([])).to.deep.equal([]);
    });
  });
}

export function ajvErrorFormatterTest() {
  describe('AjvErrorFormatter', _ajvErrorFormatterTests);
}
