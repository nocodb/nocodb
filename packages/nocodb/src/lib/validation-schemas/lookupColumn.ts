const create = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    fk_column_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_relation_column_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_lookup_column_id: {
      type: 'string',
      maxLength: 20,
    },
    deleted: {
      type: 'boolean',
    },
    created_at: {},
    updated_at: {},
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_lookup_column_id',
  ],
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
      maxLength: 20,
    },
    fk_relation_column_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_lookup_column_id: {
      type: 'string',
      maxLength: 20,
    },
    deleted: {
      type: 'boolean',
    },
    created_at: {},
    updated_at: {},
  },
  minProperties: 1,
};

export default {
  create,
  update,
};
