import 'mocha';

import { expect } from 'chai';
import request from 'supertest';

import { Base, Model } from '../../../../../src/models';
import { createProject } from '../../../factory/base';
import { createTable } from '../../../factory/table';
import init from '../../../init';
import { createRow } from '../../../factory/row';

export default async function (API_VERSION: 'v1' | 'v2' | 'v3') {
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

    it.only(`Comments Meta CRUD ${API_VERSION}`, async () => {
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
        .send({
          comment: TEST_COMMENT_1,
          row_id: firstRowId,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .expect(201);

      response = await request(context.app)
        .get(`${META_API_COMMENTS_ROUTE}`)
        .query({
          row_id: firstRowId,
          [isV3 ? 'table_id' : 'fk_model_id']: table.id,
        })
        .set('xc-auth', context.token)
        .expect(200);
      commentsResponse = isV3 ? response.body : response.body.list;
      expect(commentsResponse).to.be.not.be.undefined;
      expect(commentsResponse.length).to.eq(1);

      let commentResponse = commentsResponse[0];
      
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
      expect(commentResponse).to.haveOwnProperty('');
    });
  }

  describe(`Comments Meta Tests ${API_VERSION}`, commentsTests);
}

/**
 * {
"id": "adt_3sii7erfwrlegb",
"source_id": null,
"base_id": "p_63b4q0qengen1x",
"fk_model_id": "md_5mipbdg6ketmv8",
"row_id": "1",
"created_by": "",
"resolved_by": "",
"parent_comment_id": null,
"status": null,
"comment": "bar",
"created_at": "2023-03-13T09:39:14.225Z",
"updated_at": "2023-03-13T09:39:14.225Z"
}
 */