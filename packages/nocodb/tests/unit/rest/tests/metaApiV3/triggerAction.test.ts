import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Trigger Action v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let META_PREFIX: string;
    let DATA_PREFIX: string;
    let table: any;

    async function createTable(title: string) {
      const res = await request(context.app)
        .post(`${META_PREFIX}/tables`)
        .set('xc-token', context.xc_token)
        .send({ title })
        .expect(200);
      return res.body;
    }

    async function createFormulaButtonColumn(
      tableId: string,
      title: string,
      formula: string,
    ) {
      const res = await request(context.app)
        .post(`${META_PREFIX}/tables/${tableId}/fields`)
        .set('xc-token', context.xc_token)
        .send({
          title,
          type: 'Button',
          options: {
            type: 'formula',
            formula,
            label: 'Open',
            color: 'brand',
            theme: 'solid',
          },
        })
        .expect(200);
      return res.body;
    }

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'TriggerActionTestBase' })
        .expect(200);
      initBase = baseResult.body;
      META_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
      DATA_PREFIX = `/api/v3/data/${initBase.id}`;

      // Create table
      table = await createTable('ActionTestTable');
    });

    describe('validation', () => {
      it('should reject non-existent table', async () => {
        const res = await request(context.app)
          .post(
            `${DATA_PREFIX}/nonexistent_table_id/actions/nonexistent_col_id`,
          )
          .set('xc-auth', context.token)
          .send({ rowIds: ['1'] });

        expect(res.status).to.be.oneOf([404, 422]);
      });

      it('should reject non-existent column', async () => {
        const res = await request(context.app)
          .post(`${DATA_PREFIX}/${table.id}/actions/nonexistent_col_id`)
          .set('xc-auth', context.token)
          .send({ rowIds: ['1'] });

        expect(res.status).to.be.oneOf([404, 422]);
      });

      it('should reject non-AI/Button column', async () => {
        // Create a SingleLineText column (not Button) to test rejection
        const fieldRes = await request(context.app)
          .post(`${META_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'PlainText', type: 'SingleLineText' })
          .expect(200);

        const textCol = fieldRes.body;
        expect(textCol).to.have.property('id');

        const res = await request(context.app)
          .post(`${DATA_PREFIX}/${table.id}/actions/${textCol.id}`)
          .set('xc-auth', context.token)
          .send({ rowIds: ['1'] });

        expect(res.status).to.equal(422);
        expect(res.body).to.have.property('msg');
      });
    });

    describe('Formula Button column', () => {
      it('should reject triggerAction for Formula Button (not AI)', async () => {
        const buttonCol = await createFormulaButtonColumn(
          table.id,
          'URL Button',
          '"https://example.com"',
        );

        const res = await request(context.app)
          .post(`${DATA_PREFIX}/${table.id}/actions/${buttonCol.id}`)
          .set('xc-auth', context.token)
          .send({ rowIds: ['1'] });

        expect(res.status).to.equal(422);
        expect(res.body).to.have.property('msg');
      });
    });

    describe('authentication', () => {
      it('should reject unauthenticated requests', async () => {
        const buttonCol = await createFormulaButtonColumn(
          table.id,
          'Button Auth',
          '"https://example.com"',
        );

        await request(context.app)
          .post(`${DATA_PREFIX}/${table.id}/actions/${buttonCol.id}`)
          .send({ rowIds: ['1'] })
          .expect(401);
      });
    });
  });
}
