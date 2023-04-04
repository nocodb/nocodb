const insert = {
  type: 'object',
  required: ['id', 'fk_view_id', 'fk_column_id'],
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    direction: { type: 'string', maxLength: 255 },
    order: { type: 'number' },
  },
};

const update = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    direction: { type: 'string', maxLength: 255 },
    order: { type: 'number' },
  },

  minProperties: 1,
};

export default {
  insert,
  update,
};
