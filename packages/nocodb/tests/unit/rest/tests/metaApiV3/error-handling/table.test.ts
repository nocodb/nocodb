import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { SqlUiFactory } from 'nocodb-sdk';
import init from '../../../../init';
import { Base } from '~/models';

export default function () {
  describe(`error-handling: Table v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'MyBase',
        })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
    });

    describe('table create', () => {
      it(`will handle empty title`, async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: '',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          'Missing table `title` property in request body',
        );
      });
      it(`will handle duplicate alias`, async () => {
        const _result1 = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyTable',
          })
          .expect(200);
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyTable',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq('Duplicate table alias');
      });
      it(`will handle incorrect title`, async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: '~!.,1230856123{}+_',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          'Following characters are not allowed "."',
        );
      });
      it(`will handle incorrect title length`, async () => {
        const source = (
          await (
            await Base.get(
              {
                fk_workspace_id: context.fk_workspace_id,
                base_id: initBase.id,
              },
              initBase.id,
            )
          ).getSources()
        )[0];

        const sqlUi = SqlUiFactory.create({ client: source.type });
        const repeatTimes = Math.ceil(sqlUi.tableNameLengthLimit / 10);
        const title = 'A012345678'.repeat(repeatTimes);
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title,
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          sqlUi.tableNameLengthLimit > 250
            ? 'Invalid request body'
            : `Table name exceeds ${sqlUi.tableNameLengthLimit} characters`,
        );
      });

      it(`will create number column with incorrect options`, async () => {
        const table = {
          title: 'Table Number',
          description: 'Description',
          fields: [
            {
              title: 'Number',
              type: 'Number',
              options: {
                thousand_separator: true,
              },
            },
          ],
        };

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-auth', context.token)
          .send(table)
          .expect(400);

        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });
    });
    describe('table get', () => {
      it(`will handle table not found`, async () => {
        const result = await request(context.app)
          .get(`${API_PREFIX}/tables/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('TABLE_NOT_FOUND');
        expect(result.body.message).to.eq(`Table 'NOT_FOUND' not found`);
      });
    });
    describe('table update', () => {
      let myTable: any;
      beforeEach(async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyTable',
          });
        myTable = result.body;
      });
      it(`will handle table not found`, async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/tables/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'any',
          })
          .expect(422);
        expect(result.body.error).to.eq('TABLE_NOT_FOUND');
        expect(result.body.message).to.eq(`Table 'NOT_FOUND' not found`);
      });
      it(`will handle title special character`, async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/tables/${myTable?.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: '~!.,1230856123{}+_',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          'Following characters are not allowed "."',
        );
      });
      it(`will handle empty title`, async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/tables/${myTable?.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: '',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          'Missing table name `table_name` property in request body',
        );
      });

      it(`will handle duplicate alias`, async () => {
        const _result1 = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyTable1',
          })
          .expect(200);
        const result = await request(context.app)
          .patch(`${API_PREFIX}/tables/${_result1.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyTable',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq('Duplicate table alias');
      });
      it(`will handle incorrect title length`, async () => {
        const source = (
          await (
            await Base.get(
              {
                fk_workspace_id: context.fk_workspace_id,
                base_id: initBase.id,
              },
              initBase.id,
            )
          ).getSources()
        )[0];

        const sqlUi = SqlUiFactory.create({ client: source.type });
        const repeatTimes = Math.ceil(sqlUi.tableNameLengthLimit / 10);
        const title = 'A012345678'.repeat(repeatTimes);

        const result = await request(context.app)
          .patch(`${API_PREFIX}/tables/${myTable?.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title,
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(
          `Table name exceeds ${sqlUi.tableNameLengthLimit} characters`,
        );
      });
    });
    describe('table delete', () => {
      it(`will handle table not found`, async () => {
        const result = await request(context.app)
          .get(`${API_PREFIX}/tables/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('TABLE_NOT_FOUND');
        expect(result.body.message).to.eq(`Table 'NOT_FOUND' not found`);
      });
    });
  });
}
