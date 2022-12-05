import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createProject } from '../../factory/project';
import init from '../../init';

function docTests() {
  let context;
  let project;

  beforeEach(async function () {
    context = await init();
    project = await createProject(context, { name: 'test', type: 'docs' });
  });

  it('Page list', async () => {
    const response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
    console.log(response.body)
  })

  it('Create and delete page', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        title: 'test',
        content: 'test',
      })
      .expect(200)
    expect(response.body).to.have.property('id');

    response = await request(context.app)
      .delete(`/api/v1/docs/page/${response.body.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    response = await request(context.app)
    .get(`/api/v1/docs/pages`)
    .set('xc-auth', context.token)
    .send({})
    .expect(200)
    expect(response.body.length).to.equal(0)
  });

  it('Create and get page', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        title: 'test',
        content: 'test',
      })
      .expect(200)
      expect(response.body).to.have.property('id');

    const id = response.body.id
    response = await request(context.app)
      .get(`/api/v1/docs/page/${response.body.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    expect(response.body.id).to.equal(id)
  });
}

export default function() {
  describe('NocoDocs', docTests)
}