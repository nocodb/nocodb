import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { isEE } from 'playwright/setup/db';
import init from '../../../../init';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export default function () {
  if (!isEE()) {
    return true;
  }
  describe(`error-handling: View v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX;
    let table;
    let ctx;
    let featureMock: any;

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
      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
      ctx = {
        base_id: initBase.id,
        workspace_id: workspaceId,
      };
      // create a table for column tests
      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'MyTable',
          fields: [
            {
              title: 'Title',
              type: 'SingleLineText',
            },
            {
              title: 'Number',
              type: 'Number',
            },
            {
              title: 'DateTime',
              type: 'DateTime',
            },
            {
              title: 'SingleSelect',
              type: 'SingleSelect',
              options: {
                choices: [
                  { title: 'Option1', color: '#ff0000' },
                  { title: 'Option2', color: '#00ff00' },
                ],
              },
            },
            {
              title: 'Checkbox',
              type: 'Checkbox',
              default_value: true,
            },
            {
              title: 'Attachment',
              type: 'Attachment',
            },
          ],
        })
        .expect(200);
      const source = (await initBase.getSources())[0];
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: initBase.id,
      });
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id!,
        feature: `${PlanFeatureTypes.FEATURE_API_VIEW_V3}`,
        allowed: true,
      });
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('view create + update', () => {
      it(`will handle missing name`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            type: 'grid',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });
      it(`will handle feature not supported`, async () => {
        featureMock = await overrideFeature({
          workspace_id: context.fk_workspace_id!,
          feature: `${PlanFeatureTypes.FEATURE_API_VIEW_V3}`,
          allowed: false,
        });
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            type: 'grid',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(403);
        expect(response.body.error).to.eq('FEATURE_NOT_SUPPORTED');
      });
      it(`will handle empty name`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: '',
            type: 'grid',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(response.body.message).to.eq(
          'Missing view `title` property in request body',
        );
      });
      it(`will handle duplicate name`, async () => {
        const response1 = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
          });
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(response.body.message).to.eq(
          `View title 'MyView' already exists`,
        );
        const response2 = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView32',
            type: 'grid',
          });
        expect(response2.status).to.eq(200);
        const updateResponse1 = await request(context.app)
          .patch(`${API_PREFIX}/views/${response2.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView32',
            type: 'grid',
          });
        expect(updateResponse1.status).to.eq(200);
        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response2.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
          });
        expect(updateResponse.status).to.eq(400);
        expect(updateResponse.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(updateResponse.body.message).to.eq(
          `View title 'MyView' already exists`,
        );
      });
      it(`will handle empty type`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });
      it(`will handle invalid type`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'nogrid',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });

      it(`will handle invalid sort field`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
            sorts: [
              {
                field_ids: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });

      it(`will handle invalid table id`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/NOTEXISTSTABLE/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.status).to.eq(422);
        expect(response.body.error).to.eq('TABLE_NOT_FOUND');
      });

      it(`will handle invalid groups property`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
            options: {
              groups: [
                {
                  field_ids: 'asdmalmkdm',
                },
              ],
            },
          });
        expect(response.status).to.eq(400);
        expect(response.body.error).to.eq('INVALID_REQUEST_BODY');
      });

      it(`will handle invalid groups field id`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
            options: {
              groups: [
                {
                  field_id: 'NOT_EXISTS',
                },
              ],
            },
          });
        expect(response.status).to.eq(422);
        expect(response.body.error).to.eq('FIELD_NOT_FOUND');
      });

      it(`will handle update incorrect view id`, async () => {
        const response = await request(context.app)
          .patch(`${API_PREFIX}/views/NOTFOUNDID`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
          });
        expect(response.status).to.eq(422);
        expect(response.body.error).to.eq('VIEW_NOT_FOUND');
      });
    });
    describe('delete', () => {
      it(`will handle delete incorrect view id`, async () => {
        const response = await request(context.app)
          .delete(`${API_PREFIX}/views/NOTFOUNDID`)
          .set('xc-token', context.xc_token);
        expect(response.status).to.eq(422);
        expect(response.body.error).to.eq('VIEW_NOT_FOUND');
      });
    });
  });
}
