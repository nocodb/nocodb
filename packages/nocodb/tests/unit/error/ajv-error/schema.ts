/**
 * Test swagger schemas for AJV validation error scenarios.
 *
 * These schemas mimic the structure of real swagger.json / swagger-v3.json
 * component schemas used in NocoDB, covering all major validation keywords
 * that AJV can encounter.
 */

export const testSwaggerSchema = {
  components: {
    schemas: {
      // ─── 1. Basic required fields + type validation ───────────────
      // Cases: missing required field, wrong type, invalid enum value, integer below minimum
      SimpleObject: {
        type: 'object',
        required: ['title', 'type'],
        properties: {
          title: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['table', 'view', 'form'] },
          description: { type: 'string' },
          order: { type: 'integer', minimum: 0 },
        },
      },

      // ─── 2. String constraints ────────────────────────────────────
      // Cases: empty string (minLength), too-long string (maxLength), regex mismatch (pattern), invalid email/uri (format)
      StringConstraints: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
          email: { type: 'string', format: 'email' },
          uri: { type: 'string', format: 'uri' },
        },
      },

      // ─── 3. Numeric constraints ───────────────────────────────────
      // Cases: below minimum, above maximum, at exclusive boundary (exclusiveMinimum/exclusiveMaximum), float where integer expected
      NumericConstraints: {
        type: 'object',
        properties: {
          width: {
            type: 'integer',
            minimum: 50,
            maximum: 5000,
          },
          ratio: {
            type: 'number',
            exclusiveMinimum: 0,
            exclusiveMaximum: 1,
          },
          page: {
            type: 'integer',
            minimum: 1,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
          },
        },
      },

      // ─── 4. Enum validation ───────────────────────────────────────
      // Cases: value not in allowed enum list, missing required enum field, valid enum on optional field
      EnumField: {
        type: 'object',
        required: ['role'],
        properties: {
          role: {
            type: 'string',
            enum: [
              'org-level-creator',
              'org-level-viewer',
              'super',
              'org-level-manager',
            ],
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      },

      // ─── 5. Nested object validation ──────────────────────────────
      // Cases: missing nested required field (meta.icon), invalid nested pattern (meta.color), wrong type in deeply nested prop (meta.options.order)
      NestedObject: {
        type: 'object',
        required: ['meta'],
        properties: {
          meta: {
            type: 'object',
            required: ['icon'],
            properties: {
              icon: { type: 'string' },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              options: {
                type: 'object',
                properties: {
                  collapsed: { type: 'boolean' },
                  order: { type: 'integer' },
                },
              },
            },
          },
        },
      },

      // ─── 6. Simple array validation ───────────────────────────────
      // Cases: empty array (minItems), too many items (maxItems), duplicate items (uniqueItems), wrong item type, empty string in item (item minLength)
      SimpleArray: {
        type: 'object',
        required: ['tags'],
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
          },
        },
      },

      // ─── 7. Nested array of objects ───────────────────────────────
      // Cases: missing required field in array item (columns[i].title), invalid enum in array item (columns[i].uidt), empty array (minItems)
      NestedArrayOfObjects: {
        type: 'object',
        required: ['columns'],
        properties: {
          columns: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['title', 'uidt'],
              properties: {
                title: { type: 'string', minLength: 1 },
                uidt: {
                  type: 'string',
                  enum: [
                    'SingleLineText',
                    'Number',
                    'Checkbox',
                    'Email',
                    'URL',
                    'DateTime',
                  ],
                },
                options: {
                  type: 'object',
                  properties: {
                    defaultValue: {},
                    required: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },

      // ─── 8. Deeply nested array (array of arrays) ────────────────
      // Cases: error at rows[i][j].value path, empty inner array (minItems), wrong type at deep path, missing required in nested item
      DeeplyNestedArray: {
        type: 'object',
        required: ['rows'],
        properties: {
          rows: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['value'],
                properties: {
                  value: {},
                  columnId: { type: 'string' },
                },
              },
            },
          },
        },
      },

      // ─── 9. oneOf — mutually exclusive schemas ────────────────────
      // Cases: matches zero branches, matches multiple branches, missing required from chosen branch, extra properties rejected by branch
      OneOfField: {
        type: 'object',
        required: ['field'],
        properties: {
          field: {
            oneOf: [
              {
                type: 'object',
                required: ['type', 'formula'],
                properties: {
                  type: { type: 'string', enum: ['formula'] },
                  formula: { type: 'string', minLength: 1 },
                },
                additionalProperties: false,
              },
              {
                type: 'object',
                required: ['type', 'linkedTableId'],
                properties: {
                  type: { type: 'string', enum: ['link'] },
                  linkedTableId: { type: 'string' },
                  linkedColumnId: { type: 'string' },
                },
                additionalProperties: false,
              },
              {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['text', 'number', 'checkbox'],
                  },
                  defaultValue: { type: 'string' },
                },
                additionalProperties: false,
              },
            ],
          },
        },
      },

      // ─── 10. anyOf — flexible union types ─────────────────────────
      // Cases: value matching none of the union types (e.g. array for string|number|boolean|null), filter matching neither branch
      AnyOfField: {
        type: 'object',
        properties: {
          value: {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'null' },
            ],
          },
          filter: {
            anyOf: [
              {
                type: 'object',
                required: ['field', 'op', 'value'],
                properties: {
                  field: { type: 'string' },
                  op: {
                    type: 'string',
                    enum: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like'],
                  },
                  value: { type: 'string' },
                },
              },
              {
                type: 'object',
                required: ['logical_op', 'children'],
                properties: {
                  logical_op: {
                    type: 'string',
                    enum: ['and', 'or'],
                  },
                  children: {
                    type: 'array',
                    minItems: 1,
                    items: {}, // recursive-like, accepts anything
                  },
                },
              },
            ],
          },
        },
      },

      // ─── 11. allOf — merged constraints ───────────────────────────
      // Cases: missing required from first sub-schema, missing required from second sub-schema, wrong type across merged properties
      AllOfMerged: {
        allOf: [
          {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['source_id'],
            properties: {
              source_id: { type: 'string' },
              base_id: { type: 'string' },
            },
          },
        ],
      },

      // ─── 12. $ref usage ───────────────────────────────────────────
      // Cases: $ref field gets wrong type (e.g. number for TextOrNull), invalid item in $ref array (columns[i] missing required), error path through $ref
      TextOrNull: {
        oneOf: [{ type: 'string' }, { type: 'null' }],
      },

      WithRef: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: {
            $ref: '#/components/schemas/TextOrNull',
          },
          columns: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ColumnItem',
            },
          },
        },
      },

      ColumnItem: {
        type: 'object',
        required: ['title', 'uidt'],
        properties: {
          title: { type: 'string' },
          uidt: { type: 'string' },
          meta: {
            $ref: '#/components/schemas/TextOrNull',
          },
        },
      },

      // ─── 13. additionalProperties ─────────────────────────────────
      // StrictObject cases: unknown property rejected (additionalProperties: false)
      // DynamicMap cases: map value missing required field, wrong type in map value property
      StrictObject: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
        },
        additionalProperties: false,
      },

      DynamicMap: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['visible'],
          properties: {
            visible: { type: 'boolean' },
            order: { type: 'integer' },
          },
        },
      },

      // ─── 14. Nullable enum (common in filter payloads) ────────────
      // Cases: non-null non-enum value for direction (oneOf fails), wrong type for nullable value, valid null passthrough
      NullableEnum: {
        type: 'object',
        properties: {
          comparison_op: {
            type: 'string',
            enum: ['eq', 'neq', 'like', 'nlike', 'is_null', 'is_not_null'],
          },
          value: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'null' },
            ],
          },
          direction: {
            oneOf: [
              { type: 'string', enum: ['asc', 'desc'] },
              { type: 'null' },
            ],
          },
        },
      },

      // ─── 15. Complex nested + oneOf inside array items ────────────
      // Cases: array item matches no oneOf branch, item matches wrong branch (e.g. delete with row), error path includes array index + oneOf branch, empty operations (minItems), too many items (maxItems)
      BulkOperation: {
        type: 'object',
        required: ['operations'],
        properties: {
          operations: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              oneOf: [
                {
                  type: 'object',
                  required: ['op', 'row'],
                  properties: {
                    op: { type: 'string', enum: ['insert'] },
                    row: {
                      type: 'object',
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  required: ['op', 'rowId', 'row'],
                  properties: {
                    op: { type: 'string', enum: ['update'] },
                    rowId: { type: 'string' },
                    row: {
                      type: 'object',
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  required: ['op', 'rowId'],
                  properties: {
                    op: { type: 'string', enum: ['delete'] },
                    rowId: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              ],
            },
          },
        },
      },

      // ─── 16. Conditional / dependent validation (if-then-else) ────
      // Cases: type="select" without choices (then branch fails), type="text" without value (else branch fails), type="select" with empty choices (minItems in then)
      ConditionalField: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['text', 'number', 'select'] },
          value: {},
          choices: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        if: {
          properties: { type: { const: 'select' } },
        },
        then: {
          required: ['choices'],
          properties: {
            choices: { minItems: 1 },
          },
        },
        else: {
          required: ['value'],
        },
      },

      // ─── 17. Tuple-style array (fixed positional items) ───────────
      // Cases: wrong type at position (string instead of number at [0]), too few items, too many items, extra item beyond prefixItems (items: false)
      TupleArray: {
        type: 'object',
        required: ['range'],
        properties: {
          range: {
            type: 'array',
            items: false,
            prefixItems: [
              { type: 'number', description: 'min value' },
              { type: 'number', description: 'max value' },
            ],
            minItems: 2,
            maxItems: 2,
          },
        },
      },

      // ─── 18. Multiple type errors in one payload ──────────────────
      // Cases: multiple simultaneous errors (allErrors: true) — e.g. missing title + invalid column enum + bad meta.color pattern in one payload
      MultiErrorPayload: {
        type: 'object',
        required: ['title', 'columns', 'meta'],
        properties: {
          title: { type: 'string', minLength: 1 },
          columns: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['title', 'uidt'],
              properties: {
                title: { type: 'string', minLength: 1 },
                uidt: {
                  type: 'string',
                  enum: ['SingleLineText', 'Number', 'Checkbox'],
                },
                width: { type: 'integer', minimum: 50 },
              },
            },
          },
          meta: {
            type: 'object',
            required: ['icon'],
            properties: {
              icon: { type: 'string' },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            },
          },
        },
      },
    },
  },
};
