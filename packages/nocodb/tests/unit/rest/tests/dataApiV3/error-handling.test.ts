/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from './beforeEach';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';
describe('dataApiV3', () => {
  describe('error-handling', () => {
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
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    // we revert to default limit if provided limit is outside of allowed range
    it.skip('Invalid Page Size', async () => {
      let response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 0,
        },
        status: 400,
      });
      response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 1000,
        },
        status: 400,
      });
    });

    it('tableId not found', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/123456789`,
        status: 404,
      });
    });
    it('baseId not found', async () => {
      await ncAxiosGet({
        url: `/api/v3/123456789/123456789`,
        status: 404,
      });
    });
    it('invalid api version', async () => {
      await ncAxiosGet({
        url: `/api/v4/${testContext.base.id}/${testContext.countryTable.id}`,
        status: 404,
      });
    });
    it('invalid view param', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}?viewId=123456890`,
        status: 404,
      });
    });
    it('invalid page', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          page: 500,
        },
        status: 422,
      });
    });
    it('invalid sort field', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          sort: 'NotFoundField',
        },
        status: 404,
      });
    });
    // skip, our sort direction is either {field} (asc) or -{field} (desc) so no validation required
    it.skip('invalid sort direction', async () => {});

    it('invalid filter field', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          where: '(NotFoundField,eq,1)',
        },
        status: 422,
      });
    });

    it('invalid select field', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          fields: ['Country', 'NotFoundField'],
        },
        status: 404,
      });
    });
    // our api can accept array or not array
    it.skip('field parameter malformed', async () => {
      await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          fields: 'Country',
        },
        status: 404,
      });
    });
  });
});
