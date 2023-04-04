// Insert schema
const insert = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    meta: { type: 'string' },
    query_params: { type: 'string' },
    view_id: { type: 'string', maxLength: 255 },
    show_all_fields: { type: 'boolean' },
    allow_copy: { type: 'boolean' },
    password: { type: 'string', maxLength: 255 },
    deleted: { type: 'boolean' },
    order: { type: 'number' },
  },
  required: ['fk_view_id', 'view_id'],

};

// Update schema
const update = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    meta: { type: 'string' },
    query_params: { type: 'string' },
    view_id: { type: 'string', maxLength: 255 },
    show_all_fields: { type: 'boolean' },
    allow_copy: { type: 'boolean' },
    password: { type: 'string', maxLength: 255 },
    deleted: { type: 'boolean' },
    order: { type: 'number' },
  },

  minProperties: 1,
};

export default {
  insert,
  update,
};
