// Insert schema object
const insert = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_model_id: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 255 },
    description: { type: 'string', maxLength: 255 },
    env: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255 },
    event: { type: 'string', maxLength: 255 },
    operation: { type: 'string', maxLength: 255 },
    async: { type: 'boolean' },
    payload: { type: 'boolean' },
    url: { type: 'string' },
    headers: { type: 'string' },
    condition: { type: 'boolean' },
    notification: { type: 'string' },
    retries: { type: 'integer' },
    retry_interval: { type: 'integer' },
    timeout: { type: 'integer' },
    active: { type: 'boolean' },
  },
  required: [
    'fk_model_id',
    'title',
    'env',
    'type',
    'event',
    'operation',
    'url',
  ],
  additionalProperties: false,
};

// Update schema object
const update = {
  type: 'object',
  properties: {
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_model_id: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 255 },
    description: { type: 'string', maxLength: 255 },
    env: { type: 'string', maxLength: 255 },
    type: { type: 'string', maxLength: 255 },
    event: { type: 'string', maxLength: 255 },
    operation: { type: 'string', maxLength: 255 },
    async: { type: 'boolean' },
    payload: { type: 'boolean' },
    url: { type: 'string' },
    headers: { type: 'string' },
    condition: { type: 'boolean' },
    notification: { type: 'string' },
    retries: { type: 'integer' },
    retry_interval: { type: 'integer' },
    timeout: { type: 'integer' },
    active: { type: 'boolean' },
  },
  minProperties: 1,
  additionalProperties: false,
};

export default {
  insert,
  update,
};
