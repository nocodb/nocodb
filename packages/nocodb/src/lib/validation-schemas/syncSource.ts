const insert = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255 },
    details: { type: 'string' },
    deleted: { type: 'boolean' },
    enabled: { type: 'boolean' },
    order: { type: 'number' },
    project_id: { type: 'string', maxLength: 128 },
    fk_user_id: { type: 'string', maxLength: 20 },
    created_at: {  },
    updated_at: {  },
    base_id: { type: 'string', maxLength: 20 },
  },
  required: ['id', 'project_id', ],
  additionalProperties: false,
};

const update = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255 },
    details: { type: 'string' },
    deleted: { type: 'boolean' },
    enabled: { type: 'boolean' },
    order: { type: 'number' },
    project_id: { type: 'string', maxLength: 128 },
    fk_user_id: { type: 'string', maxLength: 20 },
    created_at: {  },
    updated_at: {  },
    base_id: { type: 'string', maxLength: 20 },
  },
  additionalProperties: false,
};

export default {
  insert,
  update,
};
