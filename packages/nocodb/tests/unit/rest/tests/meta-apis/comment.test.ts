import 'mocha';

import { expect } from 'chai';
import request from 'supertest';

import { Base, Model } from '../../../../../src/models';
import { createProject } from '../../../factory/base';
import { createTable } from '../../../factory/table';
import init from '../../../init';
import { createRow } from '../../../factory/row';

export default function (API_VERSION: 'v1' | 'v2' | 'v3') {
  const isV1 = API_VERSION === 'v1';
  const isV2 = API_VERSION === 'v2';
  const isV3 = API_VERSION === 'v3';

  const isEE = !!process.env.EE;

  const META_API_COMMENTS_ROUTE = `/api/${API_VERSION}${
    isV1 ? '/db' : ''
  }/meta/comments`;

  function commentsTests() {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let table: Model;
    let firstRowId: string;

    before(async function () {
      context = await init();

      base = await createProject(context);
      table = await createTable(context, base);

      const row = await createRow(context, { base, table });
      firstRowId = row.Id;
      expect(firstRowId).to.not.be.undefined;
    });

    it(`Comments Meta CRUD ${API_VERSION}`, async () => {
      let response = await request(context.app)
        .get(`${META_API_COMMENTS_ROUTE}`)
        .query({
          row_id: firstRowId,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .set('xc-auth', context.token)
        .expect(200);
      let commentsResponse = isV3 ? response.body : response.body.list;
      expect(commentsResponse).to.be.not.be.undefined;
      expect(commentsResponse.length).to.eq(0);

      const TEST_COMMENT_1 = 'Test Comment 1';
      const TEST_COMMENT_2 = 'Test Comment 2';

      await request(context.app)
        .post(`${META_API_COMMENTS_ROUTE}`)
        .set('xc-auth', context.token)
        .send({
          comment: TEST_COMMENT_1,
          row_id: `${firstRowId}`,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .expect(isV3 ? 201 : 200);

      response = await request(context.app)
        .get(`${META_API_COMMENTS_ROUTE}`)
        .query({
          row_id: `${firstRowId}`,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .set('xc-auth', context.token)
        .expect(200);
      commentsResponse = isV3 ? response.body : response.body.list;
      expect(commentsResponse).to.be.not.be.undefined;
      expect(commentsResponse.length).to.eq(1);

      let commentResponse = commentsResponse[0];

      expect(commentResponse).to.haveOwnProperty('id');

      expect(commentResponse).to.haveOwnProperty('comment');
      expect(commentResponse.comment).to.eq(TEST_COMMENT_1);

      expect(commentResponse).to.haveOwnProperty('created_at');
      expect(commentResponse).to.haveOwnProperty('updated_at');

      if (isV1 || isV2) {
        expect(commentResponse).to.haveOwnProperty('source_id');

        expect(commentResponse).to.haveOwnProperty('base_id');
        expect(commentResponse.base_id).to.eq(base.id);

        expect(commentResponse).to.haveOwnProperty('fk_model_id');
        expect(commentResponse.fk_model_id).to.eq(table.id);

        expect(commentResponse).to.haveOwnProperty('row_id');
        expect(commentResponse.row_id).to.eq(`${firstRowId}`);

        expect(commentResponse).to.haveOwnProperty('created_by');
        expect(commentResponse).to.haveOwnProperty('created_by_email');
        expect(commentResponse).to.haveOwnProperty('resolved_by');
        expect(commentResponse).to.haveOwnProperty('resolved_by_email');

        expect(commentResponse).to.haveOwnProperty('parent_comment_id');
        expect(commentResponse.parent_comment_id).to.eq(null);

        // expect(commentResponse).to.haveOwnProperty('status');
      } else if (isV3) {
        expect(commentResponse).to.haveOwnProperty('created_by');
        expect(commentResponse.created_by).to.have.keys([
          'id',
          'name',
          'email',
        ]);

        expect(commentResponse).to.haveOwnProperty('resolved_by');
        expect(commentResponse.resolved_by).to.have.keys([
          'id',
          'name',
          'email',
        ]);
      }

      // For V1 and V2, path doesn't end with plural
      const patchOrDelBasePath = isV3
        ? META_API_COMMENTS_ROUTE
        : META_API_COMMENTS_ROUTE.replace('comments', 'comment');
      await request(context.app)
        .patch(`${patchOrDelBasePath}/${commentResponse.id}`)
        .set('xc-auth', context.token)
        .send({
          comment: TEST_COMMENT_2,
          row_id: `${firstRowId}`,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .expect(isV3 ? 201 : 200);

      response = await request(context.app)
        .get(`${META_API_COMMENTS_ROUTE}`)
        .query({
          row_id: `${firstRowId}`,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .set('xc-auth', context.token)
        .expect(200);
      commentsResponse = isV3 ? response.body : response.body.list;
      expect(commentsResponse).to.be.not.be.undefined;
      expect(commentsResponse.length).to.eq(1);

      commentResponse = commentsResponse[0];
      expect(commentResponse).to.haveOwnProperty('comment');
      expect(commentResponse.comment).to.eq(TEST_COMMENT_2);

      await request(context.app)
        .delete(`${patchOrDelBasePath}/${commentResponse.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      response = await request(context.app)
        .get(`${META_API_COMMENTS_ROUTE}`)
        .query({
          row_id: `${firstRowId}`,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .set('xc-auth', context.token)
        .expect(200);

      commentsResponse = isV3 ? response.body : response.body.list;
      expect(commentsResponse).to.be.not.be.undefined;
      expect(commentsResponse.length).to.eq(0);
    });
  }

  describe(`Comments Meta Tests ${API_VERSION}`, commentsTests);
}
