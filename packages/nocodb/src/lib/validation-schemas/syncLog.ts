const insert = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    fk_sync_source_id: { type: 'string', maxLength: 20 },
    time_taken: { type: 'integer' },
    status: { type: 'string', maxLength: 255 },
    status_details: { type: 'string' },
    created_at: {},
    updated_at: {},
  },
  required: [
    'id',
    'project_id',
    'fk_sync_source_id',
    'time_taken',
    'status',
    'status_details',
  ],

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
    created_at: {},
    updated_at: {},
  },

  minProperties: 1,

};

export default {
  insert,
  update,
};
