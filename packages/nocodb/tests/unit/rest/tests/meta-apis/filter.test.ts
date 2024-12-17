import 'mocha';

import { expect } from 'chai';
import request from 'supertest';

import { Base, Model } from '../../../../../src/models';
import { createProject } from '../../../factory/base';
import { createTable, getTableMeta } from '../../../factory/table';
import init from '../../../init';

export default async function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const isEE = !!process.env.EE;

  const META_API_VIEW_ROUTE = `/api/${API_VERSION}${
    isV1 ? '/db' : ''
  }/meta/views`;

  function filterTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;
    let defaultViewId: string;

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);

      const meta = await getTableMeta(context, table);
      defaultViewId = meta.views[0].id;
    });

    it(`Filter Meta CRUD ${API_VERSION}`, async () => {
      let response = await request(context.app)
        .get(`${META_API_VIEW_ROUTE}/${defaultViewId}/filters`)
        .set('xc-auth', context.token)
        .expect(200);
      const filtersResponse = response.body.list;
      expect(filtersResponse).to.be.not.be.undefined;
      expect(filtersResponse.length).to.eq(0);

      // response = await request(context.app).post()
    });
  }

  describe(`Filter Meta Tests ${API_VERSION}`, filterTests);
}
