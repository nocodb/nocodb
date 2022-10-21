import { expect } from 'chai'
import 'mocha'
import request from 'supertest'
import { OrgUserRoles } from '../../../../src/enums/OrgUserRoles'
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

  it.only('Delete token', async () => {
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

}

export default function() {
  describe('Organisation', authTests)
}
