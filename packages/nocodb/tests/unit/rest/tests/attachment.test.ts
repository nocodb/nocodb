import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { OrgUserRoles, ProjectRoles, UITypes } from 'nocodb-sdk';
import 'mocha';
import request from 'supertest';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import {
  createColumn,
  createLookupColumn,
  createLtarColumn,
} from '../../factory/column';
import init from '../../init';

const FILE_PATH = path.join(__dirname, 'test.txt');

function attachmentTests() {
  let context;

  beforeEach(async function () {
    console.time('#### attachmentTests');
    fs.writeFileSync(FILE_PATH, 'test', `utf-8`);
    context = await init();
    console.timeEnd('#### attachmentTests');
  });

  afterEach(function () {
    fs.unlinkSync(FILE_PATH);
  });

  it('Upload file - Super admin', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', context.token)
      .expect(200);

    const attachments = response.body;
    expect(attachments).to.be.an('array');
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH));
  });

  it('Upload file - Without token', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .expect(401);

    const msg = response.body.message;
    expect(msg).to.be.eq('Authentication required - Unauthorized');
  });

  it.skip('Upload file - Org level viewer', async () => {
    // signup a user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    };

    const signupResponse = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200);

    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signupResponse.body.token)
      .expect(400);

    const msg = response.body.msg;
    expect(msg).to.be.eq('Upload not allowed');
  });

  it.skip('Upload file - Org level creator', async () => {
    // signup a user
    const args = {
      email: 'dummyuser@example.com',
      password: 'A1234abh2@dsad',
    };

    await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send(args)
      .expect(200);

    // update user role to creator
    const usersListResponse = await request(context.app)
      .get('/api/v1/db/users')
      .set('xc-auth', context.token)
      .expect(200);

    const user = usersListResponse.body.list.find(
      (u) => u.email === args.email,
    );

    expect(user).to.have.property('roles').to.be.equal(OrgUserRoles.VIEWER);

    await request(context.app)
      .patch('/api/v1/db/users/' + user.id)
      .set('xc-auth', context.token)
      .send({ roles: OrgUserRoles.CREATOR })
      .expect(200);

    const signinResponse = await request(context.app)
      .post('/api/v1/auth/user/signin')
      // pass empty data in await request
      .send(args)
      .expect(200);

    const response = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', signinResponse.body.token)
      .expect(200);

    const attachments = response.body;

    expect(attachments).to.be.an('array');
    expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH));
  });

  // Regression: download an attachment surfaced through a Lookup field.
  //
  // The download endpoint authorises + locates the file by reading a record:
  // (modelId, rowId) -> record, then finds the attachment in record[column].
  // For a lookup the file lives in a RELATED table, so the request must address
  // the PARENT table's row + the LOOKUP column (which the user can read), not
  // the related table. The frontend previously sent the related table's
  // model/column together with the parent row's pk, so the related table was
  // queried with a pk that doesn't exist there -> ERR_RECORD_NOT_FOUND.
  //
  // The parent row's pk is deliberately chosen to NOT exist in the related
  // table — with tiny tables the ids coincide and the bug hides (which is why
  // it couldn't be reproduced locally).
  it('Download attachment via lookup field', async () => {
    const project = await createProject(context, { title: 'LookupAttBase' });

    const documents = await createTable(context, project, {
      title: 'Documents',
      table_name: 'Documents',
    });
    const attachmentCol = await createColumn(context, documents, {
      title: 'File',
      column_name: 'File',
      uidt: UITypes.Attachment,
    });

    const products = await createTable(context, project, {
      title: 'Products',
      table_name: 'Products',
    });

    // upload a real file
    const uploadRes = await request(context.app)
      .post('/api/v1/db/storage/upload')
      .attach('files', FILE_PATH)
      .set('xc-auth', context.token)
      .expect(200);
    const attachment = uploadRes.body[0];
    const urlOrPath = attachment.path || attachment.url;

    // one Documents row (pk = 1) holding the attachment
    const docRowRes = await request(context.app)
      .post(`/api/v1/db/data/noco/${project.id}/${documents.id}`)
      .set('xc-auth', context.token)
      .send({ Title: 'Doc1', File: [attachment] })
      .expect(200);
    const docRowId = docRowRes.body.Id;

    // several Products rows so the linked one's pk (3) does NOT exist in Documents
    let prodRowId;
    for (let i = 1; i <= 3; i++) {
      const r = await request(context.app)
        .post(`/api/v1/db/data/noco/${project.id}/${products.id}`)
        .set('xc-auth', context.token)
        .send({ Title: `Prod${i}` })
        .expect(200);
      prodRowId = r.body.Id;
    }

    // Products --HM--> Documents, link the high-pk product to the document
    const linkCol = await createLtarColumn(context, {
      title: 'Docs',
      parentTable: products,
      childTable: documents,
      type: 'hm',
    });
    await request(context.app)
      .post(
        `/api/v1/db/data/noco/${project.id}/${products.id}/${prodRowId}/hm/${linkCol.id}/${docRowId}`,
      )
      .set('xc-auth', context.token)
      .expect(200);

    // Lookup of Documents.File on Products
    const lookupCol = await createLookupColumn(context, {
      base: project,
      title: 'DocFiles',
      table: products,
      relatedTableName: documents.table_name!,
      relatedTableColumnTitle: 'File',
      relationColumnId: linkCol.id,
    });

    // Old (buggy) coordinates: related model + parent pk -> record not found
    await request(context.app)
      .get(
        `/api/v2/downloadAttachment/${documents.id}/${attachmentCol.id}/${prodRowId}`,
      )
      .query({ urlOrPath })
      .set('xc-auth', context.token)
      .expect(404);

    // Fixed coordinates: parent model + lookup column + parent pk -> signed file
    const fixedRes = await request(context.app)
      .get(
        `/api/v2/downloadAttachment/${products.id}/${lookupCol.id}/${prodRowId}`,
      )
      .query({ urlOrPath })
      .set('xc-auth', context.token)
      .expect(200);

    expect(fixedRes.body.path || fixedRes.body.url).to.be.a('string');
  });

  it('Upload file - Org level viewer with editor role in a base', async () => {
    // skip this test for enterprise edition
    if (!process.env.EE) {
      // signup a new user
      const args = {
        email: 'dummyuser@example.com',
        password: 'A1234abh2@dsad',
      };

      await request(context.app)
        .post('/api/v1/auth/user/signup')
        .send(args)
        .expect(200);

      const newProject = await createProject(context, {
        title: 'NewTitle1',
      });

      // invite user to base with editor role
      await request(context.app)
        .post(`/api/v1/db/meta/projects/${newProject.id}/users`)
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
        .post('/api/v1/db/storage/upload')
        .attach('files', FILE_PATH)
        .set('xc-auth', signinResponse.body.token)
        .expect(200);

      const attachments = response.body;
      expect(attachments).to.be.an('array');
      expect(attachments[0].title).to.be.eq(path.basename(FILE_PATH));
    }
  });
}

export default function () {
  describe('Attachment', attachmentTests);
}
