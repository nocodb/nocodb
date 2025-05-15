/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { Column, Model } from '../../../../../src/models';
import type { ITestContext } from './beforeEach';
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
