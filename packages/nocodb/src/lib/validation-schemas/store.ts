const insert = {
  type: 'object',
  properties: {
    project_id: { type: 'string', maxLength: 255 },
    db_alias: { type: 'string', maxLength: 255, default: 'db' },
    key: { type: 'string', maxLength: 255 },
    value: { type: 'string' },
    type: { type: 'string', maxLength: 255 },
    env: { type: 'string', maxLength: 255 },
    tag: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
  },
  required: ['key', 'value'],
};

const update = {
  type: 'object',
  properties: {
    project_id: { type: 'string', maxLength: 255 },
    db_alias: { type: 'string', maxLength: 255, default: 'db' },
    key: { type: 'string', maxLength: 255 },
    value: { type: 'string' },
    type: { type: 'string', maxLength: 255 },
    env: { type: 'string', maxLength: 255 },
    tag: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
  },
  minProperties: 1,
};

export default {
  insert,
  update,
};
