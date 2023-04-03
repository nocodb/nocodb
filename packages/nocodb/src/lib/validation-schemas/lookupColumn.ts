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
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_lookup_column_id',
    'deleted',
    'created_at',
    'updated_at',
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
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_lookup_column_id',
    'deleted',
    'created_at',
    'updated_at',
  ],
};

export default {
  create,
  update,
};
