const insert = {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 255 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', maxLength: 255 },
    firstname: { type: 'string', maxLength: 255 },
    lastname: { type: 'string', maxLength: 255 },
    username: { type: 'string', maxLength: 255 },
    roles: { type: 'string', maxLength: 255 },
    token_version: { type: 'string', maxLength: 255 },
    salt: { type: 'string', maxLength: 255 },
    email_verification_token: { type: 'string', maxLength: 255 },
    refresh_token: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
  },
  required: ['email'],

};

const update = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', maxLength: 255 },
    firstname: { type: 'string', maxLength: 255 },
    lastname: { type: 'string', maxLength: 255 },
    username: { type: 'string', maxLength: 255 },
    roles: { type: 'string', maxLength: 255 },
    token_version: { type: 'string', maxLength: 255 },
    salt: { type: 'string', maxLength: 255 },
    email_verification_token: { type: 'string', maxLength: 255 },
    refresh_token: { type: 'string', maxLength: 255 },
    created_at: {},
    updated_at: {},
  },

  minProperties: 1,
};

export default {
  insert,
  update,
};
