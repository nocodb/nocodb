const insert = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_hook_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    fk_parent_id: { type: 'string', maxLength: 20 },
    logical_op: { type: 'string', maxLength: 255 },
    comparison_op: { type: 'string', maxLength: 255 },
    value: { type: 'string', maxLength: 255 },
    is_group: { type: 'boolean' },
    order: { type: 'number' },
    comparison_sub_op: { type: 'string', maxLength: 255 },
  },

  required: ['base_id', 'project_id', 'fk_view_id', 'fk_column_id'],
};

const update = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_view_id: { type: 'string', maxLength: 20 },
    fk_hook_id: { type: 'string', maxLength: 20 },
    fk_column_id: { type: 'string', maxLength: 20 },
    fk_parent_id: { type: 'string', maxLength: 20 },
    logical_op: { type: 'string', maxLength: 255 },
    comparison_op: { type: 'string', maxLength: 255 },
    value: { type: 'string', maxLength: 255 },
    is_group: { type: 'boolean' },
    order: { type: 'number' },
    comparison_sub_op: { type: 'string', maxLength: 255 },
  },

  minProperties: 1,
};

export default {
  insert,
  update,
};
