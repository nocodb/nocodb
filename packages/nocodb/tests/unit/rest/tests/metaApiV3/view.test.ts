import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export default function () {
  describe(`View v3`, () => {
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
      it(`will create + update grid view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'GRID',
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.body.type).to.eq('GRID');

        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView32',
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(updateResponse.body.name).to.eq('MyView32');
      });

      it(`will create + update grid view with groups`, async () => {
        const titleColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'Title',
        );
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'GRID',
            options: {
              groups: [
                {
                  fieldId: titleColumn.id,
                  direction: 'asc',
                },
              ],
            },
            sorts: [
              {
                fieldId: titleColumn.id,
              },
            ],
          });
        expect(response.body.type).to.eq('GRID');
        expect(response.body.options.groups.length).to.greaterThan(0);

        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView32',
            options: {
              groups: [],
            },
            sorts: [],
          });
        expect(updateResponse.body.name).to.eq('MyView32');
        expect((updateResponse.body.options.groups ?? []).length).to.eq(0);
        expect((updateResponse.body.sorts ?? []).length).to.eq(0);

        const updateResponse2 = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            options: {
              groups: [
                {
                  fieldId: titleColumn.id,
                  direction: 'asc',
                },
              ],
            },
            sorts: [
              {
                fieldId: titleColumn.id,
              },
            ],
          });
        expect(updateResponse2.body.name).to.eq('MyView32');
        expect(updateResponse2.body.options.groups.length).to.greaterThan(0);
        expect(updateResponse2.body.sorts.length).to.greaterThan(0);
      });

      it(`will create kanban view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'KANBAN',
            options: {
              stackBy: {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'SingleSelect').id,
              },
            },
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.body.type).to.eq('KANBAN');
      });

      it(`will create calendar view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'CALENDAR',
            options: {
              dateRanges: [
                {
                  startDateFieldId: (
                    await table.getColumns(ctx)
                  ).find((col) => col.title === 'DateTime').id,
                },
              ],
            },
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.body.type).to.eq('CALENDAR');
      });

      it(`will create gallery view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'GALLERY',
            options: {
              coverFieldId: (
                await table.getColumns(ctx)
              ).find((col) => col.title === 'Attachment').id,
            },
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.body.type).to.eq('GALLERY');
      });

      it(`will create form view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            name: 'MyView',
            type: 'FORM',
            options: {
              formTitle: 'MyForm',
            },
            sorts: [
              {
                fieldId: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(response.body.type).to.eq('FORM');
      });
    });
  });
}
