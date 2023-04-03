const insert = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    fk_column_id: {
      type: 'string',
    },
    title: {
      type: 'string',
      maxLength: 255,
    },
    color: {
      type: 'string',
      maxLength: 255,
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
    'title',
    'color',
    'order',
    'created_at',
    'updated_at',
  ],
};

const update = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    fk_column_id: {
      type: 'string',
    },
    title: {
      type: 'string',
      maxLength: 255,
    },
    color: {
      type: 'string',
      maxLength: 255,
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
    'title',
    'color',
    'order',
    'created_at',
    'updated_at',
  ],
};

export default {
  insert,
  update,
};
