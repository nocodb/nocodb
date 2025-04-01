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
  describe('post-insert', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext.context);
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
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

      it('Create: all fields', async function () {
        const rsp = await testAxios.ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });

        expect(rsp.body).to.deep.equal({ Id: 401 });
      });

      it('Create: few fields left out', async function () {
        const newRecord = {
          SingleLineText: 'abc',
          MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
        };
        const rsp = await testAxios.ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });

        // fields left out should be null
        expect(rsp.body).to.deep.equal({ Id: 401 });
      });

      it('Create: bulk', async function () {
        const rsp = await testAxios.ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: [newRecord, newRecord, newRecord],
        });
        expect(rsp.body.sort((a, b) => a.Id - b.Id)).to.deep.equal([
          { Id: 401 },
          { Id: 402 },
          { Id: 403 },
        ]);
      });

      // Error handling
      it('Create: invalid ID', async function () {
        // Invalid table ID
        await testAxios.ncAxiosPost({
          url: `${urlPrefix}/123456789`,
          status: 404,
        });

        // Invalid data - create should not specify ID
        await testAxios.ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: { ...newRecord, Id: 300 },
          status: 400,
        });
        // Invalid data - number instead of string
        // await ncAxiosPost({
        //   body: { ...newRecord, SingleLineText: 300 },
        //   status: 400,
        // });
      });
    });
  });
});
