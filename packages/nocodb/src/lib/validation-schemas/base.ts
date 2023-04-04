const create = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    alias: { type: 'string', maxLength: 255 },
    config: { type: 'string' },
    meta: { type: ['string', 'null'] },
    is_meta: { type: 'boolean' },
    type: { type: 'string', maxLength: 255 },
    inflection_column: { type: 'string', maxLength: 255 },
    inflection_table: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
    enabled: { type: 'boolean', default: true },
    order: { type: 'number' },
    erd_uuid: { type: 'string', maxLength: 255 },
  },
  required: ['id', 'project_id'],

};
const update = {
  type: 'object',
  properties: {
    alias: { type: 'string', maxLength: 255 },
    config: { type: 'string' },
    meta: { type: ['string','null'] },
    is_meta: { type: 'boolean' },
    type: { type: 'string', maxLength: 255 },
    inflection_column: { type: 'string', maxLength: 255 },
    inflection_table: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
    enabled: { type: 'boolean', default: true },
    order: { type: 'number' },
    erd_uuid: { type: 'string', maxLength: 255 },
  },

  minProperties: 1, // at least one property is required for update
};

export default { create, update };
