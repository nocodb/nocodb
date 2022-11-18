import { expect } from 'chai'
import 'mocha'
import request from 'supertest'
import { OrgUserRoles } from 'nocodb-sdk'
import init from '../../init'

function authTests() {
  let context

  beforeEach(async function() {
    context = await init()
  })

  it('Get users list', async () => {
    const response = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body).to.have.keys(['list', 'pageInfo'])
    expect(response.body.list).to.have.length(1)

  })

  it('Invite a new user', async () => {

    const response = await request(context.app)
      .post('/api/v1/users')
      .set('xc-auth', context.token).send({ email: 'a@nocodb.com' })
      .expect(200)

    console.log(response.body)

    expect(response.body).to.have.property('invite_token').to.be.a('string')
// todo: verify invite token
  })

  it('Update user role', async () => {
    const email = 'a@nocodb.com'
    // invite a user
    await request(context.app)
      .post('/api/v1/users')
      .set('xc-auth', context.token).send({ email })
      .expect(200)
    const response = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)
    expect(response.body.list).to.have.length(2)

    const user = response.body.list.find(u => u.email === email)

    expect(user).to.have.property('roles').to.be.equal(OrgUserRoles.VIEWER)


    await request(context.app)
      .patch('/api/v1/users/' + user.id)
      .set('xc-auth', context.token)
      .send({ roles: OrgUserRoles.CREATOR })
      .expect(200)


    const response2 = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)
    expect(response2.body.list).to.have.length(2)

    const user2 = response2.body.list.find(u => u.email === email)

    expect(user2).to.have.property('roles').to.be.equal(OrgUserRoles.CREATOR)
  })

  it('Remove user', async () => {
    const email = 'a@nocodb.com'
    // invite a user
    await request(context.app)
      .post('/api/v1/users')
      .set('xc-auth', context.token).send({ email })
      .expect(200)

    const response = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)
    expect(response.body.list).to.have.length(2)

    const user = response.body.list.find(u => u.email === email)

    expect(user).to.have.property('roles').to.be.equal(OrgUserRoles.VIEWER)


    await request(context.app)
      .delete('/api/v1/users/' + user.id)
      .set('xc-auth', context.token)
      .expect(200)


    const response2 = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)
    expect(response2.body.list).to.have.length(1)

  })


  it('Get token list', async () => {
    const response = await request(context.app)
      .get('/api/v1/tokens')
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body).to.have.keys(['list', 'pageInfo'])
    expect(response.body.list).to.have.length(0)

  })

  it('Generate token', async () => {
    const r = await request(context.app)
      .post('/api/v1/tokens')
      .set('xc-auth', context.token)
      .send({ description: 'test' })
      .expect(200)

    const response = await request(context.app)
      .get('/api/v1/tokens')
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body).to.have.keys(['list', 'pageInfo'])
    expect(response.body.list).to.have.length(1)
    expect(response.body.list[0]).to.have.property('token').to.be.a('string')
    expect(response.body.list[0]).to.have.property('description').to.be.a('string').to.be.eq('test')

  })

  it('Delete token', async () => {
    const r = await request(context.app)
      .post('/api/v1/tokens')
      .set('xc-auth', context.token)
      .send({ description: 'test' })
      .expect(200)

    let response = await request(context.app)
      .get('/api/v1/tokens')
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body).to.have.keys(['list', 'pageInfo'])
    expect(response.body.list).to.have.length(1)

    await request(context.app)
      .delete('/api/v1/tokens/' + r.body.token)
      .set('xc-auth', context.token)
      .expect(200)


    response = await request(context.app)
      .get('/api/v1/tokens')
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body).to.have.keys(['list', 'pageInfo'])
    expect(response.body.list).to.have.length(0)

  })

  it.only('Disable/Enable signup', async () => {
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    };


    await request(context.app)
      .post('/api/v1/app-settings')
      .set('xc-auth', context.token)
      .send({ invite_only_signup: true })
      .expect(200)


    const failedRes =  await request(context.app)
        .post('/api/v1/auth/user/signup')
        .send(args)
        .expect(400)

   expect(failedRes.body).to.be.an('object')
     .to.have.property('msg')
     .to.be.equal('Not allowed to signup, contact super admin.')

    await request(context.app)
      .post('/api/v1/app-settings')
      .set('xc-auth', context.token)
      .send({ invite_only_signup: false })
      .expect(200)


    const successRes =  await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200)

    expect(successRes.body).to.be.an('object')
      .to.have.property('token')
      .to.be.a('string')


    const userMeRes =  await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-auth', successRes.body.token)
      .expect(200)

    expect(userMeRes.body).to.be.an('object')
      .to.have.property('email')
      .to.be.eq(args.email)
  })

}

export default function() {
}
