/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  createLookupColumn,
  createRollupColumn,
} from '../../../factory/column';
import { initTblCountry } from '../../../init/initTblCountry';
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
    let countryTable: Model;
    let cityTable: Model;

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
      const tables = await initTblCountry(
        testContext.context,
        testContext.base,
      );
      countryTable = tables.countryTable;
      cityTable = tables.cityTable;
    });

    describe('general-based', () => {
      it('Nested Read - Link to another record', async function () {
        const country = await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/2`,
        });

        expect(country.body.fields.Cities).to.equal(2);
      });

      it('Nested Read - Lookup', async function () {
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'Lookup',
          table: countryTable,
          relatedTableName: cityTable.table_name,
          relatedTableColumnTitle: 'City',
        });

        const country = await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/2`,
        });

        expect(country.body.fields.Lookup).to.deep.equal(['Batna', 'Bchar']);
      });

      it('Nested Read - Rollup', async function () {
        await createRollupColumn(testContext.context, {
          base: testContext.base,
          title: 'Rollup',
          table: countryTable,
          relatedTableName: cityTable.table_name,
          relatedTableColumnTitle: 'City',
          rollupFunction: 'count',
        });

        const country = await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/2`,
        });

        expect(country.body.fields.Rollup).to.equal(2);
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
          url: `${urlPrefix}/${countryTable.id}/records/1`,
        });
        expect(firstRow.body.fields).to.contain.keys(['Country', 'Cities']);
      });

      it('Read: specific field without primary key', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/1`,
          query: {
            fields: 'Country',
          },
        });

        // Verify that only the requested field is present in fields
        expect(response.body.fields).to.have.property('Country');
        expect(Object.keys(response.body.fields)).to.have.length(1);

        // Note: In V3 API, id is always included in response for now
        // This may be changed in future to only include id when primary key is in fields
        expect(response.body).to.have.property('id');
      });

      it('Read: specific field with primary key', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/1`,
          query: {
            fields: ['id', 'Country'],
          },
        });

        // Verify that the requested fields are present
        expect(response.body.fields).to.have.property('Country');
        // CountryId might not be included in fields when it's the primary key
        expect(Object.keys(response.body.fields)).to.include('Country');

        // Verify that id IS included when primary key is in fields
        expect(response.body).to.have.property('id');
      });

      it('Read: invalid ID', async function () {
        await ncAxiosGet({
          url: `${urlPrefix}/${countryTable.id}/records/9999`,
          status: 404,
        });
      });
    });
  });
});
