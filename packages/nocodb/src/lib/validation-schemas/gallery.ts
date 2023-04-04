const insert = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    next_enabled: { type: 'boolean' },
    prev_enabled: { type: 'boolean' },
    cover_image_idx: { type: 'integer' },
    fk_cover_image_col_id: { type: 'string', maxLength: 20 },
    cover_image: { type: 'string', maxLength: 255 },
    restrict_types: { type: 'string', maxLength: 255 },
    restrict_size: { type: 'string', maxLength: 255 },
    restrict_number: { type: 'string', maxLength: 255 },
    public: { type: 'boolean' },
    dimensions: { type: 'string', maxLength: 255 },
    responsive_columns: { type: 'string', maxLength: 255 },
    meta: { type: 'string' },
  },

  required: ['fk_view_id'],
};

const update = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    next_enabled: { type: 'boolean' },
    prev_enabled: { type: 'boolean' },
    cover_image_idx: { type: 'integer' },
    fk_cover_image_col_id: { type: 'string', maxLength: 20 },
    cover_image: { type: 'string', maxLength: 255 },
    restrict_types: { type: 'string', maxLength: 255 },
    restrict_size: { type: 'string', maxLength: 255 },
    restrict_number: { type: 'string', maxLength: 255 },
    public: { type: 'boolean' },
    dimensions: { type: 'string', maxLength: 255 },
    responsive_columns: { type: 'string', maxLength: 255 },
    meta: { type: 'string' },
  },
  minProperties: 1,

};

export default {
  insert,
  update,
};
