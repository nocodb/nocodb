import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import init from '../../../init';
import { createProject } from '../../../factory/base';
import { createTable, getAllTables, updateTable } from '../../../factory/table';
import { defaultColumns } from '../../../factory/column';
import { Base, Model } from '../../../../../src/models';

export default async function (API_VERSION: 'v1' | 'v2' | 'v3') {
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

  function fieldTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);
    });

    it.only(`Create basic columns ${API_VERSION}`, async function () {
      const response = await request(context.app)
        .post(`${META_API_BASE_ROUTE}/${base.id}/tables`)
        .set('xc-auth', context.token)
        .send({
          table_name: 'table2',
          title: 'new_title_2',
          columns: defaultColumns(context),
        })
        .expect(200);

      const tables = await getAllTables({ base });
      expect(tables.length).to.eq(2);

      let columns: any[] = [];
      if (isV1 || isV2) {
        columns = response.body.columns.filter((c) => !c.system);
      } else if (isV3) {
        columns = response.body.columns;
      }

      expect(columns.length).to.eq(defaultColumns(context).length);

      expect(response.body.table_name.startsWith(base.prefix)).to.eq(true);
      expect(response.body.table_name.endsWith('table2')).to.eq(true);

      columns.forEach(validateColumn);
    });
  }

  function validateColumn(responseColumn: any) {
    expect(responseColumn).to.haveOwnProperty('id');
    expect(responseColumn).to.haveOwnProperty('description');
    if (isV1 || isV2) {
      expect(responseColumn).to.haveOwnProperty('source_id');
      expect(responseColumn).to.haveOwnProperty('base_id');
      expect(responseColumn).to.haveOwnProperty('fk_model_id');
      expect(responseColumn).to.haveOwnProperty('title');
      expect(responseColumn).to.haveOwnProperty('column_name');
      expect(responseColumn).to.haveOwnProperty('uidt');
      expect(responseColumn).to.haveOwnProperty('dt');
      expect(responseColumn).to.haveOwnProperty('order');
      expect(responseColumn).to.haveOwnProperty('created_at');
      expect(responseColumn).to.haveOwnProperty('updated_at');
      expect(responseColumn).to.haveOwnProperty('dt');
      expect(responseColumn.meta).to.haveOwnProperty('defaultViewColOrder');
      if (isEE) {
        expect(responseColumn).to.haveOwnProperty('fk_workspace_id');
      }
    } else if (isV3) {
      expect(responseColumn).to.haveOwnProperty('name');
      expect(responseColumn).to.haveOwnProperty('type');
      expect(responseColumn).to.haveOwnProperty('default_value');
      if (isEE) {
        expect(responseColumn).to.haveOwnProperty('workspace_id');
      }
    }
  }

  describe(`Field ${API_VERSION}`, fieldTests);
}