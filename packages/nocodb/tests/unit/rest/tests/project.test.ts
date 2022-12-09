import 'mocha'
import request from 'supertest'
import { createTable } from '../../factory/table'
import init from '../../init/index'
import { createProject, createSharedBase } from '../../factory/project'
import { beforeEach } from 'mocha'
import { Exception } from 'handlebars'
import Project from '../../../../src/lib/models/Project'
import { packageVersion } from '../../../../src/lib/utils/packageVersion';
import chai from 'chai';
chai.use(require('chai-subset'));
import { expect } from 'chai'

function projectTest() {
  let context
  let project

  beforeEach(async function() {
    context = await init()

    project = await createProject(context)
  })

  it('Get project info', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
    expect(response.body).to.deep.equal({
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: false,
      Database: 'sqlite3',
      ProjectOnRootDB: true,
      RootDB: 'sqlite3',
      PackageVersion: packageVersion,
    })
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
    expect(response.body).to.deep.include({
      list: [
        {
          is_meta: 1,
          title: "Title",
          status: null,
          description: null,
          id: project.id,
          created_at: project.created_at,
          updated_at: project.updated_at,
          prefix: project.prefix,
          meta: null,
          color: null,
          uuid: null,
          password: null,
          deleted: 0,
          order: null,
        },
      ],
      pageInfo: {
        totalRows: 1,
        page: 1,
        pageSize: 1,
        isFirstPage: true,
        isLastPage: true,
      },
    })
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
    expect(response.body).to.containSubset({
      is_meta: 1,
      title: "Title1",
      status: null,
      description: null,
      meta: null,
      color: null,
      uuid: null,
      password: null,
      roles: null,
      deleted: 0,
      order: null,
      bases: [
        {
          alias: null,
          meta: null,
          is_meta: 1,
          type: "sqlite3",
          inflection_column: "camelize",
          inflection_table: "camelize",
        },
      ],
    })
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

  it('Errors when Create projects with too long title', async () => {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({
        title: Array(51).fill('a'),
      })
      .expect(400)
    expect(response.body).to.deep.equal({
      msg: "Project title exceeds 50 characters",
    })
  })

  it('when NC_CONNECT_TO_EXTERNAL_DB_DISABLED is set to true, creating external DB project returns 400',async () => {
    process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED = "true";
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({ 
        "title": "noco_release_test", 
        "bases": [
          { 
            "type": "pg", 
            "config": { 
              "client": "pg", 
              "connection": { 
                "host": "localhost", 
                "port": "5432", 
                "user": "db_user", 
                "password": "pass", 
                "database": "test_db" 
              }, 
              "searchPath": ["public"] 
            }, 
            "inflection_column": "none", 
            "inflection_table": "none" 
          }
        ], "external": true })
      .expect(400)
    expect(response.body).to.deep.equal({
      msg: "This type of project is not supported.",
    })
    delete process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED;
  })

  it('when NC_PROJECT_WITHOUT_EXTERNAL_DB_DISABLED is set to true, creating external DB project returns 400',async () => {
    process.env.NC_PROJECT_WITHOUT_EXTERNAL_DB_DISABLED = "true";
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({ 
        "title": "noco_release_test"
      })
      .expect(400)
    expect(response.body).to.deep.equal({
      msg: "This type of project is not supported.",
    })
    delete process.env.NC_PROJECT_WITHOUT_EXTERNAL_DB_DISABLED;
  })

  // todo: fix passport user role population bug
  it('Delete project', async () => {
    const toBeDeletedProject = await createProject(context, {
      title: 'deletedTitle',
    });
    const response = await request(context.app)
      .delete(`/api/v1/db/meta/projects/${toBeDeletedProject.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'deletedTitle',
      })
      .expect(200);

    expect(response.body).to.be.equal(1);

    const deletedProject = await Project.getByTitleOrId(
      toBeDeletedProject.id
    );
    if (deletedProject) return new Error('Project not delete');
  });

  it('Read project', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    if (response.body.id !== project.id) return new Error('Got the wrong project')
    expect(response.body).to.containSubset({
      is_meta: 1,
      id: project.id,
      title: project.title,
      prefix: project.prefix,
      status: null,
      description: null,
      meta: null,
      color: null,
      uuid: null,
      password: null,
      roles: null,
      deleted: 0,
      order: null,
      created_at: project.created_at,
      updated_at: project.updated_at,
      bases: [
        {
          project_id: project.id,
          alias: null,
          meta: null,
          is_meta: 1,
          type: "sqlite3",
          inflection_column: "camelize",
          inflection_table: "camelize",
        },
      ],
    });
  })

  it('Errors on reading non existing project', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/INCORRECT_PROJECT_ID`)
      .set('xc-auth', context.token)
      .send()
      .expect(400)
  })

  it('Update projects', async () => {
    const updateData = {"title": 'NewTitle',"color":"#EC2CBD","meta":"{\"theme\":{\"primaryColor\":\"#EC2CBD\",\"accentColor\":\"#2cec5bff\"}}"}
    const response = await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send(updateData)
      .expect(200)

    expect(response.body).to.be.equal(1)
    const newProject = await Project.getByTitleOrId(project.id)
    expect(newProject).to.containSubset(updateData)
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
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'viewer',
        password: 'test',
      })
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    expect(response.body).to.containSubset({
      uuid: updatedProject.uuid,
      roles: "viewer"
    });

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

    const response = await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'test',
      })
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    expect(response.body).to.containSubset({
      uuid: updatedProject.uuid,
      roles: "viewer"
    });

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

    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)

    const updatedProject = await Project.getByTitleOrId(project.id)

    expect(response.body).to.containSubset({
      uuid: updatedProject.uuid,
      roles: "viewer"
    });
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
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
    expect(response.body).to.deep.equal({
      msg: "success",
    })
  })

  // todo: improve test. Check whether the all the actions are present in the response and correct as well
  it('Meta diff sync', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/audits`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
    expect(response.body).to.deep.equal({
      list: [
      ],
      pageInfo: {
        totalRows: 0,
        page: 1,
        pageSize: 25,
        isFirstPage: true,
        isLastPage: true,
      },
    })
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

  it('Gets Project Cost', async () => {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/cost`)
      .set('xc-auth', context.token)
      .send()
      .expect(200)
    expect(response.body).to.deep.equal({
      cost: 0,
    })
  })
}

export default function() {
  describe('Project', projectTest)
}
