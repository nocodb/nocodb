const create = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    fk_relation_column_id: { type: 'string', maxLength: 20 },
    fk_rollup_column_id: { type: 'string', maxLength: 20 },
    rollup_function: { type: 'string', maxLength: 255 },
    deleted: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_rollup_column_id',
    'rollup_function',
    'deleted',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
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
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'fk_column_id',
    'fk_relation_column_id',
    'fk_rollup_column_id',
    'rollup_function',
    'deleted',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
};


export {
  create,
  update,
}
