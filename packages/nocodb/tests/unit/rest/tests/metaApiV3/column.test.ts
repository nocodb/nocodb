import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe('Column v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX: string;
    let table: any;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'MyBase' })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
      // create a table for column tests
      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-token', context.xc_token)
        .send({ title: 'MyTable' })
        .expect(200);
      table = tableResult.body;
    });

    describe('column create', () => {
      it('will handle SingleLineText field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FSingleLineText', type: 'SingleLineText' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FSingleLineText');
      });
    });
  });
}
