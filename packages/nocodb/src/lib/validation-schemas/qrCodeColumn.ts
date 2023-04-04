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
    fk_qr_value_column_id: {
      type: 'string',
      maxLength: 20,
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
  required: ['id', 'fk_column_id', 'fk_qr_value_column_id', 'deleted', 'order'],
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
    fk_qr_value_column_id: {
      type: 'string',
      maxLength: 20,
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
  minProperties: 1,
};

export default {
  create,
  update,
};
