import 'mocha';
import request from 'supertest';
import { beforeEach } from 'mocha';
import { Exception } from 'handlebars';
import { expect } from 'chai';
import { Project } from '../../../../src/models';
import { createTable } from '../../factory/table';
import init from '../../init';
import { createProject, createSharedBase } from '../../factory/project';

// Test case list
// 1. Get project info
// 2. UI ACL
// 3. Create project
// 4. Create project with existing title
// 5. Update project
// 6. Update project with existing title
// 7. Create project shared base
// 8. Created project shared base should have only editor or viewer role
// 9. Updated project shared base should have only editor or viewer role
// 10. Updated project shared base
// 11. Get project shared base
// 12. Delete project shared base
// 13. Meta diff sync
// 14. Meta diff sync
// 15. Meta diff sync
// 16. Get all projects meta

function projectTest() {
  let context;
  let project;

  beforeEach(async function () {
    console.time('#### projectTest');
    context = await init();
    project = await createProject(context);
    console.timeEnd('#### projectTest');
  });

  it('Get project info', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
  });

  // todo: Test by creating models under project and check if the UCL is working
  it('UI ACL', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/visibility-rules`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);
  });
  // todo: Test creating visibility set

  it('List projects', async () => {
    let response;
    if (process.env.EE !== 'true') {
      response = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-auth', context.token)
        .send({})
        .expect(200);
    } else {
      response = await request(context.app)
        .get(`/api/v1/workspaces/${context.fk_workspace_id}/projects`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);
    }

    if (response.body.list.length !== 1)
      new Error('Should list only 1 project');
    if (!response.body.pageInfo) new Error('Should have pagination info');
  });

  it('Create project', async () => {
    const response = await request(context.app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({
        title: 'Title1',
        ...(process.env.EE === 'true' && {
          fk_workspace_id: context.fk_workspace_id,
        }),
      })
      .expect(200);

    const newProject = await Project.getByTitleOrId(response.body.id);
    if (!newProject) return new Error('Project not created');
  });

  it('Create projects with existing title', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({
        title: project.title,
        ...(process.env.EE === 'true' && {
          fk_workspace_id: context.fk_workspace_id,
        }),
      })
      .expect(200);
  });

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
      .expect(200);

    if (response.body.id !== project.id)
      return new Error('Got the wrong project');
  });

  it('Update projects', async () => {
    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'NewTitle',
      })
      .expect(200);

    const newProject = await Project.getByTitleOrId(project.id);
    if (newProject.title !== 'NewTitle') {
      return new Error('Project not updated');
    }
  });

  it('Update projects with existing title', async function () {
    if (process.env.EE !== 'true') {
      const newProject = await createProject(context, {
        title: 'NewTitle1',
      });

      // Allow project rename to be replaced with same title
      await request(context.app)
        .patch(`/api/v1/db/meta/projects/${project.id}`)
        .set('xc-auth', context.token)
        .send({
          title: newProject.title,
        })
        .expect(400);
    }
  });

  it('Create project shared base', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'viewer',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Project.getByTitleOrId(project.id);

    if (
      !updatedProject.uuid ||
      updatedProject.roles !== 'viewer' ||
      updatedProject.password !== 'password123'
    ) {
      return new Error('Shared base not configured properly');
    }
  });

  it('Created project shared base should have only editor or viewer role', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Project.getByTitleOrId(project.id);

    if (updatedProject.roles === 'commenter') {
      return new Error('Shared base not configured properly');
    }
  });

  it('Updated project shared base should have only editor or viewer role', async () => {
    await createSharedBase(context.app, context.token, project);

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'password123',
      })
      .expect(200);

    const updatedProject = await Project.getByTitleOrId(project.id);

    if (updatedProject.roles === 'commenter') {
      throw new Exception('Shared base not updated properly');
    }
  });

  it('Updated project shared base', async () => {
    await createSharedBase(context.app, context.token, project);

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'editor',
        password: 'password123',
      })
      .expect(200);
    const updatedProject = await Project.getByTitleOrId(project.id);

    if (updatedProject.roles !== 'editor') {
      throw new Exception('Shared base not updated properly');
    }
  });

  it('Get project shared base', async () => {
    await createSharedBase(context.app, context.token, project);

    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);

    const updatedProject = await Project.getByTitleOrId(project.id);
    if (!updatedProject.uuid) {
      throw new Exception('Shared base not created');
    }
  });

  it('Delete project shared base', async () => {
    await createSharedBase(context.app, context.token, project);

    await request(context.app)
      .delete(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
    const updatedProject = await Project.getByTitleOrId(project.id);
    if (updatedProject.uuid) {
      throw new Exception('Shared base not deleted');
    }
  });

  // todo: Do compare api test

  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  it('Meta diff sync', async () => {
    await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  // todo: improve test. Check whether the all the actions are present in the response and correct as well
  it('Meta diff sync', async () => {
    await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/audits`)
      .set('xc-auth', context.token)
      .send()
      .expect(200);
  });

  it('Get all projects meta', async () => {
    await createTable(context, project, {
      table_name: 'table1',
      title: 'table1',
    });
    await createTable(context, project, {
      table_name: 'table2',
      title: 'table2',
    });
    await createTable(context, project, {
      table_name: 'table3',
      title: 'table3',
    });

    await request(context.app)
      .get(`/api/v1/aggregated-meta-info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200)
      .then((res) => {
        const createdProject =
          res.body.projects[process.env.EE === 'true' ? 2 : 1];

        expect(res.body).to.have.all.keys(
          'userCount',
          'sharedBaseCount',
          'projectCount',
          'projects',
        );
        // As there will be a default project created for a workspace (EE tests create one extra)
        expect(res.body)
          .to.have.property('projectCount')
          .to.eq(process.env.EE === 'true' ? 3 : 2);
        expect(res.body).to.have.property('projects').to.be.an('array');

        expect(createdProject.tableCount.table).to.be.eq(3);
        expect(res.body)
          .to.have.nested.property('projects[1].tableCount.table')
          .to.be.a('number');
        expect(res.body)
          .to.have.nested.property('projects[1].tableCount.view')
          .to.be.a('number');
        expect(res.body)
          .to.have.nested.property('projects[1].viewCount')
          .to.be.an('object')
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
            'sharedLockedCount',
          );
        expect(createdProject).have.keys(
          'external',
          'webhookCount',
          'filterCount',
          'sortCount',
          'userCount',
          'rowCount',
          'tableCount',
          'viewCount',
        );
        expect(res.body)
          .to.have.nested.property('projects[1].rowCount')
          .to.be.an('array');
        expect(res.body)
          .to.have.nested.property('projects[1].external')
          .to.be.an('boolean');
      });
  });
}

export default function () {
  describe('Project', projectTest);
}
