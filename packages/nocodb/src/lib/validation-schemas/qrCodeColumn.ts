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
    'fk_qr_value_column_id',
    'deleted',
    'order',
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
    'fk_qr_value_column_id',
    'deleted',
    'order',
    'created_at',
    'updated_at',
  ],
};

export default {
  create,
  update,
};
