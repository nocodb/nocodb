const create = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    base_id: {
      type: 'string',
      maxLength: 20,
    },
    project_id: {
      type: 'string',
      maxLength: 128,
    },
    fk_model_id: {
      type: 'string',
      maxLength: 20,
    },
    title: {
      type: 'string',
      maxLength: 255,
    },
    column_name: {
      type: 'string',
      maxLength: 255,
    },
    uidt: {
      type: 'string',
      maxLength: 255,
    },
    dt: {
      type: 'string',
      maxLength: 255,
    },
    np: {
      type: 'string',
      maxLength: 255,
    },
    ns: {
      type: 'string',
      maxLength: 255,
    },
    clen: {
      type: 'string',
      maxLength: 255,
    },
    cop: {
      type: 'string',
      maxLength: 255,
    },
    ct: {
      type: 'string',
      maxLength: 255,
    },
    cdf: {
      type: 'string',
      maxLength: 255,
    },
    cc: {
      type: 'string',
      maxLength: 255,
    },
    csn: {
      type: 'string',
      maxLength: 255,
    },
    dtx: {
      type: 'string',
      maxLength: 255,
    },
    dtxp: {
      type: 'string',
      maxLength: 255,
    },
    dtxs: {
      type: 'string',
      maxLength: 255,
    },
    validate: {
      type: 'string',
    },
    meta: {
      type: 'object',
    },
    order: {
      type: 'number',
    },
    virtual: {
      type: 'boolean',
    },
    deleted: {
      type: 'boolean',
    },
    system: {
      type: 'boolean',
    },
  },
  required: ['base_id', 'project_id', 'fk_model_id', 'title'],
  additionalProperties: false,
};

const update = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      maxLength: 255,
    },
    column_name: {
      type: 'string',
      maxLength: 255,
    },
    uidt: {
      type: 'string',
      maxLength: 255,
    },
    dt: {
      type: 'string',
      maxLength: 255,
    },
    np: {
      type: 'string',
      maxLength: 255,
    },
    ns: {
      type: 'string',
      maxLength: 255,
    },
    clen: {
      type: 'string',
      maxLength: 255,
    },
    cop: {
      type: 'string',
      maxLength: 255,
    },
    ct: {
      type: 'string',
      maxLength: 255,
    },
    cdf: {
      type: 'string',
      maxLength: 255,
    },
    cc: {
      type: 'string',
      maxLength: 255,
    },
    csn: {
      type: 'string',
      maxLength: 255,
    },
    dtx: {
      type: 'string',
      maxLength: 255,
    },
    dtxp: {
      type: 'string',
      maxLength: 255,
    },
    dtxs: {
      type: 'string',
      maxLength: 255,
    },
    validate: {
      type: 'string',
    },
    meta: {
      type: 'object',
    },
    order: {
      type: 'number',
    },
    virtual: {
      type: 'boolean',
    },
    deleted: {
      type: 'boolean',
    },
    system: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
  minProperties: 1, // at least one property is required for update
};
