import request from 'supertest';
import { User } from '../../../src/models'

const defaultUserArgs = {
  email: 'test@example.com',
  password: 'A1234abh2@dsad',
};

const createUser = async (context, userArgs = {}) => {
  const args = { ...defaultUserArgs, ...userArgs };
  const response = await request(context.app)
    .post('/api/v1/auth/user/signup')
    .send(args);
  const user = await User.getByEmail(args.email);
  return { token: response.body.token, user };
};

export { createUser, defaultUserArgs };
