const insert = {
  type: 'object',
  required: ['project_id', 'fk_user_id'],
  properties: {
    project_id: { type: 'string', maxLength: 128 },
    fk_user_id: { type: 'string', maxLength: 20 },
    roles: { type: 'string' },
    starred: { type: 'boolean' },
    pinned: { type: 'boolean' },
    group: { type: 'string', maxLength: 255 },
    color: { type: 'string', maxLength: 255 },
    order: { type: 'number' },
    hidden: { type: 'number' },
    opened_date: { type: 'string', format: 'date-time' }
  }
};

const update = {
  type: 'object',
  minProperties: 1,
  properties: {
    project_id: { type: 'string', maxLength: 128 },
    fk_user_id: { type: 'string', maxLength: 20 },
    roles: { type: 'string' },
    starred: { type: 'boolean' },
    pinned: { type: 'boolean' },
    group: { type: 'string', maxLength: 255 },
    color: { type: 'string', maxLength: 255 },
    order: { type: 'number' },
    hidden: { type: 'number' },
    opened_date: { type: 'string', format: 'date-time' }
  }
};
