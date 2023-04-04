const create = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    fk_column_id: {
      type: 'string',
    },
    formula: {
      type: 'string',
    },
    formula_raw: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
    deleted: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    created_at: {},
    updated_at: {},
  },
  required: ['id', 'fk_column_id', 'formula'],
};
const update = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    fk_column_id: {
      type: 'string',
    },
    formula: {
      type: 'string',
    },
    formula_raw: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
    deleted: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    created_at: {},
    updated_at: {},
  },
  minProperties: 1, // at least one property is required for update
};

export default {
  create,
  update,
};
