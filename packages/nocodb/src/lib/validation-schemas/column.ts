const insert = {
  $schema: 'http://json-schema.org/draft-07/schema#',
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

    clen: {
      description: 'Character Maximum Length',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    cop: {
      oneOf: [
        {
          type: 'null',
        },
        {
          type: 'number',
        },
        {
          type: 'string',
        },
      ],
    },
    ct: {
      type: 'string',
      maxLength: 255,
    },
    cdf: {
      type: ['string', 'null'],
      maxLength: 255,
    },
    cc: {
      type: ['string', 'null'],
      maxLength: 255,
    },
    csn: {
      type: ['string', 'null'],
      maxLength: 255,
    },
    dtx: {
      type: 'string',
      maxLength: 255,
    },
    dtxp: {
      type: ['string', 'null', 'number'],
      maxLength: 255,
    },
    dtxs: {
      type: ['string', 'null', 'number'],
      maxLength: 255,
    },
    validate: {
      type: 'string',
    },
    meta: {
      type: 'object',
    },

    virtual: {
      type: 'boolean',
    },
    deleted: {
      type: 'boolean',
    },
    np: {
      description: 'Numeric Precision',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    ns: {
      description: 'Numeric Scale',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    order: {
      description: 'The order of the list of columns',
      type: 'number',
    },
    pk: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    pv: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    rqd: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    system: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    un: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    unique: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    visible: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
  },
  required: ['base_id', 'project_id', 'fk_model_id', 'title'],
};

const update = {
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

    clen: {
      description: 'Character Maximum Length',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    cop: {
      description: 'Data Type X Precision',
      oneOf: [
        {
          type: 'null',
        },
        {
          type: 'number',
        },
        {
          type: 'string',
        },
      ],
    },
    ct: {
      type: 'string',
      maxLength: 255,
    },
    cdf: {
      type: ['string', 'null'],
      maxLength: 255,
    },
    cc: {
      type: 'string',
      maxLength: 255,
    },
    csn: {
      type: ['string', 'null'],
      maxLength: 255,
    },
    dtx: {
      type: 'string',
      maxLength: 255,
    },
    dtxp: {
      type: ['string', 'null', 'number'],
      maxLength: 255,
    },
    dtxs: {
      type: ['string', 'null', 'number'],
      maxLength: 255,
    },
    validate: {
      type: 'string',
    },
    meta: {
      type: 'object',
    },

    virtual: {
      type: 'boolean',
    },
    deleted: {
      type: 'boolean',
    },
    np: {
      description: 'Numeric Precision',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    ns: {
      description: 'Numeric Scale',
      oneOf: [
        {
          type: 'integer',
        },
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },
    order: {
      description: 'The order of the list of columns',
      type: 'number',
    },
    pk: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    pv: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    rqd: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    system: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    un: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    unique: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
    visible: {
      $ref: 'swagger.json#/components/schemas/Bool',
    },
  },

  minProperties: 1, // at least one property is required for update
};

export default {
  insert,
  update,
};
