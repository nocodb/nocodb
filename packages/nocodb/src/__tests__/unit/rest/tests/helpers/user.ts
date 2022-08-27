import request from 'supertest';
import User from '../../../../../lib/models/User';

const createUser = async (
  app,
  email = 'test@example.com',
  password = 'A1234abh2@dsad'
) => {
  const response = await request(app)
    .post('/api/v1/auth/user/signup')
    .send({ email, password });
  const user = User.getByEmail(email);
  return { token: response.body.token, user };
};

export { createUser };
