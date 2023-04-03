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
    fk_barcode_value_column_id: {
      type: 'string',
    },
    barcode_format: {
      type: 'string',
      maxLength: 15,
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
    'fk_barcode_value_column_id',
    'barcode_format',
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
    },
    fk_barcode_value_column_id: {
      type: 'string',
    },
    barcode_format: {
      type: 'string',
      maxLength: 15,
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
    'fk_barcode_value_column_id',
    'barcode_format',
    'deleted',
    'created_at',
    'updated_at',
  ],
};

export default {
  create,
  update,
};
