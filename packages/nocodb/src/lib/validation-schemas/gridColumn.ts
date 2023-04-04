// AJV schema validation for INSERT operation on nc_grid_view_columns_v2 table
const insert = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', minLength: 1 },
    fk_column_id: { type: 'string', minLength: 1 },
    base_id: { type: 'string', minLength: 1 },
    project_id: { type: 'string', minLength: 1 },
    uuid: { type: 'string', maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    width: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
  },
  required: ['fk_view_id', 'fk_column_id'],

};

// AJV schema validation for UPDATE operation on nc_grid_view_columns_v2 table
const update = {
  type: 'object',
  properties: {
    uuid: { type: 'string', maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    width: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
  },

  minProperties: 1,
};

export default {
  insert,
  update,
};
