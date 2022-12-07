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

  it.only('Verify nested pages', async () => {
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
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        parentPageId: id,
        title: 'nested test',
        content: 'test',
      })
      .expect(200)

    expect(response.body.parent_page_id).to.equal(id)

    // get nested page
    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .query({ parentPageId: id })
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal('nested test')
    expect(response.body[0].is_parent).to.equal(0)
    
    // get top level pages
    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)

    expect(response.body.length).to.equal(1)
    expect(response.body[0].title).to.equal('test')
    expect(response.body[0].is_parent).to.equal(1)
  })
}

export default function() {
  describe('NocoDocs', docTests)
}