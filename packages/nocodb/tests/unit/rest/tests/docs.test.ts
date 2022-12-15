import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { createProject } from '../../factory/project';
import init, { NcUnitContext } from '../../init';

function docTests() {
  let context: NcUnitContext;
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
        attributes: {
          title: 'test',
          content: 'test',
        }
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
        attributes: {
          title: 'test',
          content: 'test',
        }
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

  it('Verify nested pages', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test',
          content: 'test',
        }
      })
      .expect(200)
    expect(response.body).to.have.property('id');

    const id = response.body.id
    response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: id,
          title: 'nested test',
          content: 'test',
        }
      })
      .expect(200)

    expect(response.body.parent_page_id).to.equal(id)

    // get nested page
    response = await request(context.app)
      .get(`/api/v1/docs/pages`)
      .query({ parent_page_id: id })
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

  it('Update page', async () => {
    let response = await request(context.app)
    .post(`/api/v1/docs/page`)
    .set('xc-auth', context.token)
    .send({
      projectId: project.id,
      attributes: {
        title: 'test',
        content: 'test',
      }
    })
    .expect(200)
    expect(response.body).to.have.property('id');

    const id = response.body.id
    response = await request(context.app)
      .put(`/api/v1/docs/page/${id}`)
      .set('xc-auth', context.token)
      .send({
        attributes: {
          title: 'test2',
          content: 'test2',
        }
      })
      .expect(200)
    
    expect(response.body.title).to.equal('test2')
    expect(response.body.last_updated_by_id).to.equal(context.user.id)
  })

  it('Update non existing page', async () => {
    const response = await request(context.app)
      .put(`/api/v1/docs/page/non-existing-id`)
      .set('xc-auth', context.token)
      .send({
        attributes: {
          title: 'test2',
          content: 'test2',
        }
      })
      .expect(400)
    
    expect(response.body.msg).to.equal('Page not found')
  })

  it('Update parent id should update is_parent attribute of that parent', async () => {
    let response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test',
          content: 'test',
        }
      })
      .expect(200)
    expect(response.body).to.have.property('id');

    const parentId = response.body.id

    response = await request(context.app)
      .post(`/api/v1/docs/page`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          parent_page_id: parentId,
          title: 'nested test',
          content: 'test',
        }
      })
      .expect(200)
    
    const childId = response.body.id
    expect(response.body.parent_page_id).to.equal(parentId)
    expect(response.body.is_parent).to.equal(0)

    response = await request(context.app)
      .get(`/api/v1/docs/page/${parentId}`)
      .set('xc-auth', context.token)
      .send();
    expect(response.body.is_parent).to.equal(1)

    response = await request(context.app)
      .put(`/api/v1/docs/page/${childId}`)
      .set('xc-auth', context.token)
      .send({
        projectId: project.id,
        attributes: {
          title: 'test2',
          content: 'test2',
          parent_page_id: null,
        }
      })
      .expect(200)
    expect(response.body.parent_page_id).to.equal(null)

    response = await request(context.app)
    .get(`/api/v1/docs/page/${parentId}`)
    .set('xc-auth', context.token)
    .send();
    expect(response.body.is_parent).to.equal(0)
  })
}

export default function() {
  describe('NocoDocs', docTests)
}