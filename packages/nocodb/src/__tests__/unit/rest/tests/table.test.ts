// import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import server from '../server';
import { createUser } from './helpers/user';
import { createTable } from './helpers/table';
import { createProject } from './helpers/project';
import Model from '../../../../lib/models/Model';
import { defaultColumns } from './helpers/column';

function tableTest() {
  let app;
  let token;
  let project;
  let table;

  beforeEach(async function () {
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

  it('Create table', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: 'table2',
        title: 'new_title_2',
        columns: defaultColumns,
      })
      .expect(200, async (err, res) => {
        if (err) return done(err);

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 2) {
          return done('Tables is not be created');
        }

        if (res.body.columns.length !== defaultColumns.length) {
          done('Columns not saved properly');
        }

        if (
          !(
            res.body.table_name.startsWith(project.prefix) &&
            res.body.table_name.endsWith('table2')
          )
        ) {
          done('table name not configured properly');
        }
        done();
      });
  });

  it('Create table with no table name', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: undefined,
        title: 'new_title',
        columns: defaultColumns,
      })
      .expect(400, async (err, res) => {
        if (err) return done(err);

        if (
          !res.text.includes(
            'Missing table name `table_name` property in request body'
          )
        ) {
          console.error(res.text);
          return done('Wrong api response');
        }

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 1) {
          console.log(tables);
          return done(
            `Tables should not be created, tables.length:${tables.length}`
          );
        }

        done();
      });
  });

  it('Create table with same table name', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: table.table_name,
        title: 'New_title',
        columns: defaultColumns,
      })
      .expect(400, async (err, res) => {
        if (err) return done(err);

        if (!res.text.includes('Duplicate table name')) {
          console.error(res.text);
          return done('Wrong api response');
        }

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 1) {
          return done('Tables should not be created');
        }

        done();
      });
  });

  it('Create table with same title', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: 'New_table_name',
        title: table.title,
        columns: defaultColumns,
      })
      .expect(400, async (err, res) => {
        if (err) return done(err);

        if (!res.text.includes('Duplicate table alias')) {
          console.error(res.text);
          return done('Wrong api response');
        }

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 1) {
          return done('Tables should not be created');
        }

        done();
      });
  });

  it('Create table with title length more than the limit', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: 'a'.repeat(256),
        title: 'new_title',
        columns: defaultColumns,
      })
      .expect(400, async (err, res) => {
        if (err) return done(err);

        if (!res.text.includes('Table name exceeds ')) {
          console.error(res.text);
          return done('Wrong api response');
        }

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 1) {
          return done('Tables should not be created');
        }

        done();
      });
  });

  it('Create table with title having leading white space', function (done) {
    request(app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', token)
      .send({
        table_name: 'table_name_with_whitespace ',
        title: 'new_title',
        columns: defaultColumns,
      })
      .expect(400, async (err, res) => {
        if (err) return done(err);

        if (
          !res.text.includes(
            'Leading or trailing whitespace not allowed in table names'
          )
        ) {
          console.error(res.text);
          return done('Wrong api response');
        }

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });
        if (tables.length !== 1) {
          return done('Tables should not be created');
        }

        done();
      });
  });

  it('Update table', function (done) {
    request(app)
      .patch(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', token)
      .send({
        project_id: project.id,
        table_name: 'new_title',
      })
      .expect(200, async (err) => {
        if (err) return done(err);

        const updatedTable = await Model.get(table.id);

        if (!updatedTable.table_name.endsWith('new_title')) {
          return done('Table was not updated');
        }

        done();
      });
  });

  it('Delete table', function (done) {
    request(app)
      .delete(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', token)
      .send({})
      .expect(200, async (err) => {
        if (err) return done(err);

        const tables = await Model.list({
          project_id: project.id,
          base_id: project.bases[0].id,
        });

        if (tables.length !== 0) {
          return done('Table is not deleted');
        }

        done();
      });
  });

  // todo: Check the condtion where the table being deleted is being refered by multiple tables
  // todo: Check the if views are also deleted

  it('Get table', function (done) {
    request(app)
      .get(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', token)
      .send({})
      .expect(200, async (err, res) => {
        if (err) return done(err);

        if (res.body.id !== table.id) done('Wrong table');

        done();
      });
  });

  // todo: flaky test, order condition is sometimes not met
  it('Reorder table', function (done) {
    const newOrder = table.order === 0 ? 1 : 0;
    request(app)
      .post(`/api/v1/db/meta/tables/${table.id}/reorder`)
      .set('xc-auth', token)
      .send({
        order: newOrder,
      })
      .expect(200, done);
    // .expect(200, async (err) => {
    //   if (err) return done(err);

    //   const updatedTable = await Model.get(table.id);
    //   console.log(Number(updatedTable.order), newOrder);
    //   if (Number(updatedTable.order) !== newOrder) {
    //     return done('Reordering failed');
    //   }

    //   done();
    // });
  });
}

export default function () {
  describe('Table', tableTest);
}
