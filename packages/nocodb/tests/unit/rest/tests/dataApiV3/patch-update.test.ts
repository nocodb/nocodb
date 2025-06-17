/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from './helpers';
import type { Column, Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('patch-update', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let ncAxiosPatch: INcAxios['ncAxiosPatch'];
    let ncAxiosDelete: INcAxios['ncAxiosDelete'];
    let ncAxiosLinkGet: INcAxios['ncAxiosLinkGet'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];
    let ncAxiosLinkRemove: INcAxios['ncAxiosLinkRemove'];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
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

      const newRecord = {
        SingleLineText: 'abc',
        MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
        Email: 'a@b.com',
        Url: 'https://www.abc.com',
        Phone: '1-234-567-8910',
      };
      it('Update: all fields', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: [
            {
              id: 1,
              fields: newRecord,
            },
          ],
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1 }] });
      });

      it('Update: partial', async function () {
        const recordBeforeUpdate = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });

        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: [
            {
              id: 1,
              fields: {
                SingleLineText: 'some text',
                MultiLineText: 'some more text',
              },
            },
          ],
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1 }] });

        const recordAfterUpdate = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });
        expect(recordAfterUpdate.body).to.deep.equal({
          record: {
            id: 1,
            fields: {
              ...recordBeforeUpdate.body.record.fields,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
          },
        });
      });

      it('Update: bulk', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: [
            {
              id: 1,
              fields: {
                SingleLineText: 'some text',
                MultiLineText: 'some more text',
              },
            },
            {
              id: 2,
              fields: {
                SingleLineText: 'some text',
                MultiLineText: 'some more text',
              },
            },
          ],
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1 }, { id: 2 }] });
      });

      it('Update: single with column id', async function () {
        const idMap = {

            SingleLineText: columns.find(
              (col) => col.title === 'SingleLineText',
            )?.id,
            MultiLineText: columns.find((col) => col.title === 'MultiLineText')
              ?.id,
        };

        const updatePayload = {
          id: 1,
          fields: {
            [idMap['SingleLineText']!]: 'SingleLineText',
            [idMap['MultiLineText']!]: 'MultiLineText',
          },
        };
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatePayload,
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1 }] });
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            where: '(Id,eq,1)',
          },
        });
        expect(
          rspGet.body.records.map((k) => k.fields.SingleLineText).join(','),
        ).to.equal('SingleLineText');
      });

      it('Update: bulk with column id', async function () {
        const idMap = {
          id: columns.find((col) => col.title === 'Id')?.id,
          SingleLineText: columns.find((col) => col.title === 'SingleLineText')
            ?.id,
          MultiLineText: columns.find((col) => col.title === 'MultiLineText')
            ?.id,
        };

        const createPayload = [
          {
            id: 1,
            fields: {
              [idMap['SingleLineText']!]: 'SingleLineText',
              [idMap['MultiLineText']!]: 'MultiLineText',
            },
          },
          {
            id: 2,
            fields: {
              [idMap['SingleLineText']!]: 'SingleLineText2',
              [idMap['MultiLineText']!]: 'MultiLineText2',
            },
          },
        ];
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: createPayload,
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1 }, { id: 2 }] });
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            where: '(Id,gte,1)~and(Id,lte,2)',
          },
        });
        expect(
          rspGet.body.records.map((k) => k.fields.SingleLineText).join(','),
        ).to.equal('SingleLineText,SingleLineText2');
      });

      // Error handling

      it('Update: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosPatch({
          url: `${urlPrefix}/123456789/records`,
          body: { id: 100, fields: { SingleLineText: 'some text' } },
          status: 422,
        });
        // Invalid row ID
        await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: { id: 123456789, fields: { SingleLineText: 'some text' } },
          status: 404,
        });
      });
    });
  });
});
