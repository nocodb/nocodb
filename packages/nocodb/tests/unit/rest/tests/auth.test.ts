import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../init';
import { defaultUserArgs } from '../../factory/user';

// Test case list
// 1. Signup with valid email
// 2. Signup with invalid email
// 3. Signup with invalid password
// 4. Signin with valid credentials
// 5. Signin without email and password
// 6. Signin with invalid credentials
// 7. Signin with invalid password
// 8. me without token
// 9. me with token
// 10. forgot password with non-existing email id
// 11. TBD: forgot password with existing email id
// 12. Change password
// 13. Change password - after logout
// 14. TBD: Reset Password with an invalid token
// 15. TBD: Email validate with an invalid token
// 16. TBD: Email validate with a valid token
// 17. TBD: Forgot password validate with a valid token
// 18. TBD: Reset Password with an valid token
// 19. TBD: refresh token api

function authTests() {
  let context;

  beforeEach(async function () {
    console.time('#### authTests');
    context = await init();
    console.timeEnd('#### authTests');
  });

  it('Signup with valid email', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: 'new@example.com', password: defaultUserArgs.password })
      .expect(200);

    const token = response.body.token;
    expect(token).to.be.a('string');
  });

  it('Signup with invalid email', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: 'test', password: defaultUserArgs.password })
      .expect(400);
  });

  it('Signup with invalid passsword', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: defaultUserArgs.email, password: 'weakpass' })
      .expect(400);
  });

  it('Signin with valid credentials', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({
        email: defaultUserArgs.email,
        password: defaultUserArgs.password,
      })
      .expect(200);
    const token = response.body.token;
    expect(token).to.be.a('string');
  });

  it('Signin without email and password', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send({})
      .expect(401);
  });

  it('Signin with invalid credentials', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({ email: 'abc@abc.com', password: defaultUserArgs.password })
      .expect(400);
  });

  it('Signin with invalid password', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({ email: defaultUserArgs.email, password: 'wrongPassword' })
      .expect(400);
  });

  it('me without token', async () => {
    const response = await request(context.app)
      .get('/api/v1/auth/user/me')
      .unset('xc-auth')
      .expect(200);

    if (!response.body?.roles?.guest) {
      return new Error('User should be guest');
    }
  });

  it('me with token', async () => {
    const response = await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-auth', context.token)
      .expect(200);

    const email = response.body.email;
    expect(email).to.equal(defaultUserArgs.email);
  });

  it('Forgot password with a non-existing email id', async () => {
    await request(context.app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nonexisting@email.com' })
      .expect(400);
  });

  // todo: fix mailer issues
  // it('Forgot password with an existing email id', function () {});

  it('Change password', async () => {
    await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(200);
  });

  it('Change password - after logout', async () => {
    await request(context.app)
      .post('/api/v1/auth/password/change')
      .unset('xc-auth')
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(401);
  });

  // todo:
  it('Reset Password with an invalid token', async () => {
    await request(context.app)
      .post('/api/v1/auth/password/reset/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400);
  });

  it('Email validate with an invalid token', async () => {
    await request(context.app)
      .post('/api/v1/auth/email/validate/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400);
  });

  // todo:
  // it('Email validate with a valid token', async () => {
  //   // await request(context.app)
  //   //   .post('/auth/email/validate/someRandomValue')
  //   //   .send({email: EMAIL_ID})
  //   //   .expect(500, done);
  // });

  // todo:
  // it('Forgot password validate with a valid token', async () => {
  //   // await request(context.app)
  //   //   .post('/auth/token/validate/someRandomValue')
  //   //   .send({email: EMAIL_ID})
  //   //   .expect(500, done);
  // });

  // todo:
  // it('Reset Password with an valid token', async () => {
  //   // await request(context.app)
  //   //   .post('/auth/password/reset/someRandomValue')
  //   //   .send({password: 'anewpassword'})
  //   //   .expect(500, done);
  // });

  // todo: refresh token api
}

export default function () {
  describe('Auth', authTests);
}
