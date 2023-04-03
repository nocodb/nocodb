const insert = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', maxLength: 255 },
    firstname: { type: 'string', maxLength: 255 },
    lastname: { type: 'string', maxLength: 255 },
    username: { type: 'string', maxLength: 255 },
    roles: { type: 'string', maxLength: 255 },
    token_version: { type: 'string', maxLength: 255 },
  },
  required: ['email', 'password'],
  additionalProperties: false,
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
  },
  additionalProperties: false,
};

export default {
  insert,
  update,
};
