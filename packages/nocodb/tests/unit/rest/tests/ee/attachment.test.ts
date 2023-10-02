import { expect } from 'chai';
import fs from 'fs';
import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import path from 'path';
import 'mocha';
import request from 'supertest';
import { createProject } from '../../../factory/base';
import init from '../../../init';

const FILE_PATH = path.join(__dirname, 'test.txt');

function attachmentTestsEE() {
  let context;

  beforeEach(async function () {
    console.time('#### attachmentTests');
    context = await init();
    fs.writeFileSync(FILE_PATH, 'test', `utf-8`);
    context = await init();
    console.timeEnd('#### attachmentTests');
  });

  afterEach(function () {
    fs.unlinkSync(FILE_PATH);
  });

  it('Upload file - Org level viewer with editor role in a base', async () => {
    // signup a new user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    };

    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200);

    const wsList = await request(context.app)
      .get('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .expect(200);

    const newProject = await createProject(context, {
      title: 'NewTitle1',
      fk_workspace_id: wsList.body.list[0].id,
      type: 'database',
    });

    // add user to WS
    await request(context.app)
      .post(`/api/v1/workspaces/${wsList.body.list[0].id}/invitations`)
      .set('xc-auth', context.token)
      .send({
        roles: WorkspaceUserRoles.EDITOR,
        email: args.email,
      })
      .expect(201);

    // invite user to base with editor role
    await request(context.app)
      .post(`/api/v1/meta/bases/${newProject.id}/users`)
      .set('xc-auth', context.token)
      .send({
        roles: ProjectRoles.EDITOR,
        email: args.email,
        base_id: newProject.id,
        baseName: newProject.title,
      })
      .expect(200);

    // signin to get user token
    const signinResponse = await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send(args)
      .expect(200);

    const response = await request(context.app)
      .post('/api/v1/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signinResponse.body.token)
      .expect(200);

    const attachments = response.body;
    expect(attachments).to.be.an('array');
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH));
  });
}

export default function () {
  if (process.env.EE) {
    describe('Attachment', attachmentTestsEE);
  }
}
