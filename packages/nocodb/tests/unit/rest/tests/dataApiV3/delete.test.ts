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
  describe('delete', () => {
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

      it('Delete: single', async function () {
        const rsp = await testAxios.ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: [{ Id: 1 }],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }]);

        // check that it's gone
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          status: 404,
        });
      });

      it('Delete: bulk', async function () {
        const rsp = await testAxios.ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: [{ Id: 1 }, { Id: 2 }],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);

        // check that it's gone
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          status: 404,
        });
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/2`,
          status: 404,
        });
      });

      // Error handling

      it('Delete: invalid ID', async function () {
        // Invalid table ID
        await testAxios.ncAxiosDelete({
          url: `${urlPrefix}/123456789`,
          body: { Id: 100 },
          status: 404,
        });
        // Invalid row ID
        await testAxios.ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: { Id: '123456789' },
          status: 404,
        });
      });
    });
  });
});
