// import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import server from '../server';
import { createUser } from './helpers/user';
import { createTable } from './helpers/table';
import { createProject } from './helpers/project';
import Model from '../../../../lib/models/Model';

function tableTest() {
  let app;
  let token;
  let project;
  let table;

  before(async function () {
    app = await server();
    const response = await createUser(app, { roles: 'editor' });
    token = response.token;

    project = await createProject(app, token);
    table = await createTable(app, token, project);
  });

  it('Get table list', function (done) {
    request(app)
      .get(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({})
      .expect(200, (err, res) => {
        if (err) return done(err);

        if (res.body.list.length !== 1) return done('Wrong number of tables');

        done();
      });
  });

  it('Update table', function (done) {
    request(app)
      .patch(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', token)
      .send({
        project_id: project.id,
        table_name: 'new title',
      })
      .expect(200, async (err) => {
        if (err) return done(err);

        const updatedTable = await Model.get(table.id);

        if (!updatedTable.table_name.endsWith('new title')) {
          return done('Table was not updated');
        }

        done();
      });
  });
}

export default function () {
  describe('Table', tableTest);
}
