import { expect } from 'chai';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type { Base, Model } from '../../../../../src/models';
import type init from '../../../init';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';
describe('dataApiV3', () => {
  describe('error-handling', () => {
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

    it('Invalid Page Size', async function () {
      const response = await testAxios.ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 0,
        },
      });
    });
  });
});
