import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';

export default function () {
  describe('error-handling: Column v3', () => {
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
      it('will handle empty title', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: '', type: 'SingleLineText' })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.include('Invalid request body');
      });
      it('will handle duplicate alias', async () => {
        await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'MyColumn', type: 'SingleLineText' })
          .expect(200);
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'MyColumn', type: 'SingleLineText' })
          .expect(422);
        expect(result.body.error).to.eq('DUPLICATE_ALIAS');
        expect(result.body.message).to.include('Duplicate column alias');
      });
      it('will handle incorrect title length', async () => {
        const longTitle = 'a'.repeat(300);
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: longTitle, type: 'SingleLineText' })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.include('Invalid request body');
      });
      it('will handle missing type', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'NoType' })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.include('Invalid request body');
      });
      it('will handle incorrect field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'NoType', type: 'Barcode' })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.satisfy((msg) =>
          msg.startsWith("Missing 'fk_barcode_value_column_id'"),
        );
      });
    });

    describe('column get', () => {
      it('will handle column not found', async () => {
        const result = await request(context.app)
          .get(`${API_PREFIX}/fields/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('FIELD_NOT_FOUND');
        expect(result.body.message).to.include(`Field 'NOT_FOUND' not found`);
      });
    });

    describe('column update', () => {
      let column: any;
      beforeEach(async () => {
        const colResult = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'UpdatableColumn', type: 'SingleLineText' })
          .expect(200);
        column = colResult.body;
      });

      it('will handle column not found', async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .send({ title: 'any' })
          .expect(422);

        expect(result.body.error).to.eq('FIELD_NOT_FOUND');
        expect(result.body.message).to.include(`Field 'NOT_FOUND' not found`);
      });
      it('will handle duplicate alias', async () => {
        await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'AnotherColumn', type: 'SingleLineText' })
          .expect(200);
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/${column.id}`)
          .set('xc-token', context.xc_token)
          .send({ title: 'AnotherColumn' })
          .expect(422);
        expect(result.body.error).to.eq('DUPLICATE_ALIAS');
        expect(result.body.message).to.satisfy((msg) =>
          msg.startsWith('Duplicate column alias'),
        );
      });
      it('will handle incorrect title length', async () => {
        const longTitle = 'a'.repeat(300);
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/${column.id}`)
          .set('xc-token', context.xc_token)
          .send({ title: longTitle })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.satisfy((msg) =>
          msg.startsWith('Column title aaaaa'),
        );
      });
      it('will handle uidt incorrect', async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/${column.id}`)
          .set('xc-token', context.xc_token)
          .send({ uidt: 'NotFoundUIDT' })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.include('Invalid request body');
      });
    });

    describe('column delete', () => {
      it('will handle column not found', async () => {
        const result = await request(context.app)
          .delete(`${API_PREFIX}/fields/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('FIELD_NOT_FOUND');
        expect(result.body.message).to.include(`Field 'NOT_FOUND' not found`);
      });
    });
  });
}
