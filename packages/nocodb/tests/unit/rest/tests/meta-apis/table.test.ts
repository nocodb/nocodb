import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { ViewTypes } from 'nocodb-sdk';
import { createView, deleteView } from '../../../../unit/factory/view';
import init from '../../../init';
import { createProject } from '../../../factory/base';
import { createTable, getAllTables, updateTable } from '../../../factory/table';
import { defaultColumns } from '../../../factory/column';
import { Model } from '../../../../../src/models';
import type { Base } from '../../../../../src/models';

export default function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const isEE = !!process.env.EE;

  const META_API_BASE_ROUTE = `/api/${API_VERSION}${isV1 ? '/db' : ''}/meta/${
    isV1 ? 'projects' : 'bases'
  }`;

  const META_API_TABLE_ROUTE = `/api/${API_VERSION}${
    isV1 ? '/db' : ''
  }/meta/tables`;

  function tableTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;

    beforeEach(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);
    });

    it(`Get table list ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list).to.be.an('array').not.empty;
      expect(response.body.list.length).to.eq(1);

      const responseTable = response.body.list[0];
      matchTable(responseTable, table, false);
    });

    it(`Create table with no table title ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          title: undefined,
          columns: defaultColumns(context, isV3),
        })
        .expect(400);

      expect(response.text).to.include(`must have required property 'title'`);

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(1);
    });

    it(`Create table with same table name ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: table.table_name,
          title: 'New_title',
          columns: defaultColumns(context, isV3),
        })
        .expect(400);

      expect(response.text).to.includes('Duplicate table name');

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(1);
    });

    it(`Create table with same title ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'New_table_name',
          title: table.title,
          columns: defaultColumns(context, isV3),
        })
        .expect(400);

      expect(response.text).to.includes('Duplicate table alias');

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(1);
    });

    it(`Create table with title length more than the limit ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'a'.repeat(256),
          title: 'new_title',
          columns: defaultColumns(context, isV3),
        })
        .expect(400);

      expect(response.text).to.includes('must NOT have more than ');

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(1);
    });

    it(`Create table with title having leading white space ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'table_name_with_whitespace ',
          title: 'new_title',
          columns: defaultColumns(context, isV3),
        })
        .expect(400);

      expect(response.text).to.includes(
        'Leading or trailing whitespace not allowed in table names',
      );
    });

    it(`Create table ${API_VERSION}`, async function () {
      const columnProps = isV3
        ? {
            fields: defaultColumns(context, isV3),
          }
        : {
            columns: defaultColumns(context, isV3),
          };

      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'table2',
          title: 'table2',
          ...columnProps,
        })
        .expect(200);

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(2);

      if (isV3) {
        expect(response.body.fields.length).to.eq(
          defaultColumns(context, isV3).length,
        );
      } else {
        expect(response.body.columns.length).to.eq(
          defaultColumns(context, isV3).length + 5, // nc_order, createdby, updatedby, created_at, updated_at
        );
      }

      if (isV3) {
        expect(response.body.title).to.eq('table2');
      } else {
        expect(response.body.table_name.startsWith(base.prefix)).to.eq(true);
        expect(response.body.table_name.endsWith('table2')).to.eq(true);
      }
    });

    it(`Update table ${API_VERSION}`, async function () {
      const ctx = {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      };

      await request(context.app)
        .patch(`${META_API_TABLE_ROUTE}/${table.id}`)
        .set('xc-auth', context.token)
        .send({
          base_id: base.id,
          table_name: 'new_title',
        })
        .expect(200);

      const updatedTable = await Model.get(ctx, table.id);
      expect(updatedTable.table_name.endsWith('new_title')).to.eq(true);
    });

    // todo: Check the condtion where the table being deleted is being refered by multiple tables
    // todo: Check the if views are also deleted

    it(`Get table ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .get(`${META_API_TABLE_ROUTE}/${table.id}`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      matchTable(response.body, table, true);
    });

    // todo: flaky test, order condition is sometimes not met
    it(`Reorder table ${API_VERSION}`, async function () {
      const newOrder = table.order === 0 ? 1 : 0;
      await request(context.app)
        .post(`${META_API_TABLE_ROUTE}/${table.id}/reorder`)
        .set('xc-auth', context.token)
        .send({
          order: newOrder,
        })
        .expect(200);
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

    it(`Add and delete view should update hasNonDefault Views ${API_VERSION}`, async () => {
      let response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.false;

      const view = await createView(context, {
        table,
        title: 'view1',
        type: ViewTypes.GRID,
      });

      response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.true;

      await deleteView(context, { viewId: view.id! });

      response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.false;
    });

    it(`Project with empty meta should update hasNonDefault Views ${API_VERSION}`, async () => {
      let response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.false;

      const view = await createView(context, {
        table,
        title: 'view1',
        type: ViewTypes.GRID,
      });

      await updateTable(context, {
        table,
        args: {
          meta: {},
        },
      });

      response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.true;

      await deleteView(context, { viewId: view.id! });

      response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list[0].meta.hasNonDefaultViews).to.be.false;
    });

    it(`Delete table ${API_VERSION}`, async function () {
      let tables = await getAllTables({ base });
      const initialLength = tables.length;
      await request(context.app)
        .delete(`${META_API_TABLE_ROUTE}/${table.id}`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);
      tables = await getAllTables({ base });
      expect(tables.length).to.eq(initialLength - 1);
    });
  }

  /**
   * @param deep -> Used to check when single table is being compared (not the list api)
   */
  function matchTable(responseTable: any, table: Model, deep: boolean) {
    expect(responseTable).to.haveOwnProperty('id');
    expect(responseTable.id).to.eq(table.id);

    // for meta source table source_id is not present
    if (isV1 || isV2) {
      expect(responseTable).to.haveOwnProperty('source_id');
      expect(responseTable.source_id).to.eq(table.source_id);
    }

    expect(responseTable).to.haveOwnProperty('title');
    expect(responseTable.title).to.eq(table.title);

    // check only if description is not null, since in v3 it excludes null values
    if (table.description) {
      expect(responseTable).to.haveOwnProperty('description');
      expect(responseTable.description ?? null).to.eq(table.description);
    }

    expect(responseTable).to.haveOwnProperty('base_id');
    expect(responseTable.base_id).to.eq(table.base_id);

    if (deep) {
      if (isV3) {
        expect(responseTable).to.haveOwnProperty('display_field_id');
      }
    }

    if (isV1 || isV2) {
      expect(responseTable).to.haveOwnProperty('table_name');
      expect(responseTable.table_name).to.eq(table.table_name);

      expect(responseTable).to.haveOwnProperty('type');
      expect(responseTable.type).to.eq(table.type);

      expect(responseTable).to.haveOwnProperty('meta');
      expect(responseTable.meta).to.deep.eq(table.meta);

      expect(responseTable).to.haveOwnProperty('schema');
      expect(responseTable.schema).to.eq(table.schema);

      expect(responseTable).to.haveOwnProperty('enabled');
      expect(responseTable.enabled).to.eq(table.enabled);

      expect(responseTable).to.haveOwnProperty('mm');
      expect(responseTable.mm).to.eq(table.mm);

      expect(responseTable).to.haveOwnProperty('tags');
      expect(responseTable.tags).to.eq(table.tags);

      expect(responseTable).to.haveOwnProperty('pinned');
      // @ts-expect-error type not on Model, but present
      expect(responseTable.pinned).to.eq(table.pinned);

      expect(responseTable).to.haveOwnProperty('deleted');
      expect(responseTable.deleted).to.eq(table.deleted);

      expect(responseTable).to.haveOwnProperty('order');
      expect(responseTable.order).to.eq(table.order);

      expect(responseTable).to.haveOwnProperty('created_at');
      // @ts-expect-error type not on Model, but present
      expect(responseTable.created_at).to.eq(table.created_at);

      expect(responseTable).to.haveOwnProperty('updated_at');
      // @ts-expect-error type not on Model, but present
      expect(responseTable.updated_at).to.eq(table.updated_at);

      if (isEE) {
        expect(responseTable).to.haveOwnProperty('fk_workspace_id');
        expect(responseTable.fk_workspace_id).to.eq(table.fk_workspace_id);
      }
    } else if (isV3) {
      if (isEE) {
        expect(responseTable).to.haveOwnProperty('workspace_id');
        expect(responseTable.workspace_id).to.eq(table.fk_workspace_id);
      }
    }
  }
  describe(`Table ${API_VERSION}`, tableTests);
}
