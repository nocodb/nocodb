const create = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    title: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    description: { type: 'string' },
    config: { type: 'string' },
    meta: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title'],
  additionalProperties: false,
};

const update = {
  properties: {
    title: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    description: { type: 'string' },
    config: { type: 'string' },
    meta: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    additionalProperties: false,
  },
  additionalProperties: false,
  minProperties: 1, // at least one property is required for update
};

export default { create, update };
