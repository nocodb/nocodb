import request from 'supertest';

const createUser = async (app, email, password) => {
  const response = await request(app)
    .post('/api/v1/auth/user/signup')
    .send({ email, password });
  return { token: response.body.token };
};

export { createUser };
