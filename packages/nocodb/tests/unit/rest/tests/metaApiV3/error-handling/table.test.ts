import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';

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

    describe.only('table create', () => {
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
    });
    describe('table get', () => {});
    describe('table update', () => {});
    describe('table delete', () => {});
  });
}
