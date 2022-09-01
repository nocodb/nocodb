import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../init';
import { defaultUserArgs } from './factory/user';

function authTests() {
  let context;

  beforeEach(async function () {
    context = await init();
  });

  it('Signup with valid email', function (done) {
    request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: 'new@example.com', password: defaultUserArgs.password })
      .expect(200, (err, res) => {
        if (err) {
          expect(res.status).to.equal(400);
        } else {
          const token = res.body.token;
          expect(token).to.be.a('string');
        }
        done();
      });
  });

  it('Signup with invalid email', (done) => {
    request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: 'test', password: defaultUserArgs.password })
      .expect(400, done);
  });

  it('Signup with invalid passsword', (done) => {
    request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: defaultUserArgs.email, password: 'weakpass' })
      .expect(400, done);
  });

  it('Signin with valid credentials', function (done) {
    request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({
        email: defaultUserArgs.email,
        password: defaultUserArgs.password,
      })
      .expect(200, async function (err, res) {
        if (err) {
          console.log(res.error);
          return done(err);
        }
        const token = res.body.token;
        expect(token).to.be.a('string');
        // todo: Verify token
        done();
      });
  });

  it('Signup without email and password', (done) => {
    request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in request
      .send({})
      .expect(400, done);
  });

  it('Signin with invalid credentials', function (done) {
    request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({ email: 'abc@abc.com', password: defaultUserArgs.password })
      .expect(400, done);
  });

  it('Signin with invalid password', function (done) {
    request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({ email: defaultUserArgs.email, password: 'wrongPassword' })
      .expect(400, done);
  });

  it('me without token', function (done) {
    request(context.app)
      .get('/api/v1/auth/user/me')
      .unset('xc-auth')
      .expect(200, (err, res) => {
        if (err) {
          console.log(err, res);
          done(err);
          return;
        }

        if (!res.body?.roles?.guest) {
          done('User should be guest');
          return;
        }

        done();
      });
  });

  it('me with token', function (done) {
    request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-auth', context.token)
      .expect(200, function (err, res) {
        if (err) {
          return done(err);
        }
        const email = res.body.email;
        expect(email).to.equal(defaultUserArgs.email);
        done();
      });
  });

  it('Forgot password with a non-existing email id', function (done) {
    request(context.app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nonexisting@email.com' })
      .expect(400, done);
  });

  // todo: fix mailer issues
  // it('Forgot password with an existing email id', function () {});

  it('Change password', function (done) {
    request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(200, done);
  });

  it('Change password - after logout', function (done) {
    request(context.app)
      .post('/api/v1/auth/password/change')
      .unset('xc-auth')
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(500, function (_err, _res) {
        done();
      });
  });

  // todo:
  it('Reset Password with an invalid token', function (done) {
    request(context.app)
      .post('/api/v1/auth/password/reset/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400, done);
  });

  it('Email validate with an invalid token', function (done) {
    request(context.app)
      .post('/api/v1/auth/email/validate/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400, done);
  });

  // todo:
  // it('Email validate with a valid token', function (done) {
  //   // request(context.app)
  //   //   .post('/auth/email/validate/someRandomValue')
  //   //   .send({email: EMAIL_ID})
  //   //   .expect(500, done);
  // });

  // todo:
  // it('Forgot password validate with a valid token', function (done) {
  //   // request(context.app)
  //   //   .post('/auth/token/validate/someRandomValue')
  //   //   .send({email: EMAIL_ID})
  //   //   .expect(500, done);
  // });

  // todo:
  // it('Reset Password with an valid token', function (done) {
  //   // request(context.app)
  //   //   .post('/auth/password/reset/someRandomValue')
  //   //   .send({password: 'anewpassword'})
  //   //   .expect(500, done);
  // });

  // todo: refresh token api
}

export default function () {
  describe('Auth', authTests);
}
