import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Hooks v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let API_PREFIX: string;
    let tableId: string;
    let featureMock: any;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'HookTestBase' })
        .expect(200);

      API_PREFIX = `/api/v3/meta/bases/${baseResult.body.id}`;

      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'HookTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);

      tableId = tableResult.body.id;

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id!,
        feature: `${PlanFeatureTypes.FEATURE_API_WEBHOOK_V3}`,
        allowed: true,
      });
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const sampleHook = {
      title: 'Test Hook',
      operation: ['insert'],
      notification: {
        type: 'URL',
        payload: {
          method: 'POST',
          path: 'https://example.com/webhook',
        },
      },
    };

    async function createHook(overrides: Record<string, any> = {}) {
      const response = await request(context.app)
        .post(`${API_PREFIX}/tables/${tableId}/hooks`)
        .set('xc-token', context.xc_token)
        .send({ ...sampleHook, ...overrides })
        .expect(200);
      return response.body;
    }

    describe('List hooks', () => {
      it('will return empty list when no hooks exist', async () => {
        const response = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.have.property('list');
        expect(response.body.list).to.be.an('array').that.is.empty;
      });

      it('will return hooks after creation', async () => {
        await createHook();

        const response = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body.list).to.have.lengthOf(1);
        expect(response.body.list[0]).to.have.property('title', 'Test Hook');
        expect(response.body.list[0]).to.have.property('table_id', tableId);
      });
    });

    describe('Create hook', () => {
      it('will create a hook with URL notification', async () => {
        const hook = await createHook();

        expect(hook).to.have.property('id');
        expect(hook).to.have.property('title', 'Test Hook');
        expect(hook).to.have.property('table_id', tableId);
        expect(hook).to.have.property('event', 'record');
        expect(hook).to.have.property('active', true);
        expect(hook).to.have.property('created_at');
        expect(hook).to.have.property('updated_at');
        expect(hook.operation).to.deep.eq(['insert']);
      });

      it('will create a hook with multiple operations', async () => {
        const hook = await createHook({
          title: 'Multi-Op Hook',
          operation: ['insert', 'update', 'delete'],
        });

        expect(hook.operation).to.deep.eq(['insert', 'update', 'delete']);
      });

      it('will reject missing required fields', async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .send({ title: 'Missing notification and operation' })
          .expect(400);

        expect(response.body.msg).to.be.a('string');
      });
    });

    describe('Read hook', () => {
      it('will get a hook by id', async () => {
        const created = await createHook();

        const response = await request(context.app)
          .get(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.have.property('id', created.id);
        expect(response.body).to.have.property('title', 'Test Hook');
        expect(response.body).to.have.property('table_id', tableId);
      });
    });

    describe('Update hook', () => {
      it('will update hook title and active status', async () => {
        const created = await createHook();

        const response = await request(context.app)
          .patch(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Updated Hook',
            active: false,
            operation: ['insert'],
            notification: {
              type: 'URL',
              payload: {
                method: 'POST',
                path: 'https://example.com/webhook',
              },
            },
          })
          .expect(200);

        expect(response.body).to.have.property('title', 'Updated Hook');
        expect(response.body).to.have.property('active', false);
      });

      it('will update hook operations', async () => {
        const created = await createHook();

        const response = await request(context.app)
          .patch(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Hook',
            operation: ['update', 'delete'],
            notification: {
              type: 'URL',
              payload: {
                method: 'POST',
                path: 'https://example.com/webhook',
              },
            },
          })
          .expect(200);

        expect(response.body.operation).to.deep.eq(['update', 'delete']);
      });
    });

    describe('Delete hook', () => {
      it('will delete a hook', async () => {
        const created = await createHook();

        await request(context.app)
          .delete(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify it no longer appears in list
        const listResponse = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(listResponse.body.list).to.be.an('array').that.is.empty;
      });
    });

    describe('Feature gating', () => {
      it('will return 403 when feature is disabled', async () => {
        featureMock = await overrideFeature({
          workspace_id: context.fk_workspace_id!,
          feature: `${PlanFeatureTypes.FEATURE_API_WEBHOOK_V3}`,
          allowed: false,
        });

        const response = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token);

        expect(response.status).to.eq(403);
      });

      it('will return 403 on create when feature is disabled', async () => {
        featureMock = await overrideFeature({
          workspace_id: context.fk_workspace_id!,
          feature: `${PlanFeatureTypes.FEATURE_API_WEBHOOK_V3}`,
          allowed: false,
        });

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .send(sampleHook);

        expect(response.status).to.eq(403);
      });
    });

    describe('Full CRUD flow', () => {
      it('will create, read, update, list, and delete a hook', async () => {
        // Create
        const created = await createHook({ title: 'CRUD Hook' });
        expect(created.id).to.be.a('string');

        // Read
        const read = await request(context.app)
          .get(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(read.body.title).to.eq('CRUD Hook');

        // Update
        const updated = await request(context.app)
          .patch(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'CRUD Hook Updated',
            active: false,
            operation: ['insert'],
            notification: {
              type: 'URL',
              payload: {
                method: 'POST',
                path: 'https://example.com/webhook',
              },
            },
          })
          .expect(200);
        expect(updated.body.title).to.eq('CRUD Hook Updated');
        expect(updated.body.active).to.eq(false);

        // List
        const list = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(list.body.list).to.have.lengthOf(1);
        expect(list.body.list[0].title).to.eq('CRUD Hook Updated');

        // Delete
        await request(context.app)
          .delete(`${API_PREFIX}/hooks/${created.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify deleted
        const afterDelete = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/hooks`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(afterDelete.body.list).to.be.an('array').that.is.empty;
      });
    });
  });
}
