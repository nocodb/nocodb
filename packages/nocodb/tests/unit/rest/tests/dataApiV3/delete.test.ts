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
  describe('delete', () => {
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

      it('Delete: single', async function () {
        const rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: { id: 1 },
        });
        expect(rsp.body).to.deep.equal({ records: [{ id: 1, deleted: true }] });

        // check that it's gone
        await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/1`,
          status: 404,
        });
      });

      it('Delete: bulk', async function () {
        const rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: [{ id: 1 }, { id: 2 }],
        });
        expect(rsp.body).to.deep.equal({
          records: [
            { id: 1, deleted: true },
            { id: 2, deleted: true },
          ],
        });

        // check that it's gone
        await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/1`,
          status: 404,
        });
        await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/2`,
          status: 404,
        });
      });

      // Error handling

      it('Delete: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosDelete({
          url: `${urlPrefix}/123456789/records`,
          body: { id: 100 },
          status: 422,
        });
        // Invalid row ID
        await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: { id: '123456789' },
          status: 404,
        });
      });
    });
  });
});
