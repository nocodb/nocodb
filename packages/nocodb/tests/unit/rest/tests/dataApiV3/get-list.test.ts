import { expect } from 'chai';
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
  });
});
