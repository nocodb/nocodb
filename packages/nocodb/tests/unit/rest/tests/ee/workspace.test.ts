import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createProject } from '../../../factory/project';
import init from '../../../init';

function workspaceTests() {
  let context;

  beforeEach(async function () {
    console.time('#### workspaceTests');
    context = await init();
    await createProject(context);
    console.timeEnd('#### workspaceTests');
  });

  it('Create WorkSpace', async () => {
    const title = 'Sakila01';
    const color = '#4351E8';

    const response = await request(context.app)
      .post(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
      })
      .expect(201);

    expect(response.body).to.have.property('id');
    expect(response.body).to.have.property('title');
    expect(response.body).to.have.property('meta');
    expect(response.body.meta).to.have.property('color');

    if (response.body.title !== title || response.body.meta.color !== color) {
      throw new Error('Workspace creation failed');
    }
  });

  it('List Workspaces', async () => {
    const title = 'Sakila01';
    const color = '#4351E8';

    await request(context.app)
      .post(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
      })
      .expect(201);

    const response = await request(context.app)
      .get(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .expect(200);

    if (
      response.body.list[1].title !== 'Sakila01' ||
      response.body.list[1].meta.color !== '#4351E8'
    ) {
      throw new Error('Workspace listing failed');
    }
  });

  it('Delete Workspace', async () => {
    const title = 'Sakila01';
    const color = '#4351E8';

    const workspace = await request(context.app)
      .post(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
      })
      .expect(201);
    await request(context.app)
      .delete(`/api/v1/workspaces/${workspace.body.id}`)
      .set('xc-auth', context.token)
      .expect(200);
  });

  it('Update Workspace', async () => {
    const title = 'Sakila01';
    const color = '#4351E8';

    const workspace = await request(context.app)
      .post(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .send({
        title,
        meta: {
          color,
        },
      })
      .expect(201);

    await request(context.app)
      .patch(`/api/v1/workspaces/${workspace.body.id}`)
      .set('xc-auth', context.token)
      .send({ title: 'Sakila02' })
      .expect(200);

    const response = await request(context.app)
      .get(`/api/v1/workspaces`)
      .set('xc-auth', context.token)
      .expect(200);

    if (response.body.list[1].title !== 'Sakila02') {
      throw new Error('Workspace update failed');
    }
  });
}

export default function () {
  if (process.env.EE) {
    describe('Workspace', workspaceTests);
  }
}
