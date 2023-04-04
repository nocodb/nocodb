const create = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    table_name: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255, default: 'table' },
    meta: { type: 'string' },
    schema: { type: 'string' },
    enabled: { type: 'boolean', default: true },
    mm: { type: 'boolean', default: false },
    tags: { type: 'string', maxLength: 255 },
    pinned: { type: 'boolean' },
    deleted: { type: 'boolean' },
    order: { type: 'number' },
    created_at: {  },
    updated_at: {  },
  },
  required: ['id', 'base_id', 'project_id', 'table_name', 'title'],
  additionalProperties: false,
};

const update = {
  type: 'object',
  properties: {
    table_name: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255, default: 'table' },
    meta: { type: 'string' },
    schema: { type: 'string' },
    enabled: { type: 'boolean', default: true },
    mm: { type: 'boolean', default: false },
    tags: { type: 'string', maxLength: 255 },
    pinned: { type: 'boolean' },
    deleted: { type: 'boolean' },
    order: { type: 'number' },
    created_at: {  },
    updated_at: {  },
  },
  additionalProperties: false,
  minProperties: 1, // at least one property is required for update
};

export default { create, update };
