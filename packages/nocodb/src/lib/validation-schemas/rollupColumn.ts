const insert = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    fk_relation_column_id: { type: 'string', maxLength: 20 },
    fk_rollup_column_id: { type: 'string', maxLength: 20 },
    rollup_function: { type: 'string', maxLength: 255 },
    deleted: { type: 'boolean' },
    created_at: {},
    updated_at: {},
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_rollup_column_id',
    'rollup_function',
  ],

};
const update = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    fk_relation_column_id: { type: 'string', maxLength: 20 },
    fk_rollup_column_id: { type: 'string', maxLength: 20 },
    rollup_function: { type: 'string', maxLength: 255 },
    deleted: { type: 'boolean' },
    created_at: {},
    updated_at: {},
  },

  minProperties: 1,

};

export default {
  insert,
  update,
};
