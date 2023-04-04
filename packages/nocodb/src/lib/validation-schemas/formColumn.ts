const insert = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    uuid: { type: ['string', 'null'], maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    description: { type: 'string', maxLength: 255 },
    required: { type: 'boolean' },
    show: { type: 'boolean' },
    order: { type: 'number' },
    created_at: {},
    updated_at: {},
    meta: { type: ['string', 'null'] },
    enable_scanner: { type: 'boolean' },
  },

  required: ['id', 'base_id', 'project_id', 'fk_view_id', 'fk_column_id'],
};

const update = {
  type: 'object',
  minProperties: 1,
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    uuid: { type: ['string', 'null'], maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    description: { type: 'string', maxLength: 255 },
    required: { type: 'boolean' },
    show: { type: 'boolean' },
    order: { type: 'number' },
    updated_at: { type: 'string', format: 'date-time' },
    meta: { type: ['string', 'null'] },
    enable_scanner: { type: 'boolean' },
  },

};

export default {
  insert,
  update,
};
