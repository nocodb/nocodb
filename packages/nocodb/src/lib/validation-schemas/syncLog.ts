const insert = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_sync_source_id: { type: 'string', maxLength: 20 },
    time_taken: { type: 'integer' },
    status: { type: 'string', maxLength: 255 },
    status_details: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'project_id',
    'fk_sync_source_id',
    'time_taken',
    'status',
    'status_details',
  ],
  additionalProperties: false,
};

const update = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_sync_source_id: { type: 'string', maxLength: 20 },
    time_taken: { type: 'integer' },
    status: { type: 'string', maxLength: 255 },
    status_details: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  anyOf: [
    { required: ['id'] },
    { required: ['project_id'] },
    { required: ['fk_sync_source_id'] },
    { required: ['time_taken'] },
    { required: ['status'] },
    { required: ['status_details'] },
    { required: ['created_at'] },
    { required: ['updated_at'] },
  ],
  additionalProperties: false,
};

export default {
  insert,
  update,
};
