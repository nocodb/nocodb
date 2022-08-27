import 'mocha';
import request from 'supertest';
import server from '../server';
import Project from '../../../../lib/models/Project';
import { createProject } from './helpers/project';
import { createUser } from './helpers/user';

function projectTest() {
  let app;
  let token;
  let project;

  before(async function () {
    app = await server();
    const response = await createUser(app, { roles: 'editor' });
    token = response.token;
    project = await createProject(app, token);
  });

  it('Get project info', function (done) {
    request(app)
      .get(`/api/v1/db/meta/projects/${project.id}/info`)
      .set('xc-auth', token)
      .send({})
      .expect(200, done);
  });

  // todo: Test by creating models under project and check if the UCL is working
  it('UI ACL', (done) => {
    request(app)
      .get(`/api/v1/db/meta/projects/${project.id}/visibility-rules`)
      .set('xc-auth', token)
      .send({})
      .expect(200, (_, res) => {
        console.log('UI ACL Respinse:', res.body);
        done();
      });
  });
  // todo: Test creating visibility set

  it('List projects', function (done) {
    request(app)
      .get('/api/v1/db/meta/projects/')
      .set('xc-auth', token)
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
    request(app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', token)
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
    request(app)
      .post(`/api/v1/db/meta/projects/`)
      .set('xc-auth', token)
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
    request(app)
      .get(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', token)
      .send()
      .expect(200, (err, res) => {
        if (err) return done(err);

        if (res.body.id !== project.id) return done('Got the wrong project');

        done();
      });
  });

  // it('Update projects', function (done) {
  //   request(app)
  //     .patch(`/api/v1/db/meta/projects/${project.id}`)
  //     .set('xc-auth', token)
  //     .send({
  //       title: 'NewTitle',
  //     })
  //     .expect(200, async (err) => {
  //       if (err) {
  //         done(err);
  //         return;
  //       }
  //       const newProject = await Project.getByTitleOrId(project.id);
  //       if (newProject.title !== 'NewTitle') {
  //         done('Project not updated');
  //         return;
  //       }

  //       done();
  //     });
  // });

  it('Update projects with existing title', async function () {
    const newProject = await createProject(app, token, { title: 'NewTitle1' });
    return await request(app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', token)
      .send({
        title: newProject.title,
      })
      .expect(400);
  });
}

export default function () {
  describe('Project', projectTest);
}
