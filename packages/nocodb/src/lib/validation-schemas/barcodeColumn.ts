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
    created_at: {  },
    updated_at: {  },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_barcode_value_column_id',
    'barcode_format',
    'deleted',
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
    created_at: {  },
    updated_at: {  },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_barcode_value_column_id',
    'barcode_format',
    'deleted',
  ],
};

export default {
  create,
  update,
};
