import 'mocha';
import request from 'supertest';
import init from '../../init';
import { createTable, getAllTables } from '../../factory/table';
import { createLtarColumn } from '../../factory/column';
import { createProject } from '../../factory/project';
import { defaultColumns } from '../../factory/column';
import Model from '../../../../src/lib/models/Model';
import { expect } from 'chai';

function tableTest() {
  let context;
  let project;
  let table;

  beforeEach(async function () {
    context = await init();

    project = await createProject(context);
    table = await createTable(context, project);
  });

  it('Get table list', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);

    expect(response.body).to.containSubset({
      list: [
        {
          title: "Table1_Title",
          type: "table",
          meta: null,
          schema: null,
          enabled: 1,
          mm: 0,
          tags: null,
          pinned: null,
          deleted: null,
          order: 1,
        },
      ],
    });
    expect(response.body.list).to.be.an('array').not.empty;
  });

  it('Create table', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'table2',
        title: 'new_title_2',
        columns: defaultColumns(context),
      })
      .expect(200);

    expect(response.body).to.containSubset(require('../fixtures/createTable.json'))

    const tables = await getAllTables({ project });
    if (tables.length !== 2) {
      return new Error('Tables is not be created');
    }

    if (response.body.columns.length !== defaultColumns(context)) {
      return new Error('Columns not saved properly');
    }

    if (
      !(
        response.body.table_name.startsWith(project.prefix) &&
        response.body.table_name.endsWith('table2')
      )
    ) {
      return new Error('table name not configured properly');
    }
  });

  it('Create table with no table name', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: undefined,
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(400);

    if (
      !response.text.includes(
        'Missing table name `table_name` property in request body'
      )
    ) {
      console.error(response.text);
      return new Error('Wrong api response');
    }

    const tables = await getAllTables({ project });
    if (tables.length !== 1) {
      console.log(tables);
      return new Error(
        `Tables should not be created, tables.length:${tables.length}`
      );
    }
  });

  it('Create table with same table name', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: table.table_name,
        title: 'New_title',
        columns: defaultColumns(context),
      })
      .expect(400);

    if (!response.text.includes('Duplicate table name')) {
      console.error(response.text);
      return new Error('Wrong api response');
    }

    const tables = await getAllTables({ project });
    if (tables.length !== 1) {
      return new Error('Tables should not be created');
    }
  });

  it('Create table with same title', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'New_table_name',
        title: table.title,
        columns: defaultColumns(context),
      })
      .expect(400);

    if (!response.text.includes('Duplicate table alias')) {
      console.error(response.text);
      return new Error('Wrong api response');
    }

    const tables = await getAllTables({ project });
    if (tables.length !== 1) {
      return new Error('Tables should not be created');
    }
  });

  it('Create table with title length more than the limit', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'a'.repeat(256),
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(400);

    if (!response.text.includes('Table name exceeds ')) {
      console.error(response.text);
      return new Error('Wrong api response');
    }

    const tables = await getAllTables({ project });
    if (tables.length !== 1) {
      return new Error('Tables should not be created');
    }
  });

  it('Create table with title having leading white space', async function () {
    const response = await request(context.app)
      .post(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({
        table_name: 'table_name_with_whitespace ',
        title: 'new_title',
        columns: defaultColumns(context),
      })
      .expect(400);

    if (
      !response.text.includes(
        'Leading or trailing whitespace not allowed in table names'
      )
    ) {
      console.error(response.text);
      return new Error('Wrong api response');
    }

    const tables = await getAllTables({ project });
    if (tables.length !== 1) {
      return new Error('Tables should not be created');
    }
  });

  it('Update table', async function () {
    const response = await request(context.app)
      .patch(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({
        project_id: project.id,
        table_name: 'new_title',
      })
      .expect(200);
    const updatedTable = await Model.get(table.id);

    expect(response.body).to.deep.equal({
      msg: "success",
    })
    if (!updatedTable.table_name.endsWith('new_title')) {
      return new Error('Table was not updated');
    }
  });

  it('Errors when Update table with invalid table name', async function () {
    const response = await request(context.app)
      .patch(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({
        project_id: project.id,
        table_name: 'a'.repeat(256),
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Table name exceeds 255 characters",
    })
  });

  it('Errors when Update table with no table name', async function () {
    const response = await request(context.app)
      .patch(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({
        project_id: project.id
      })
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Missing table name `table_name` property in request body",
    })
  });

  it('Delete table', async function () {
    const response = await request(context.app)
      .delete(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);

    expect(response.body).to.equal(true);
    const tables = await getAllTables({ project });

    if (tables.length !== 0) {
      return new Error('Table is not deleted');
    }
  });


  it('Errors when Delete table with ltar column', async function () {
    const childTable = await createTable(context, project, { table_name: 'child_table', title: 'ChildTable' });
    await createLtarColumn(context, { 
      title: 'LTAR_column',
      parentTable: table,
      childTable: childTable,
      type: 'hm',
     })
    const response = await request(context.app)
      .delete(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Table can't be deleted since Table is being referred in following tables : [object Object]. Delete LinkToAnotherRecord columns and try again.",
    });
    const tables = await getAllTables({ project });

    if (tables.length !== 0) {
      return new Error('Table is not deleted');
    }
  });

  // todo: Check the condtion where the table being deleted is being refered by multiple tables
  // todo: Check the if views are also deleted

  it('Get table', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/tables/${table.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);

    expect(response.body).to.containSubset(require('../fixtures/getTable.json'));
    if (response.body.id !== table.id) new Error('Wrong table');
  });

  it('Errors when Get table with incorrect table id', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/tables/INCORRECT_${table.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(400);

    expect(response.body).to.deep.equal({
      msg: "Cannot read properties of undefined (reading 'id')",
    })
    if (response.body.id !== table.id) new Error('Wrong table');
  });

  // todo: flaky test, order condition is sometimes not met
  it('Reorder table', async function () {
    const newOrder = table.order === 0 ? 1 : 0;
    const response = await request(context.app)
      .post(`/api/v1/db/meta/tables/${table.id}/reorder`)
      .set('xc-auth', context.token)
      .send({
        order: newOrder,
      })
      .expect(200);

    expect(response.body).to.deep.equal({});
    // .expect(200, async (err) => {
    //   if (err) return new Error(err);

    //   const updatedTable = await Model.get(table.id);
    //   console.log(Number(updatedTable.order), newOrder);
    //   if (Number(updatedTable.order) !== newOrder) {
    //     return new Error('Reordering failed');
    //   }

    //   new Error();
    // });
  });
}

export default async function () {
  describe('Table', tableTest);
}
