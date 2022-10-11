import 'mocha'
import request from 'supertest'
import { createTable } from '../../factory/table'
import init from '../../init/index'
import { createProject, createSharedBase } from '../../factory/project'
import { beforeEach } from 'mocha'
import { Exception } from 'handlebars'
import Project from '../../../../src/lib/models/Project'
import { expect } from 'chai'

function projectTest() {
  let context
  let project

  beforeEach(async function() {
    context = await init()

    project = await createProject(context)
  })

  it('Get project info', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
  })

  // todo: Test by creating models under project and check if the UCL is working
  it('UI ACL', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/visibility-rules`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
  })
  // todo: Test creating visibility set

  it('List projects', async () => {
    const response = await request(context.app)
      .get('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({})
      .expect(200)

    if (response.body.list.length !== 1) new Error('Should list only 1 project')
    if (!response.body.pageInfo) new Error('Should have pagination info')
  })

  it('Create project', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({
        title: 'Title1',
      })
      .expect(200)

    const newProject = await Project.getByTitleOrId(response.body.id)
    if (!newProject) return new Error('Project not created')
  })

  it('Create projects with existing title', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({
        title: project.title,
      })
      .expect(400)
  })

  // todo: fix passport user role popluation bug
  // it('Delete project', async async () => {
  //   const toBeDeletedProject = await createProject(app, token, {
  //     title: 'deletedTitle',
  //   });
  //   await request(app)
  //     .delete('/api/v1/db/meta/projects/${toBeDeletedProject.id}')
  //     .set('xc-auth', token)
  //     .send({
  //       title: 'Title1',
  //     })
  //     .expect(200, async (err) => {
  //       // console.log(res);
  //

  //       const deletedProject = await Project.getByTitleOrId(
  //         toBeDeletedProject.id
  //       );
  //       if (deletedProject) return new Error('Project not delete');

  //       new Error();
  //     });
  // });

  it('Read project', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    if (response.body.id !== project.id) return new Error('Got the wrong project')
  })

  it('Update projects', async () => {
    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'NewTitle',
      })
      .expect(200)

    const newProject = await Project.getByTitleOrId(project.id)
    if (newProject.title !== 'NewTitle') {
      return new Error('Project not updated')
    }
  })

  it('Update projects with existing title', async function() {
    const newProject = await createProject(context, {
      title: 'NewTitle1',
    })

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send({
        title: newProject.title,
      })
      .expect(400)
  })

  it('Create project shared base', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'viewer',
        password: 'test',
      })
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    if (
      !updatedProject.uuid ||
      updatedProject.roles !== 'viewer' ||
      updatedProject.password !== 'test'
    ) {
      return new Error('Shared base not configured properly')
    }
  })

  it('Created project shared base should have only editor or viewer role', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'test',
      })
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    if (updatedProject.roles === 'commenter') {
      return new Error('Shared base not configured properly')
    }
  })

  it('Updated project shared base should have only editor or viewer role', async () => {
    await createSharedBase(context.app, context.token, project)

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'test',
      })
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    if (updatedProject.roles === 'commenter') {
      throw new Exception('Shared base not updated properly')
    }
  })

  it('Updated project shared base', async () => {
    await createSharedBase(context.app, context.token, project)

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'editor',
        password: 'test',
      })
      .expect(200)
    const updatedProject = await Project.getByTitleOrId(project.id)

    if (updatedProject.roles !== 'editor') {
      throw new Exception('Shared base not updated properly')
    }
  })

  it('Get project shared base', async () => {
    await createSharedBase(context.app, context.token, project)

    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)
    if (!updatedProject.uuid) {
      throw new Exception('Shared base not created')
    }
  })

  it('Delete project shared base', async () => {
    await createSharedBase(context.app, context.token, project)

    await request(context.app)
      .delete(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
    const updatedProject = await Project.getByTitleOrId(project.id)
    if (updatedProject.uuid) {
      throw new Exception('Shared base not deleted')
    }
  })

  // todo: Do compare api test

  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
  })

  it('Meta diff sync', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
  })

  // todo: improve test. Check whether the all the actions are present in the response and correct as well
  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/audits`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
  })


  it('Get all projects meta', async () => {
    await createTable(context, project, { table_name: 'table1', title: 'table1' })
    await createTable(context, project, { table_name: 'table2', title: 'table2' })
    await createTable(context, project, { table_name: 'table3', title: 'table3' })

    await request(context.app)
      .get(`/api/v1/aggregated-meta-info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
      .then(res => {
        expect(res.body).to.have.all.keys(
          'userCount',
          'sharedBaseCount',
          'projectCount',
          'projects',
        )
        expect(res.body).to.have.property('projectCount').to.eq(1)
        expect(res.body).to.have.property('projects').to.be.an('array')
        expect(res.body.projects[0].tableCount.table).to.be.eq(3)
        expect(res.body).to.have.nested.property('projects[0].tableCount.table').to.be.a('number')
        expect(res.body).to.have.nested.property('projects[0].tableCount.view').to.be.a('number')
        expect(res.body).to.have.nested.property('projects[0].viewCount').to.be.an('object')
          .have.keys(
          'formCount',
          'gridCount',
          'galleryCount',
          'kanbanCount',
          'total',
          'sharedFormCount',
          'sharedGridCount',
          'sharedGalleryCount',
          'sharedKanbanCount',
          'sharedTotal',
          'sharedLockedCount')
        expect(res.body.projects[0]).have.keys(
          'external',
          'webhookCount',
          'filterCount',
          'sortCount',
          'userCount',
          'rowCount',
          'tableCount',
          'viewCount',
        )
        expect(res.body).to.have.nested.property('projects[0].rowCount').to.be.an('array')
        expect(res.body).to.have.nested.property('projects[0].external').to.be.an('boolean')
      })
  })
}

export default function() {
  describe('Project', projectTest)
}
