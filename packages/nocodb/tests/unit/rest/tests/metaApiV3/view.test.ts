import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`View v3`, () => {
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
      it(`will create + update grid view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
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
        expect(response.body.type).to.eq('grid');

        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView32',
            sorts: [
              {
                field_id: (
                  await table.getColumns(ctx)
                ).find((col) => col.title === 'Title').id,
              },
            ],
          });
        expect(updateResponse.body.title).to.eq('MyView32');
      });

      it(`will create + update grid view with groups`, async () => {
        const titleColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'Title',
        );
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'grid',
            options: {
              groups: [
                {
                  field_id: titleColumn.id,
                  direction: 'asc',
                },
              ],
            },
            sorts: [
              {
                field_id: titleColumn.id,
              },
            ],
          });
        expect(response.body.type).to.eq('grid');
        expect(response.body.options.groups.length).to.greaterThan(0);

        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView32',
            options: {
              groups: [],
            },
            sorts: [],
          });
        expect(updateResponse.body.title).to.eq('MyView32');
        expect((updateResponse.body.options?.groups ?? []).length).to.eq(0);
        expect((updateResponse.body.sorts ?? []).length).to.eq(0);

        const updateResponse2 = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            options: {
              groups: [
                {
                  field_id: titleColumn.id,
                  direction: 'asc',
                },
              ],
            },
            sorts: [
              {
                field_id: titleColumn.id,
              },
            ],
          });
        expect(updateResponse2.body.title).to.eq('MyView32');
        expect(updateResponse2.body.options.groups.length).to.greaterThan(0);
        expect(updateResponse2.body.sorts.length).to.greaterThan(0);
      });

      it(`will create grid view with fields`, async () => {
        const singleSelectColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'SingleSelect',
        );
        const titleColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'Title',
        );
        const dateTimeColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'DateTime',
        );
        const requestPayload = {
          url: `${API_PREFIX}/tables/${table.id}/views`,
          body: {
            title: 'MyView',
            type: 'grid',
            options: {
              groups: [
                {
                  field_id: titleColumn.id,
                  direction: 'asc',
                },
              ],
            },
            fields: [
              {
                field_id: singleSelectColumn.id,
                show: true,
              },
              {
                field_id: dateTimeColumn.id,
                show: false,
              },
              {
                field_id: titleColumn.id,
                show: true,
              },
            ],
          },
        };
        const response = await request(context.app)
          .post(requestPayload.url)
          .set('xc-token', context.xc_token)
          .send(requestPayload.body);
        expect(response.body.type).to.eq('grid');

        // title is first because pv
        expect(response.body.fields[0].field_id).to.eq(titleColumn.id);
        expect(response.body.fields[1].field_id).to.eq(singleSelectColumn.id);
        expect(response.body.fields[2].field_id).to.eq(dateTimeColumn.id);
      });

      it(`will create kanban view`, async () => {
        const requestPayload = {
          url: `${API_PREFIX}/tables/${table.id}/views`,
          body: {
            title: 'MyView',
            type: 'kanban',
            options: {
              stack_by: {
                field_id: (await table.getColumns(ctx)).find(
                  (col) => col.title === 'SingleSelect',
                ).id,
              },
            },
            sorts: [
              {
                field_id: (await table.getColumns(ctx)).find(
                  (col) => col.title === 'Title',
                ).id,
              },
            ],
          },
        };
        const response = await request(context.app)
          .post(requestPayload.url)
          .set('xc-token', context.xc_token)
          .send(requestPayload.body);
        expect(response.body.type).to.eq('kanban');
        expect(
          response.body.options.stack_by.stack_order.length,
        ).to.greaterThan(0);
      });

      it(`will create calendar view`, async () => {
        const requestPayload = {
          url: `${API_PREFIX}/tables/${table.id}/views`,
          body: {
            title: 'MyView',
            type: 'calendar',
            options: {
              date_ranges: [
                {
                  start_date_field_id: (await table.getColumns(ctx)).find(
                    (col) => col.title === 'DateTime',
                  ).id,
                },
              ],
            },
            sorts: [
              {
                field_id: (await table.getColumns(ctx)).find(
                  (col) => col.title === 'Title',
                ).id,
              },
            ],
          },
        };
        const response = await request(context.app)
          .post(requestPayload.url)
          .set('xc-token', context.xc_token)
          .send(requestPayload.body);
        expect(response.body.type).to.eq('calendar');
      });

      it(`will create gallery view`, async () => {
        const requestPayload = {
          url: `${API_PREFIX}/tables/${table.id}/views`,
          body: {
            title: 'MyView',
            type: 'gallery',
            options: {
              cover_field_id: (await table.getColumns(ctx)).find(
                (col) => col.title === 'Attachment',
              ).id,
            },
            sorts: [
              {
                field_id: (await table.getColumns(ctx)).find(
                  (col) => col.title === 'Title',
                ).id,
              },
            ],
          },
        };
        const response = await request(context.app)
          .post(requestPayload.url)
          .set('xc-token', context.xc_token)
          .send(requestPayload.body);
        expect(response.body.type).to.eq('gallery');
      });

      it(`will create form view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyView',
            type: 'form',
            options: {
              form_title: 'MyForm',
            },
          });
        expect(response.body.type).to.eq('form');
      });

      it(`will create + update form view with fieldsById`, async () => {
        const singleSelectColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'SingleSelect',
        );
        const titleColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'Title',
        );
        const dateTimeColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'DateTime',
        );
        const requestPayload = {
          url: `${API_PREFIX}/tables/${table.id}/views`,
          body: {
            title: 'MyView',
            type: 'form',
            options: {
              form_title: 'MyForm',
              fields_by_id: {
                [singleSelectColumn.id]: {
                  alias: 'select',
                },
                [titleColumn.id]: {
                  alias: '_title',
                  validators: [
                    {
                      type: 'minLength',
                      value: 5,
                      message: '',
                    },
                  ],
                },
                [dateTimeColumn.id]: {
                  alias: 'date time',
                },
              },
            },
          },
        };
        const response = await request(context.app)
          .post(requestPayload.url)
          .set('xc-token', context.xc_token)
          .send(requestPayload.body);

        expect(response.body.type).to.eq('form');
        expect(
          response.body.options.fields_by_id[titleColumn.id].validators.length,
        ).to.greaterThan(0);

        const updateResponse = await request(context.app)
          .patch(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            options: {
              fields_by_id: {
                [singleSelectColumn.id]: {
                  alias: 'select32',
                },
              },
            },
          });

        expect(
          updateResponse.body.options.fields_by_id[singleSelectColumn.id].alias,
        ).to.eq('select32');
      });

      it(`will create form view with all options and read them back`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'FormOptionsView',
            type: 'form',
            options: {
              form_title: 'Contact Us',
              form_description: 'Please fill in the form',
              submit_button_label: 'Send Message',
              thank_you_message: 'Thanks for reaching out!',
              redirect_url: 'https://example.com/thank-you',
              form_redirect_after_secs: 5,
              send_response_email_to: 'admin@example.com',
              show_submit_another_button: true,
              reset_form_after_submit: true,
            },
          });

        expect(response.body.type).to.eq('form');

        // Read back via GET to verify options persisted
        const getResponse = await request(context.app)
          .get(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(getResponse.body.options.form_title).to.eq('Contact Us');
        expect(getResponse.body.options.form_description).to.eq(
          'Please fill in the form',
        );
        expect(getResponse.body.options.submit_button_label).to.eq(
          'Send Message',
        );
        expect(getResponse.body.options.thank_you_message).to.eq(
          'Thanks for reaching out!',
        );
        expect(getResponse.body.options.redirect_url).to.eq(
          'https://example.com/thank-you',
        );
        expect(getResponse.body.options.form_redirect_after_secs).to.eq(5);
        expect(getResponse.body.options.send_response_email_to).to.eq(
          'admin@example.com',
        );
        expect(getResponse.body.options.show_submit_another_button).to.eq(true);
        expect(getResponse.body.options.reset_form_after_submit).to.eq(true);
      });

      it(`will update form view options`, async () => {
        // Create a basic form view first
        const createResponse = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'UpdateFormView',
            type: 'form',
            options: {
              form_title: 'Original Title',
              submit_button_label: 'Submit',
            },
          });

        expect(createResponse.body.type).to.eq('form');

        // Update form options
        await request(context.app)
          .patch(`${API_PREFIX}/views/${createResponse.body.id}`)
          .set('xc-token', context.xc_token)
          .send({
            options: {
              form_title: 'Updated Title',
              submit_button_label: 'Save Now',
              send_response_email_to: 'updated@example.com',
              form_redirect_after_secs: 10,
              thank_you_message: 'Updated thanks!',
              show_submit_another_button: false,
              reset_form_after_submit: false,
            },
          })
          .expect(200);

        // Read back via GET to verify options persisted
        const getResponse = await request(context.app)
          .get(`${API_PREFIX}/views/${createResponse.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(getResponse.body.options.form_title).to.eq('Updated Title');
        expect(getResponse.body.options.submit_button_label).to.eq('Save Now');
        expect(getResponse.body.options.send_response_email_to).to.eq(
          'updated@example.com',
        );
        expect(getResponse.body.options.form_redirect_after_secs).to.eq(10);
        expect(getResponse.body.options.thank_you_message).to.eq(
          'Updated thanks!',
        );
        expect(getResponse.body.options.show_submit_another_button).to.eq(
          false,
        );
        expect(getResponse.body.options.reset_form_after_submit).to.eq(false);
      });

      it(`will reject fields_by_id with non-existent field ID`, async () => {
        await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidFieldForm',
            type: 'form',
            options: {
              fields_by_id: {
                non_existent_field_id: {
                  alias: 'Ghost',
                },
              },
            },
          })
          .expect(404);
      });

      it(`will reject invalid validator type via schema validation`, async () => {
        const titleColumn = (await table.getColumns(ctx)).find(
          (col) => col.title === 'Title',
        );

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'BadValidatorForm',
            type: 'form',
            options: {
              fields_by_id: {
                [titleColumn.id]: {
                  validators: [
                    {
                      type: 'nonExistentValidator',
                      value: 5,
                    },
                  ],
                },
              },
            },
          });

        expect(response.status).to.be.oneOf([400, 422]);
      });

      it(`will handle form_redirect_after_secs with zero and negative values`, async () => {
        // Zero
        const zeroResponse = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'ZeroRedirectForm',
            type: 'form',
            options: {
              form_redirect_after_secs: 0,
            },
          })
          .expect(200);

        const getZero = await request(context.app)
          .get(`${API_PREFIX}/views/${zeroResponse.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(getZero.body.options.form_redirect_after_secs).to.eq(0);

        // Negative
        const negResponse = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'NegRedirectForm',
            type: 'form',
            options: {
              form_redirect_after_secs: -1,
            },
          })
          .expect(200);

        const getNeg = await request(context.app)
          .get(`${API_PREFIX}/views/${negResponse.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(getNeg.body.options.form_redirect_after_secs).to.eq(-1);
      });
    });

    describe('view delete', () => {
      it(`will delete grid view`, async () => {
        const response = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/views`)
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
        expect(response.body.type).to.eq('grid');

        const deleteResponse = await request(context.app)
          .delete(`${API_PREFIX}/views/${response.body.id}`)
          .set('xc-token', context.xc_token);
        expect(deleteResponse.status).to.eq(200);
      });
    });
  });
}
