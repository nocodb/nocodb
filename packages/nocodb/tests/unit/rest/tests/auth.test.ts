import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../init';
import { createUser, defaultUserArgs, AddResetPasswordToken } from '../../factory/user';
const { v4: uuidv4 } = require('uuid');

function authTests() {
  let context;

  beforeEach(async function () {
    context = await init();
  });

  it('Signup with valid email', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: 'new@example.com', password: defaultUserArgs.password })
      .expect(200)

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

  it('Signup when NC_NO_SIGN_UP is set to 1', async () => {
    process.env.NC_NO_SIGN_UP = '1'
    const response = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email: defaultUserArgs.email, password: defaultUserArgs.password })
      .expect(400);
    
    expect(response.body).to.deep.equal({
      msg: "Sign Up is not allowed!",
    })

    delete process.env.NC_NO_SIGN_UP
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

  it('Signup without email and password', async () => {
    await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send({})
      .expect(400);
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

    expect(response.body).to.deep.equal({
      roles: {
        guest: true,
      },
    })
  });

  it('me with token', async () => {
    const response = await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body).to.containSubset({
      isAuthorized: true,
      email: defaultUserArgs.email,
      email_verified: null,
      firstname: null,
      lastname: null,
      roles: {
        "org-level-creator": true,
        super: true,
        owner: true,
        creator: true,
      }
    })
  });

  it('Forgot password with a non-existing email id', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nonexisting@email.com' })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Your email has not been registered.",
    })
  });

  it('Forgot password with a existing email id', async () => {
    const { user } = await createUser(context, { email: 'existing@email.com' })
    const response = await request(context.app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);
    expect(response.body).to.deep.equal({
      msg: "Please check your email to reset the password",
    })
  });

  it('Change password', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(200);

    expect(response.body).to.deep.equal({
      msg: "Password updated successfully",
    })
  });

  it('Change password errors for missing current password', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Missing new/old password",
    })
  });

  it('Change password errors for missing new password', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: defaultUserArgs.password,
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Missing new/old password",
    })
  });

  it('Change password errors for incorrect current password', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: 'incorrect_password',
        newPassword: 'NEW' + defaultUserArgs.password,
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Current password is wrong",
    })
  });

  it('Change password errors for invalid new password', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/password/change')
      .set('xc-auth', context.token)
      .send({
        currentPassword: defaultUserArgs.password,
        newPassword: 'NEW', //less than 8 chars
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Password : At least 8 letters. ",
    })
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
    const response = await request(context.app)
      .post('/api/v1/auth/password/reset/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Invalid reset url",
    })
  });

  it('Reset Password with an valid token', async () => {
    const { user } = await createUser(context, { email: 'reset-password@email.com' })
    const token = uuidv4();
    await AddResetPasswordToken(user, token, new Date(Date.now() + 60 * 1000));
    const response = await request(context.app)
      .post(`/api/v1/auth/password/reset/${token}`)
      .send({ email: user.email, password: `New ${defaultUserArgs.password}` })
      .expect(200);

    expect(response.body).to.deep.equal({
      msg: "Password reset successful",
    })
  });

  it('Reset Password with an expired token generate errors', async () => {
    const { user } = await createUser(context, { email: 'expired-reset-token@email.com' })
    const token = uuidv4();
    await AddResetPasswordToken(user, token, new Date(Date.now() - 60 * 1000));
    const response = await request(context.app)
      .post(`/api/v1/auth/password/reset/${token}`)
      .send({ email: user.email, password: `New ${defaultUserArgs.password}` })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Password reset url expired",
    })
  });

  it('Reset Password with invalid new password generate errors', async () => {
    const { user } = await createUser(context, { email: 'invalid-new-password@email.com' })
    const token = uuidv4();
    await AddResetPasswordToken(user, token, new Date(Date.now() + 60 * 1000));
    const response = await request(context.app)
      .post(`/api/v1/auth/password/reset/${token}`)
      .send({ 
        email: user.email, 
        password: `INVALID` //Invalid password
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Password : At least 8 letters. ",
    })
  });

  it('Email validate with an invalid token', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/email/validate/someRandomValue')
      .send({ email: defaultUserArgs.email })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Invalid verification url",
    })
  });

  it('Email validate with an valid token', async () => {
    const { user } = await createUser(context, { email: 'validate-token@email.com' })
    const response = await request(context.app)
      .post(`/api/v1/auth/email/validate/${user.email_verification_token}`)
      .send({ email: user.email })
      .expect(200);

    expect(response.body).to.deep.equal({
      msg: "Email verified successfully",
    })
  });

  it('Token validate with a valid token', async () => {
    const { user } = await createUser(context, { email: 'valid-token@email.com' })
    const token = uuidv4();
    await AddResetPasswordToken(user, token, new Date(Date.now() + 60 * 1000));
    const response = await request(context.app)
      .post(`/auth/token/validate/${token}`)
      .send({email: user.email})
      .expect(200);

    expect(response.body).to.be.true;
  });

  it('Token validate with a invalid token', async () => {
    const { user } = await createUser(context, { email: 'invalid-token@email.com' })
    const response = await request(context.app)
      .post(`/auth/token/validate/invalid-token`)
      .send({email: user.email})
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Invalid reset url",
    });
  });  
  
  it('Token validate with an expired token', async () => {
    const { user } = await createUser(context, { email: 'expired-token@email.com' })
    const token = uuidv4();
    await AddResetPasswordToken(user, token, new Date(Date.now() - 60 * 1000));
    const response = await request(context.app)
      .post(`/auth/token/validate/${token}`)
      .send({email: user.email})
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Password reset url expired",
    });
  });

  it('Token refresh', async () => {
    const response = await request(context.app)
      .post(`/auth/token/refresh`)
      .set('Cookie', [`refresh_token=${context.user.refresh_token}`])
      .set('xc-auth', context.token)
      .send()
      .expect(200);

    expect(response.body).to.haveOwnProperty('token')
    expect(response.body.token).to.be.string
  });

  it('Token refresh with no token in cookie generates error', async () => {
    const response = await request(context.app)
      .post(`/auth/token/refresh`)
      .set('xc-auth', context.token)
      .send()
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Missing refresh token",
    })
  });

  it('Token refresh with invalid token in cookie generates error', async () => {
    const response = await request(context.app)
      .post(`/auth/token/refresh`)
      .set('Cookie', [`refresh_token=invalid-token`])
      .set('xc-auth', context.token)
      .send()
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Invalid refresh token",
    })
  });
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
