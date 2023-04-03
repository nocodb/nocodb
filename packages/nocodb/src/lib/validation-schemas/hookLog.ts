const insert = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    base_id: {
      type: 'string',
      maxLength: 20,
    },
    project_id: {
      type: 'string',
      maxLength: 128,
    },
    fk_hook_id: {
      type: 'string',
      maxLength: 20,
    },
    type: {
      type: 'string',
      maxLength: 255,
    },
    event: {
      type: 'string',
      maxLength: 255,
    },
    operation: {
      type: 'string',
      maxLength: 255,
    },
    test_call: {
      type: 'boolean',
    },
    payload: {
      type: 'boolean',
    },
    conditions: {
      type: 'string',
    },
    notification: {
      type: 'string',
    },
    error_code: {
      type: 'string',
      maxLength: 255,
    },
    error_message: {
      type: 'string',
      maxLength: 255,
    },
    error: {
      type: 'string',
    },
    execution_time: {
      type: 'integer',
    },
    response: {
      type: 'string',
      maxLength: 255,
    },
    triggered_by: {
      type: 'string',
      maxLength: 255,
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'fk_hook_id'],
};

const update = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      maxLength: 255,
    },
    event: {
      type: 'string',
      maxLength: 255,
    },
    operation: {
      type: 'string',
      maxLength: 255,
    },
    test_call: {
      type: 'boolean',
    },
    payload: {
      type: 'boolean',
    },
    conditions: {
      type: 'string',
    },
    notification: {
      type: 'string',
    },
    error_code: {
      type: 'string',
      maxLength: 255,
    },
    error_message: {
      type: 'string',
      maxLength: 255,
    },
    error: {
      type: 'string',
    },
    execution_time: {
      type: 'integer',
    },
    response: {
      type: 'string',
      maxLength: 255,
    },
    triggered_by: {
      type: 'string',
      maxLength: 255,
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  minLength: 1,
};

export default {
  insert,
  update,
};
