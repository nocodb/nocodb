import {expect} from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../init';
import {defaultUserArgs} from "../../factory/user";
import {WorkspaceUserRoles} from "nocodb-sdk";

function workspaceTests() {
  let context;

  beforeEach(async function () {
    context = await init();
  });

  it('Create workspace', async () => {
    const response = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send({title: 'Workspace', description: 'Workspace description'})
      .expect(200)


    expect(response.body.id).to.be.a('string');
    expect(response.body.description).to.be.eq('Workspace description');
    expect(response.body.title).to.be.eq('Workspace');
  });

  it('Create multiple workspaces', async () => {
    const workspaceCreateReqBody = {title: 'Workspace1,Workspace2,Workspace3', description: 'Workspace description'}

    const response = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send(workspaceCreateReqBody)
      .expect(200)

    expect(response.body).to.be.an('array');

    for (let i=0;i<response.body.length;i++) {
      const workspace = response.body[i]
      expect(workspace.id).to.be.a('string');
      expect(workspace.title).to.be.eq(workspaceCreateReqBody.title.split(',')[i]);
      expect(workspace.description).to.be.eq('Workspace description');
    }
  });

  it('Update workspace', async () => {
    let response = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send({title: 'Workspace', description: 'Workspace description'})
      .expect(200)

    expect(response.body.title).to.be.eq('Workspace');


    await request(context.app)
      .patch(`/api/v1/workspaces/${response.body.id}`)
      .set('xc-auth', context.token)
      .send({title: 'Workspace1'})
      .expect(200)

    response = await request(context.app)
      .get(`/api/v1/workspaces/${response.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)

    expect(response.body.title).to.be.eq('Workspace1');

  });

  it('Delete workspace', async () => {
    let response = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send({title: 'Workspace', description: 'Workspace description'})
      .expect(200)

    expect(response.body.title).to.be.eq('Workspace');


    await request(context.app)
      .delete(`/api/v1/workspaces/${response.body.id}`)
      .set('xc-auth', context.token)
      .expect(200)

    await request(context.app)
      .get(`/api/v1/workspaces/${response.body.id}`)
      .set('xc-auth', context.token)
      .expect(400)

  });

  it('Invite user to workspace', async () => {
    let response = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send({title: 'Workspace', description: 'Workspace description'})
      .expect(200)

    expect(response.body.title).to.be.eq('Workspace');

    // signin a with new email id
    const signinResponse = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({email: 'new@example.com', password: defaultUserArgs.password})
      .expect(200)

    // invite newly added user to workspace
   const workspaceList =  await request(context.app)
      .get(`/api/v1/workspaces`)
      .send({
        email: 'new@example.com',
        role: WorkspaceUserRoles.CREATOR
      })
      .set('xc-auth', signinResponse.body.token)
      .expect(200)

    expect(workspaceList.body.list).has.length(1)

  });
}

export default function () {
  describe('Workspace', workspaceTests);
}
