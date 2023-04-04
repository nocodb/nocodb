const create = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    title: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    description: { type: 'string' },
    config: { type: 'string' },
    meta: { type: ['string', 'null'] },
    created_at: {},
    updated_at: {},
  },
  required: ['id', 'title'],

};

const update = {
  properties: {
    title: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    description: { type: 'string' },
    config: { type: 'string' },
    meta: { type: ['string', 'null'] },
    created_at: {},
    updated_at: {},

  },

  minProperties: 1, // at least one property is required for update
};

export default { create, update };
