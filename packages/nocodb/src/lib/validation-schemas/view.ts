const insert = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_model_id: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 255 },
    type: { type: 'integer' },
    is_default: { type: 'boolean' },
    show_system_fields: { type: 'boolean' },
    lock_type: { type: 'string', maxLength: 255 },
    uuid: { type: 'string', maxLength: 255 },
    password: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
    meta: { type: 'object' },
  },
  required: ['base_id', 'project_id', 'fk_model_id', 'title'],
  additionalProperties: false,
};

const update = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_model_id: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 255 },
    type: { type: 'integer' },
    is_default: { type: 'boolean' },
    show_system_fields: { type: 'boolean' },
    lock_type: { type: 'string', maxLength: 255 },
    uuid: { type: 'string', maxLength: 255 },
    password: { type: 'string', maxLength: 255 },
    show: { type: 'boolean' },
    order: { type: 'number' },
    meta: { type: 'object' },
  },
  additionalProperties: false,
};

export default {
  insert,
  update,
};
