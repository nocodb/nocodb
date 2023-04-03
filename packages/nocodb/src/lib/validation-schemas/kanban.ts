const insert = {
  type: 'object',
  required: ['fk_view_id', 'project_id'],
  properties: {
    fk_view_id: {
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
    show: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    uuid: {
      type: 'string',
      maxLength: 255,
    },
    title: {
      type: 'string',
      maxLength: 255,
    },
    public: {
      type: 'boolean',
    },
    password: {
      type: 'string',
      maxLength: 255,
    },
    show_all_fields: {
      type: 'boolean',
    },
    fk_grp_col_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_cover_image_col_id: {
      type: 'string',
      maxLength: 20,
    },
    meta: {
      type: 'string',
    },
  },
};

const update = {
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
    show: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    uuid: {
      type: 'string',
      maxLength: 255,
    },
    title: {
      type: 'string',
      maxLength: 255,
    },
    public: {
      type: 'boolean',
    },
    password: {
      type: 'string',
      maxLength: 255,
    },
    show_all_fields: {
      type: 'boolean',
    },
    fk_grp_col_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_cover_image_col_id: {
      type: 'string',
      maxLength: 20,
    },
    meta: {
      type: 'string',
    },
  },
  minProperties: 1,
};

export default {
  insert,
  update,
};
