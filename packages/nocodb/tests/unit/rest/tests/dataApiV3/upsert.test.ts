/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from './helpers';
import type { Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('upsert', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
    });

    describe('text-based', () => {
      let table: Model;

      beforeEach(async function () {
        const initResult = await beforeEachTextBased(testContext);
        table = initResult.table;
      });

      it('creates a new record when no existing match is found', async () => {
        const uniqueEmail = 'upsert.create@noco.com';
        const response = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            matchBy: ['Email'],
            fields: {
              Email: uniqueEmail,
              SingleLineText: 'created via upsert',
            },
          },
        });

        expect(response.body).to.include({ created: 1, updated: 0 });
        expect(response.body.records).to.have.length(1);
        expect(response.body.records[0]).to.include({
          operation: 'created',
        });
        expect(response.body.records[0].fields.Email).to.equal(uniqueEmail);

        const createdRecord = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: { where: `(Email,eq,${uniqueEmail})`, limit: 1 },
        });
        expect(createdRecord.body.records).to.have.length(1);
        expect(createdRecord.body.records[0].fields.SingleLineText).to.equal(
          'created via upsert',
        );
      });

      it('updates an existing record when match criteria resolve to a row', async () => {
        const uniqueEmail = 'upsert.update@noco.com';

        const createResponse = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            matchBy: ['Email'],
            fields: {
              Email: uniqueEmail,
              SingleLineText: 'created for update',
            },
          },
        });

        const createdId = createResponse.body.records[0].id;

        const response = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            matchBy: ['Email'],
            fields: {
              Email: uniqueEmail,
              SingleLineText: 'updated via upsert',
            },
          },
        });

        expect(response.body).to.include({ created: 0, updated: 1 });
        expect(response.body.records).to.have.length(1);
        expect(response.body.records[0]).to.include({
          operation: 'updated',
          id: createdId,
        });

        const updatedRecord = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/${createdId}`,
          query: { fields: 'Id,Email,SingleLineText' },
        });
        expect(updatedRecord.body.fields.SingleLineText).to.equal(
          'updated via upsert',
        );
      });

      it('supports mixed create and update operations in a single payload', async () => {
        const updateEmail = 'upsert.mixed.update@noco.com';
        const createEmail = 'upsert.mixed.create@noco.com';

        const createForUpdate = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            matchBy: ['Email'],
            fields: {
              Email: updateEmail,
              SingleLineText: 'mixed update original',
            },
          },
        });

        const updateId = createForUpdate.body.records[0].id;

        const response = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: [
            {
              matchBy: ['Email'],
              fields: {
                Email: updateEmail,
                SingleLineText: 'mixed update changed',
              },
            },
            {
              matchBy: ['Email'],
              fields: {
                Email: createEmail,
                SingleLineText: 'mixed create entry',
              },
            },
          ],
        });

        expect(response.body).to.include({ created: 1, updated: 1 });
        expect(response.body.records).to.have.length(2);
        expect(response.body.records[0]).to.include({
          operation: 'updated',
          id: updateId,
        });
        expect(response.body.records[1]).to.include({
          operation: 'created',
        });
      });

      it('updates using an explicit id without match fields', async () => {
        const createResponse = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: {
            fields: {
              Email: 'upsert.id@noco.com',
              SingleLineText: 'inserted via standard create',
            },
          },
        });

        const createdId = createResponse.body.records[0].id;

        const response = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            id: createdId,
            fields: {
              SingleLineText: 'id based upsert',
            },
          },
        });

        expect(response.body).to.include({ created: 0, updated: 1 });
        expect(response.body.records).to.have.length(1);
        expect(response.body.records[0]).to.include({
          operation: 'updated',
          id: createdId,
        });

        const updatedRecord = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/${createdId}`,
          query: { fields: 'Id,SingleLineText' },
        });
        expect(updatedRecord.body.fields.SingleLineText).to.equal(
          'id based upsert',
        );
      });

      it('fails when required match fields are missing', async () => {
        const response = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records/upsert`,
          body: {
            matchBy: ['Email'],
            fields: {
              SingleLineText: 'missing email value',
            },
          },
          status: 422,
        });

        expect(response.body.error).to.equal('REQUIRED_FIELD_MISSING');
      });
    });
  });
});
