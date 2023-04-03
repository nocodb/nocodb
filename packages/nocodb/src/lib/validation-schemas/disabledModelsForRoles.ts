const insert = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://example.com/nc_disabled_models_for_role_v2.schema.json',
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
    fk_view_id: {
      type: 'string',
      maxLength: 20,
    },
    role: {
      type: 'string',
      maxLength: 45,
    },
    disabled: {
      type: 'boolean',
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
  required: [
    'id',
    'base_id',
    'project_id',
    'fk_view_id',
    'role',
    'disabled',
    'created_at',
    'updated_at',
  ],
};

const update = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://example.com/nc_disabled_models_for_role_v2.schema.json',
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
    fk_view_id: {
      type: 'string',
      maxLength: 20,
    },
    role: {
      type: 'string',
      maxLength: 45,
    },
    disabled: {
      type: 'boolean',
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
  required: [
    'id',
    'base_id',
    'project_id',
    'fk_view_id',
    'role',
    'disabled',
    'created_at',
    'updated_at',
  ],
};
