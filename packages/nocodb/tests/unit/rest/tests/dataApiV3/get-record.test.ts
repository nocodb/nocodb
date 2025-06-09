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
import type { ITestContext } from './helpers';
import type { Column, Model } from '../../../../../src/models';
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
      urlPrefix = `/api/${API_VERSION}/data/${testContext.sakilaProject.id}`;

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
        const country = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records/1`,
        });

        expect(country.body.record.fields.Cities).to.equal(1);
      });

      it('Nested Read - Lookup', async function () {
        await createLookupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Lookup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
        });

        const country = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records/1`,
        });

        expect(country.body.record.fields.Lookup).to.deep.equal(['Kabul']);
      });

      it('Nested Read - Rollup', async function () {
        await createRollupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Rollup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
          rollupFunction: 'count',
        });

        const country = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records/1`,
        });

        expect(country.body.record.fields.Rollup).to.equal(1);
      });
    });

    describe('text-based', () => {
      let table: Model;
      let columns: Column[];
      let insertedRecords: any[];
      let textBasedUrlPrefix: string;

      beforeEach(async function () {
        const initResult = await beforeEachTextBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
        textBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });
      it('Read: all fields', async function () {
        const firstRow = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records/1`,
        });
        expect(firstRow.body.record.fields).to.contain.keys(['Country', 'Cities']);
      });

      it('Read: invalid ID', async function () {
        await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records/9999`,
          status: 404,
        });
      });
    });
  });
});
