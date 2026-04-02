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
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
        expect(result.body.message).to.include(`'title' must not be empty`);
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
        expect(result.body.error).to.eq('ERR_DUPLICATE_IN_ALIAS');
        expect(result.body.message).to.include('Duplicate column alias');
      });
      it('will handle incorrect title length', async () => {
        const longTitle = 'a'.repeat(300);
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: longTitle, type: 'SingleLineText' })
          .expect(400);
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
        expect(result.body.message).to.include(`'title' must be at most 255 characters`);
      });
      it('will handle missing type', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'NoType' })
          .expect(400);
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
        expect(result.body.message).to.include(`'type' is required`);
      });
      it('will handle incorrect field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields/`)
          .set('xc-token', context.xc_token)
          .send({ title: 'NoType', type: 'Barcode' })
          .expect(400);
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
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
        expect(result.body.error).to.eq('ERR_FIELD_NOT_FOUND');
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

        expect(result.body.error).to.eq('ERR_FIELD_NOT_FOUND');
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
        expect(result.body.error).to.eq('ERR_DUPLICATE_IN_ALIAS');
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
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
        expect(result.body.message).to.satisfy((msg) =>
          msg.startsWith('Column title aaaaa'),
        );
      });
      it('will handle uidt incorrect', async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/${column.id}`)
          .set('xc-token', context.xc_token)
          .send({ title: 'title', type: 'NotFoundUIDT' })
          .expect(400);
        expect(result.body.error).to.eq('ERR_INVALID_REQUEST_BODY');
        expect(result.body.message).to.include(`'type' must be one of: SingleLineText`);
      });
    });

    describe('system/pk column meta-only update', () => {
      let pkColumn: any;
      let systemColumns: any[];

      beforeEach(async () => {
        // Fetch table columns via v2 API to find PK and system fields
        const tableInfoResult = await request(context.app)
          .get(`/api/v2/meta/tables/${table.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const columns = tableInfoResult.body.columns;
        pkColumn = columns.find((c: any) => c.pk);
        systemColumns = columns.filter((c: any) => c.system);
      });

      it('should allow meta-only update (description) on pk column', async () => {
        await request(context.app)
          .patch(`${API_PREFIX}/fields/${pkColumn.id}`)
          .set('xc-token', context.xc_token)
          .send({ description: 'Primary key description' })
          .expect(200);
      });

      it('should block structural update on pk column', async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}/fields/${pkColumn.id}`)
          .set('xc-token', context.xc_token)
          .send({ title: 'RenamedPK', type: 'SingleLineText' })
          .expect(422);
        expect(result.body.error).to.eq('ERR_SYSTEM_FIELD_NON_MODIFIABLE');
      });

      it('should block structural update on system fields', async () => {
        for (const col of systemColumns) {
          const result = await request(context.app)
            .patch(`${API_PREFIX}/fields/${col.id}`)
            .set('xc-token', context.xc_token)
            .send({ title: 'RenamedSystem', type: 'SingleLineText' })
            .expect(422);
          expect(result.body.error).to.eq('ERR_SYSTEM_FIELD_NON_MODIFIABLE');
        }
      });

      it('should allow meta-only update (description) on CreatedTime system field', async () => {
        const createdTimeCol = systemColumns.find(
          (c: any) => c.uidt === 'CreatedTime',
        );
        await request(context.app)
          .patch(`${API_PREFIX}/fields/${createdTimeCol.id}`)
          .set('xc-token', context.xc_token)
          .send({ description: 'Created timestamp' })
          .expect(200);
      });
    });

    describe('column delete', () => {
      it('will handle column not found', async () => {
        const result = await request(context.app)
          .delete(`${API_PREFIX}/fields/NOT_FOUND`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('ERR_FIELD_NOT_FOUND');
        expect(result.body.message).to.include(`Field 'NOT_FOUND' not found`);
      });
    });
  });
}
