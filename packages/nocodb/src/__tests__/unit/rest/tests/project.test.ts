import 'mocha';
import request from 'supertest';
import Project from '../../../../lib/models/Project';
import { createProject, createSharedBase } from './factory/project';
import { beforeEach } from 'mocha';
import { Exception } from 'handlebars';
import init from '../init/index';

function projectTest() {
  let context;
  let project;

  beforeEach(async function () {
    context = await init();

    project = await createProject(context);
  });

  it('Get project info', function (done) {
    request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/info`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200, done);
  });

  // todo: Test by creating models under project and check if the UCL is working
  it('UI ACL', (done) => {
    request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/visibility-rules`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200, done);
  });
  // todo: Test creating visibility set

  it('List projects', function (done) {
    request(context.app)
      .get('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({})
      .expect(200, (err, res) => {
        if (err) done(err);
        else if (res.body.list.length !== 1) done('Should list only 1 project');
        else if (!res.body.pageInfo) done('Should have pagination info');
        else {
          done();
        }
      });
  });

  it('Create project', function (done) {
    request(context.app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({
        title: 'Title1',
      })
      .expect(200, async (err, res) => {
        if (err) return done(err);

        const newProject = await Project.getByTitleOrId(res.body.id);
        if (!newProject) return done('Project not created');

        done();
      });
  });

  it('Create projects with existing title', function (done) {
    request(context.app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', context.token)
      .send({
        title: project.title,
      })
      .expect(400, done);
  });

  // todo: fix passport user role popluation bug
  // it('Delete project', async (done) => {
  //   const toBeDeletedProject = await createProject(app, token, {
  //     title: 'deletedTitle',
  //   });
  //   request(app)
  //     .delete('/api/v1/db/meta/projects/${toBeDeletedProject.id}')
  //     .set('xc-auth', token)
  //     .send({
  //       title: 'Title1',
  //     })
  //     .expect(200, async (err) => {
  //       // console.log(res);
  //       if (err) return done(err);

  //       const deletedProject = await Project.getByTitleOrId(
  //         toBeDeletedProject.id
  //       );
  //       if (deletedProject) return done('Project not delete');

  //       done();
  //     });
  // });

  it('Read project', (done) => {
    request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send()
      .expect(200, (err, res) => {
        if (err) return done(err);

        if (res.body.id !== project.id) return done('Got the wrong project');

        done();
      });
  });

  it('Update projects', function (done) {
    request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send({
        title: 'NewTitle',
      })
      .expect(200, async (err) => {
        if (err) {
          done(err);
          return;
        }
        const newProject = await Project.getByTitleOrId(project.id);
        if (newProject.title !== 'NewTitle') {
          done('Project not updated');
          return;
        }

        done();
      });
  });

  it('Update projects with existing title', async function () {
    const newProject = await createProject(context, {
      title: 'NewTitle1',
    });
    return await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', context.token)
      .send({
        title: newProject.title,
      })
      .expect(400);
  });

  it('Create project shared base', (done) => {
    request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'viewer',
        password: 'test',
      })
      .expect(200, async (err) => {
        if (err) return done(err);

        const updatedProject = await Project.getByTitleOrId(project.id);

        if (
          !updatedProject.uuid ||
          updatedProject.roles !== 'viewer' ||
          updatedProject.password !== 'test'
        ) {
          return done('Shared base not configured properly');
        }

        done();
      });
  });

  it('Created project shared base should have only editor or viewer role', (done) => {
    request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'test',
      })
      .expect(200, async (err) => {
        if (err) return done(err);

        const updatedProject = await Project.getByTitleOrId(project.id);

        if (updatedProject.roles === 'commenter') {
          return done('Shared base not configured properly');
        }

        done();
      });
  });

  it('Updated project shared base should have only editor or viewer role', async () => {
    await createSharedBase(context.app, context.token, project);

    await request(context.app)
      .patch(`/api/v1/db/meta/projects/${project.id}/shared`)
      .set('xc-auth', context.token)
      .send({
        roles: 'commenter',
        password: 'test',
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
        password: 'test',
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

  it('Meta diff sync', (done) => {
    request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200, done);
  });

  it('Meta diff sync', (done) => {
    request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/meta-diff`)
      .set('xc-auth', context.token)
      .send()
      .expect(200, done);
  });

  // todo: improve test. Check whether the all the actions are present in the response and correct as well
  it('Meta diff sync', (done) => {
    request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/audits`)
      .set('xc-auth', context.token)
      .send()
      .expect(200, done);
  });
}

export default function () {
  describe('Project', projectTest);
}
