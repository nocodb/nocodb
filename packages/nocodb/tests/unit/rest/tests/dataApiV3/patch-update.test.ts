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
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;

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
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              ...newRecord,
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }]);
      });

      it('Update: partial', async function () {
        const recordBeforeUpdate = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });

        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }]);

        const recordAfterUpdate = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });
        expect(recordAfterUpdate.body).to.deep.equal({
          ...recordBeforeUpdate.body,
          SingleLineText: 'some text',
          MultiLineText: 'some more text',
        });
      });

      it('Update: bulk', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
            {
              Id: 2,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);
      });

      it('Update: single with column id', async function () {
        const idMap = {
          Id: columns.find((col) => col.title === 'Id')?.id,
          SingleLineText: columns.find((col) => col.title === 'SingleLineText')
            ?.id,
          MultiLineText: columns.find((col) => col.title === 'MultiLineText')
            ?.id,
        };

        const updatePayload = {
          [idMap['Id']!]: 1,
          [idMap['SingleLineText']!]: 'SingleLineText',
          [idMap['MultiLineText']!]: 'MultiLineText',
        };
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatePayload,
        });
        expect(rsp.body).to.deep.equal({ Id: 1 });
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            where: '(Id,eq,1)',
          },
        });
        expect(
          rspGet.body.list.map((k) => k.SingleLineText).join(','),
        ).to.equal('SingleLineText');
      });

      it('Update: bulk with column id', async function () {
        const idMap = {
          Id: columns.find((col) => col.title === 'Id')?.id,
          SingleLineText: columns.find((col) => col.title === 'SingleLineText')
            ?.id,
          MultiLineText: columns.find((col) => col.title === 'MultiLineText')
            ?.id,
        };

        const createPayload = [
          {
            [idMap['Id']!]: 1,
            [idMap['SingleLineText']!]: 'SingleLineText',
            [idMap['MultiLineText']!]: 'MultiLineText',
          },
          {
            [idMap['Id']!]: 2,
            [idMap['SingleLineText']!]: 'SingleLineText2',
            [idMap['MultiLineText']!]: 'MultiLineText2',
          },
        ];
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: createPayload,
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            where: '(Id,gte,1)~and(Id,lte,2)',
          },
        });
        expect(
          rspGet.body.list.map((k) => k.SingleLineText).join(','),
        ).to.equal('SingleLineText,SingleLineText2');
      });

      // Error handling

      it('Update: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosPatch({
          url: `${urlPrefix}/123456789`,
          body: { Id: 100, SingleLineText: 'some text' },
          status: 422,
        });
        // Invalid row ID
        await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: { Id: 123456789, SingleLineText: 'some text' },
          status: 404,
        });
      });
    });
  });
});
