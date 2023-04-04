const insert = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    uuid: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
    meta: { type: 'string' },
    row_height: { type: 'integer' },
  },
  required: ['fk_view_id', 'base_id', 'project_id',],

};

const update = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    uuid: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
    meta: { type: 'string' },
    row_height: { type: 'integer' },
  },
  minProperties: 1,

};

export default {
  insert,
  update,
};
