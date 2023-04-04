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
    created_at: {},
    updated_at: {},
  },
  required: ['id', 'base_id', 'project_id', 'fk_view_id', 'role', 'disabled'],
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
    created_at: {},
    updated_at: {},
  },
  minProperties: 1, // at least one property is required for update
};

export default {
  insert,
  update,
};
