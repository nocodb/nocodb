import 'mocha';

import { expect } from 'chai';
import request from 'supertest';

import { Base, Column, Model } from '../../../../../src/models';
import { createProject } from '../../../factory/base';
import { createTable, getTableMeta } from '../../../factory/table';
import init from '../../../init';

export default function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const isEE = !!process.env.EE;

  const META_API_BASE_ROUTE = `/api/${API_VERSION}${isV1 ? '/db' : ''}/meta`;
  const META_API_VIEW_ROUTE = `${META_API_BASE_ROUTE}/views`;

  function filterTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;
    let defaultViewId: string;
    let defaultColumns: Column[];

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);

      const meta = (await getTableMeta(context, table)) as Model;
      defaultViewId = meta.views![0].id;
      defaultColumns = meta.columns!;
    });

    it(`Sort Meta CRUD ${API_VERSION}`, async () => {
      let response = await request(context.app)
        .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .expect(200);
      let sortsResponse = response.body.list;
      expect(sortsResponse).to.be.not.be.undefined;
      expect(sortsResponse.length).to.eq(0);

      const titleColumn = defaultColumns.find((c) => c.title === 'Title')!;

      expect(titleColumn).to.not.be.undefined;

      const DIRECTION_1 = 'asc';
      const DIRECTION_2 = 'desc';

      await request(context.app)
        .post(`${META_API_VIEW_ROUTE}/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .send({
          [isV3 ? 'field_id' : 'fk_column_id']: titleColumn.id,
          direction: DIRECTION_1,
        })
        .expect(isV3 ? 201 : 200);

      response = await request(context.app)
        .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .expect(200);
      sortsResponse = isV3 ? response.body : response.body.list;
      expect(sortsResponse).to.be.not.be.undefined;
      expect(sortsResponse.length).to.eq(1);

      let sortResponse = sortsResponse[0];
      expect(sortResponse).to.haveOwnProperty('id');

      if (isV1 || isV2) {
        expect(sortResponse).to.haveOwnProperty('fk_column_id');
        expect(sortResponse.fk_column_id).to.eq(titleColumn.id);

        // expect(sortResponse).to.haveOwnProperty("fk_model_id");
        // expect(sortResponse.fk_model_id).to.eq(table.id);

        expect(sortResponse).to.haveOwnProperty('source_id');

        expect(sortResponse).to.haveOwnProperty('direction');
        expect(sortResponse.direction).to.eq(DIRECTION_1);

        expect(sortResponse).to.haveOwnProperty('order');
        expect(sortResponse.order).to.eq(1);

        expect(sortResponse).to.haveOwnProperty('base_id');
        expect(sortResponse.base_id).to.eq(base.id);
      } else if (isV3) {
        expect(sortResponse).to.haveOwnProperty('field_id');
        expect(sortResponse.field_id).to.eq(titleColumn.id);

        expect(sortResponse).to.haveOwnProperty('direction');
        expect(sortResponse.direction).to.eq(DIRECTION_1);
      }

      await request(context.app)
        .patch(`${META_API_BASE_ROUTE}/sorts/${sortResponse.id}`)
        .set('xc-auth', context.token)
        .send({
          direction: DIRECTION_2,
        })
        .expect(200);

      response = await request(context.app)
        .get(`${META_API_BASE_ROUTE}/sorts/${sortResponse.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.not.be.undefined;
      expect(response.body.id).to.eq(sortResponse.id);
      sortResponse = response.body;

      if (isV1 || isV2) {
        expect(sortResponse).to.haveOwnProperty('fk_column_id');
        expect(sortResponse.fk_column_id).to.eq(titleColumn.id);

        expect(sortResponse).to.haveOwnProperty('direction');
        expect(sortResponse.direction).to.eq(DIRECTION_2);
      } else if (isV3) {
        expect(sortResponse).to.haveOwnProperty('field_id');
        expect(sortResponse.field_id).to.eq(titleColumn.id);

        expect(sortResponse).to.haveOwnProperty('direction');
        expect(sortResponse.direction).to.eq(DIRECTION_2);
      }

      await request(context.app)
        .delete(`${META_API_BASE_ROUTE}/sorts/${sortResponse.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      response = await request(context.app)
        .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .expect(200);
      sortsResponse = response.body.list;
      expect(sortsResponse).to.be.not.be.undefined;
      expect(sortsResponse.length).to.eq(0);
    });
  }

  describe(`Sort Meta Tests ${API_VERSION}`, filterTests);
}
