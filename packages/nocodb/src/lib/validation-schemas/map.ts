// INSERT validation schema
const insert = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    uuid: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    fk_geo_data_col_id: { type: 'string', maxLength: 20 },
    meta: { type: 'string' },
    created_at: {},
    updated_at: {},
  },
  required: [
    'fk_view_id',
    'base_id',
    'project_id',
    'uuid',
    'title',
    'fk_geo_data_col_id',
  ],
};

// UPDATE validation schema
const update = {
  type: 'object',
  properties: {
    uuid: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    fk_geo_data_col_id: { type: 'string', maxLength: 20 },
    meta: { type: 'string' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  minProperties: 1,
};

export default {
  insert,
  update,
};
