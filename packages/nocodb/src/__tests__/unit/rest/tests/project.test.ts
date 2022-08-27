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
    const response = await createUser(app);
    token = response.token;
    project = await createProject(app, token);
  });

  it('List projects', function (done) {
    request(app)
      .get('/api/v1/db/meta/projects/')
      .set('xc-auth', token)
      .send({})
      .expect(200, (err, res) => {
        if (err) done(err);
        else if (res.body.list.length !== 1) done('Should list only 1 project');
        else {
          done();
        }
      });
  });

  it('Update projects', function (done) {
    request(app)
      .patch(`/api/v1/db/meta/projects/${project.id}`)
      .set('xc-auth', token)
      .send({
        title: 'NewTitle',
      })
      .expect(200, async (err) => {
        if (err) {
          done(err);
          return;
        }
        const newProject = await Project.getByTitleOrId(project.id);
        console.log(newProject);
        if (newProject.title !== 'NewTitle') {
          done('Project not updated');
          return;
        }

        done();
      });
  });
}

export default function () {
  describe('Project', projectTest);
}
