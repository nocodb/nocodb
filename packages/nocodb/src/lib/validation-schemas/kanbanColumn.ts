// insert schema
const insert = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    uuid: { type: 'string', maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
  },
  required: ['fk_view_id', 'fk_column_id', 'uuid', 'label', 'show', 'order'],

};

// update schema
const update = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    uuid: { type: 'string', maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    help: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
  },
  minProperties: 1, // at least one property is required for update

};

export default {
  insert,
  update,
};
