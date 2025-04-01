import { expect } from 'chai';
import {
  createLookupColumn,
  createRollupColumn,
} from '../../../factory/column';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type { Base, Model } from '../../../../../src/models';
import type init from '../../../init';
import type { INcAxios } from './ncAxios';

interface ListResult {
  list: any[];
  pageInfo?: {
    next?: string;
  };
}

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('get-list', () => {
    let testContext: {
      context: Awaited<ReturnType<typeof init>>;
      ctx: {
        workspace_id: any;
        base_id: any;
      };
      sakilaProject: Base;
      base: Base;
      countryTable: Model;
      cityTable: Model;
    };
    let testAxios: INcAxios;
    let urlPrefix: string;

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext.context);
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
    });

    describe('general-based', () => {
      it('get list country with limit 4 and next offset', async function () {
        const response = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 4,
          },
        });
        const result = response.body as ListResult;
        expect(result.list.length).to.eq(4);

        const nextResponse = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 4,
            page: 2,
          },
        });
        const nextResult = nextResponse.body as ListResult;
        expect(nextResult.list.length).to.eq(4);
        expect(nextResult.list.map((k) => k.CountryId).sort()).to.not.eq(
          result.list.map((k) => k.CountryId).sort(),
        );
      });

      it('get list country with name like Ind', async function () {
        const response = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            filter: '(Country,like,Ind)',
          },
        });
        const result = response.body as ListResult;
        expect(result.list.length).to.greaterThan(0);
        expect(
          result.list.some((k) => k.Country.toLowerCase().startsWith('ind')),
        ).to.eq(true);
      });

      it('Nested List - Link to another record', async function () {
        const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];
        const records = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.list.length).to.equal(expectedRecords.length);

        const cityList = records.body.list.map((r: any) => r['Cities']);
        expect(cityList).to.deep.equal(expectedRecords);
      });

      it('Nested List - Lookup', async function () {
        await createLookupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Lookup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
        });

        const expectedRecords = [
          ['Kabul'],
          ['Batna', 'Bchar', 'Skikda'],
          ['Tafuna'],
          ['Benguela', 'Namibe'],
          ['South Hill'],
          [
            'Almirante Brown',
            'Avellaneda',
            'Baha Blanca',
            'Crdoba',
            'Escobar',
            'Ezeiza',
            'La Plata',
            'Merlo',
            'Quilmes',
            'San Miguel de Tucumn',
            'Santa F',
            'Tandil',
            'Vicente Lpez',
          ],
          ['Yerevan'],
          ['Woodridge'],
          ['Graz', 'Linz', 'Salzburg'],
          ['Baku', 'Sumqayit'],
        ];

        // read first 10 records
        const records = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.list.length).to.equal(10);

        // extract Lookup column
        const lookupData = records.body.list.map(
          (record: any) => record['Lookup'],
        );
        expect(lookupData).to.deep.equal(expectedRecords);
      });

      it('Nested List - Rollup', async function () {
        await createRollupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Rollup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
          rollupFunction: 'count',
        });

        const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];
        const records = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.list.length).to.equal(expectedRecords.length);
        const rollupData = records.body.list.map(
          (record: any) => record['Rollup'],
        );

        expect(rollupData).to.deep.equal(expectedRecords);
      });
    });
  });
});
