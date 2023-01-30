import { expect } from 'chai'
import fs from 'fs'
import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk'
import path from 'path'
import 'mocha'
import request from 'supertest'
import { createProject } from '../../factory/project'
import init from '../../init'

const FILE_PATH = path.join(__dirname, 'test.txt')

function attachmentTests() {
  let context


  beforeEach(async function() {
    context = await init()
    fs.writeFileSync(FILE_PATH, 'test', `utf-8`)
    context = await init()
  })


  afterEach(function() {
    fs.unlinkSync(FILE_PATH)
  })


  it('Upload file - Super admin', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', context.token)
      .expect(200)


    const attachments = response.body
    expect(attachments).to.be.an('array')
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH))
  })

  it('Upload file - Without token', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .expect(401)

    const msg = response.body.msg
    expect(msg).to.be.eq('Unauthorized')
  })

  it('Upload file - Org level viewer', async () => {

    // signup a user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    }

    const signupResponse = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200)

    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signupResponse.body.token)
      .expect(400)

    const msg = response.body.msg
    expect(msg).to.be.eq('Upload not allowed')
  })


  it('Upload file - Org level creator', async () => {

    // signup a user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    }


    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200)

    // update user role to creator
    const usersListResponse = await request(context.app)
      .get('/api/v1/users')
      .set('xc-auth', context.token)
      .expect(200)

    const user = usersListResponse.body.list.find(u => u.email === args.email)

    expect(user).to.have.property('roles').to.be.equal(OrgUserRoles.VIEWER)


    await request(context.app)
      .patch('/api/v1/users/' + user.id)
      .set('xc-auth', context.token)
      .send({ roles: OrgUserRoles.CREATOR })
      .expect(200)


    const signinResponse = await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send(args)
      .expect(200)

    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signinResponse.body.token)
      .expect(200)

    const attachments = response.body
    expect(attachments).to.be.an('array')
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH))
  })


  it('Upload file - Org level viewer with editor role in a project', async () => {

    // signup a new user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    }

    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200)

    const newProject = await createProject(context, {
      title: 'NewTitle1',
    })

    // invite user to project with editor role
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${newProject.id}/users`)
      .set('xc-auth', context.token)
      .send({
        roles: ProjectRoles.EDITOR,
        email: args.email,
        project_id: newProject.id,
        projectName: newProject.title,
      })
      .expect(200)

    // signin to get user token
    const signinResponse = await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send(args)
      .expect(200)

    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signinResponse.body.token)
      .expect(200)

    const attachments = response.body
    expect(attachments).to.be.an('array')
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH))
  })

}

export default function() {
  describe('Attachment', attachmentTests)
}
