/* eslint-disable @typescript-eslint/no-unused-vars */
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
  describe('get-record', () => {
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
      it('Read: all fields', async function () {
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/100`,
        });
      });

      it('Read: invalid ID', async function () {
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/123456789/100`,
          status: 404,
        });

        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1000`,
          status: 404,
        });
      });
    });
  });
});
