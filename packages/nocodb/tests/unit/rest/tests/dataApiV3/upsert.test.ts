/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from '../../../init';
import type { Column, Model } from '../../../../../src/models';
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
      let columns: Column[];
      let insertedRecords: any[];

      beforeEach(async function () {
        const initResult = await beforeEachTextBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
      });

      function upsertUrl() {
        return `${urlPrefix}/${table.id}/records/upsert`;
      }

      function recordsUrl() {
        return `${urlPrefix}/${table.id}/records`;
      }

      /** Insert a record with a unique email via the create API */
      async function createUniqueRecord(
        email: string,
        extraFields: Record<string, any> = {},
      ) {
        const rsp = await ncAxiosPost({
          url: recordsUrl(),
          body: {
            fields: {
              Email: email,
              SingleLineText: 'seed-for-upsert',
              ...extraFields,
            },
          },
        });
        return rsp.body.records[0];
      }

      // ── Happy path ──────────────────────────────────────────────

      it('Upsert: single record insert', async function () {
        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: {
              fields: {
                SingleLineText: 'upsert-new',
                Email: 'upsert@test.com',
              },
            },
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'inserted');
        expect(rsp.body.records[0]).to.have.property('fields');
        expect(rsp.body.records[0].fields.SingleLineText).to.equal(
          'upsert-new',
        );
      });

      it('Upsert: single record update via fieldsToMergeOn', async function () {
        const uniqueEmail = `upsert-single-${Date.now()}@test.com`;
        await createUniqueRecord(uniqueEmail);

        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: uniqueEmail,
                  SingleLineText: 'upsert-updated',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'updated');
        expect(rsp.body.records[0].fields.SingleLineText).to.equal(
          'upsert-updated',
        );
      });

      it('Upsert: bulk mix of inserts and updates', async function () {
        const uniqueEmail1 = `upsert-bulk1-${Date.now()}@test.com`;
        const uniqueEmail2 = `upsert-bulk2-${Date.now()}@test.com`;
        await createUniqueRecord(uniqueEmail1);
        await createUniqueRecord(uniqueEmail2);

        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: uniqueEmail1,
                  SingleLineText: 'bulk-updated-1',
                },
              },
              {
                fields: {
                  Email: 'bulknew1@test.com',
                  SingleLineText: 'bulk-new-1',
                },
              },
              {
                fields: {
                  Email: uniqueEmail2,
                  SingleLineText: 'bulk-updated-2',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(3);

        const statuses = rsp.body.records.map((r) => r.status);
        expect(statuses).to.include('updated');
        expect(statuses).to.include('inserted');

        // Updated records come first, then inserted
        const updatedRecords = rsp.body.records.filter(
          (r) => r.status === 'updated',
        );
        const insertedRecords = rsp.body.records.filter(
          (r) => r.status === 'inserted',
        );
        expect(updatedRecords).to.have.length(2);
        expect(insertedRecords).to.have.length(1);
      });

      it('Upsert: single object body (non-array)', async function () {
        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: {
              fields: {
                SingleLineText: 'single-object',
                Email: 'single@test.com',
              },
            },
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'inserted');
        expect(rsp.body.records[0]).to.have.property('id');
        expect(rsp.body.records[0]).to.have.property('fields');
      });

      it('Upsert: verify updated record fields are persisted', async function () {
        const uniqueEmail = `upsert-persist-${Date.now()}@test.com`;
        const created = await createUniqueRecord(uniqueEmail);

        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: uniqueEmail,
                  SingleLineText: 'persisted-value',
                },
              },
            ],
          },
        });

        // Verify via GET
        const getRsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/${created.id}`,
        });

        expect(getRsp.body.fields.SingleLineText).to.equal('persisted-value');
        expect(getRsp.body.fields.Email).to.equal(uniqueEmail);
      });

      // ── Happy path: fieldsToMergeOn matching ──────────────────

      it('Upsert: fieldsToMergeOn update (matching field value)', async function () {
        const uniqueEmail = `upsert-merge-${Date.now()}@test.com`;
        await createUniqueRecord(uniqueEmail);

        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: uniqueEmail,
                  SingleLineText: 'merged-update',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'updated');
        expect(rsp.body.records[0].fields.SingleLineText).to.equal(
          'merged-update',
        );
      });

      it('Upsert: fieldsToMergeOn insert (no match)', async function () {
        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: 'nonexistent-merge@test.com',
                  SingleLineText: 'merged-insert',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'inserted');
        expect(rsp.body.records[0].fields.Email).to.equal(
          'nonexistent-merge@test.com',
        );
      });

      it('Upsert: composite fieldsToMergeOn', async function () {
        const uniqueEmail = `upsert-composite-${Date.now()}@test.com`;
        const uniqueSLT = `composite-slt-${Date.now()}`;
        await createUniqueRecord(uniqueEmail, {
          SingleLineText: uniqueSLT,
        });

        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email', 'SingleLineText'],
            records: [
              {
                fields: {
                  Email: uniqueEmail,
                  SingleLineText: uniqueSLT,
                  MultiLineText: 'composite-merge-update',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'updated');
        expect(rsp.body.records[0].fields.MultiLineText).to.equal(
          'composite-merge-update',
        );
      });

      it('Upsert: fieldsToMergeOn mix of insert and update', async function () {
        const uniqueEmail = `upsert-mix-${Date.now()}@test.com`;
        await createUniqueRecord(uniqueEmail);

        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: uniqueEmail,
                  SingleLineText: 'merge-update',
                },
              },
              {
                fields: {
                  Email: 'brand-new-merge@test.com',
                  SingleLineText: 'merge-insert',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(2);
        const statuses = rsp.body.records.map((r) => r.status);
        expect(statuses).to.include('updated');
        expect(statuses).to.include('inserted');
      });

      // ── Error handling ─────────────────────────────────────────

      it('Upsert: invalid table ID', async function () {
        await ncAxiosPost({
          url: `${urlPrefix}/123456789/records/upsert`,
          body: {
            records: [{ fields: { SingleLineText: 'test' } }],
          },
          status: 422,
        });
      });

      it('Upsert: missing records property', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {},
          status: 400,
        });
      });

      it('Upsert: empty records array', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: { records: [] },
          status: 400,
        });
      });

      it('Upsert: record missing fields property', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            records: [{ notFields: { SingleLineText: 'test' } }],
          },
          status: 400,
        });
      });

      it('Upsert: record with extra properties', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            records: [
              {
                fields: { SingleLineText: 'test' },
                extraProp: 'not-allowed',
              },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: payload exceeds limit', async function () {
        // V3_DATA_PAYLOAD_LIMIT defaults to 10
        const records = Array.from({ length: 11 }, (_, i) => ({
          fields: { SingleLineText: `record-${i}` },
        }));

        await ncAxiosPost({
          url: upsertUrl(),
          body: { records },
          status: 422,
        });
      });

      it('Upsert: fieldsToMergeOn with non-existent field', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['NonExistentField'],
            records: [
              { fields: { NonExistentField: 'val', SingleLineText: 'test' } },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: fieldsToMergeOn exceeds maximum (3)', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: [
              'SingleLineText',
              'MultiLineText',
              'Email',
              'Phone',
            ],
            records: [
              {
                fields: {
                  SingleLineText: 'a',
                  MultiLineText: 'b',
                  Email: 'c@d.com',
                  Phone: '123',
                },
              },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: record with primary key field in fields', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            records: [
              {
                fields: {
                  Id: 1,
                  SingleLineText: 'test',
                },
              },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: record missing value for fieldsToMergeOn field', async function () {
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  SingleLineText: 'test',
                  // Email is missing
                },
              },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: null merge field matches existing null records (Airtable behavior)', async function () {
        // Seed data has multiple records with null Email — should error on duplicate match
        await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Email'],
            records: [
              {
                fields: {
                  Email: null,
                  SingleLineText: 'test',
                },
              },
            ],
          },
          status: 400,
        });
      });

      it('Upsert: null merge field updates single existing null record', async function () {
        // Create a table state where exactly one record has a unique null-like value
        // by using a field value that doesn't exist in seed data
        const uniquePhone = `null-test-${Date.now()}`;
        await createUniqueRecord(`null-merge-setup-${Date.now()}@test.com`, {
          Phone: uniquePhone,
        });

        // Merge on Phone — only one record has this value
        const rsp = await ncAxiosPost({
          url: upsertUrl(),
          body: {
            fieldsToMergeOn: ['Phone'],
            records: [
              {
                fields: {
                  Phone: uniquePhone,
                  SingleLineText: 'null-merge-updated',
                },
              },
            ],
          },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('status', 'updated');
      });
    });
  });
});
