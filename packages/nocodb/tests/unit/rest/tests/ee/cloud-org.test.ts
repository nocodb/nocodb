import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../../init';

// Test case list in this file
// 1. Get users list
// 2. Invite a new user
// 3. Update user role
// 4. Remove user
// 5. Get token list
// 6. Generate token
// 7. Delete token
// 8. Disable/Enable signup

function cloudOrgTests() {
  let context;
  let org;

  beforeEach(async function () {
    console.time('#### cloudOrgTests');
    context = await init();
    org = (
      await request(context.app)
        .post(`/api/v2/orgs/workspaces/${context.fk_workspace_id}/upgrade`)
        .set('xc-auth', context.token)
        .expect(200)
    ).body;
  });

  it('Create and move workspace to org', async () => {
    const workspace = (
      await request(context.app)
        .post('/api/v1/workspaces/')
        .set('xc-auth', context.token)
        .send({
          title: 'Workspace',
          meta: {
            color: '#146C8E',
          },
        })
    ).body;

    await request(context.app)
      .post(`/api/v2/orgs/${org.id}/workspaces/${workspace.id}`)
      .set('xc-auth', context.token)
      .expect(200);

    const updatedWorkspace = (
      await request(context.app)
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('xc-auth', context.token)
    ).body;

    expect(updatedWorkspace.workspace)
      .to.have.property('fk_org_id')
      .to.be.a('string')
      .to.be.eq(org.id);
  });

  it('Move non-existing workspace to org', async () => {
    const invalidWorkspaceId = 'invalid-workspace-id';

    const res = await request(context.app)
      .post(`/api/v2/orgs/${org.id}/workspaces/${invalidWorkspaceId}`)
      .set('xc-auth', context.token)
      .expect(404);

    expect(res.body.error).to.be.eq('ERR_WORKSPACE_NOT_FOUND');
  });

  it('Move workspace owned by someone else', async () => {
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    };
    const successRes = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200);

    expect(successRes.body)
      .to.be.an('object')
      .to.have.property('token')
      .to.be.a('string');

    const workspace = (
      await request(context.app)
        .post('/api/v1/workspaces/')
        .set('xc-auth', successRes.body.token)
        .send({
          title: 'Workspace',
          meta: {
            color: '#146C8E',
          },
        })
    ).body;

    const res = await request(context.app)
      .post(`/api/v2/orgs/${org.id}/workspaces/${workspace.id}`)
      .set('xc-auth', context.token)
      .expect(403);

    expect(res.body)
      .to.have.property('message')
      .to.be.a('string')
      .to.be.eq('Forbidden - You are not the owner of the workspace');
  });

  it('Update org title', async () => {
    expect(org)
      .to.have.property('title')
      .to.be.a('string')
      .to.be.eq('Organization Name');

    const newTitle = 'Updated Title';

    await request(context.app)
      .patch(`/api/v2/orgs/${org.id}`)
      .set('xc-auth', context.token)
      .send({ title: newTitle })
      .expect(200);

    const updatedOrg = (
      await request(context.app)
        .get(`/api/v2/orgs/${org.id}`)
        .set('xc-auth', context.token)
    ).body;

    expect(updatedOrg)
      .to.have.property('title')
      .to.be.a('string')
      .to.be.eq(newTitle);
  });
}
export default function () {
  if (process.env.EE) {
    describe('Cloud Org', cloudOrgTests);
  }
}
