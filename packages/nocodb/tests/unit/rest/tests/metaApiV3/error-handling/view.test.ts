import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export default function () {
  describe(`error-handling: View v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX;
    let table;
    let ctx;

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
    });

    describe('view create + update', () => {
      it(`will handle empty name`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            type: 'GRID',
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
      it(`will handle empty type`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
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
            name: 'MyView',
            type: 'NOGRID',
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
    });
  });
}
