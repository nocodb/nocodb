/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  createLookupColumn,
  createRollupColumn,
} from '../../../factory/column';
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
      urlPrefix = `/api/${API_VERSION}/${testContext.sakilaProject.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    describe('general-based', () => {
      it('Nested Read - Link to another record', async function () {
        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/1`,
        });
        expect(+records.body['Cities']).to.equal(1);
      });

      it('Nested Read - Lookup', async () => {
        await createLookupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Lookup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
        });

        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/1`,
        });
        expect(records.body.Lookup).to.deep.equal(['Kabul']);
      });

      it('Nested Read - Rollup', async () => {
        await createRollupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Rollup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
          rollupFunction: 'count',
        });

        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/1`,
        });
        expect(records.body.Rollup).to.equal(1);
      });
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
        await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/100`,
        });
      });

      it('Read: invalid ID', async function () {
        await ncAxiosGet({
          url: `${urlPrefix}/123456789/100`,
          status: 422,
        });

        await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1000`,
          status: 404,
        });
      });
    });
  });
});
