/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
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
      const response = await ncAxiosGet({
        url: `${urlPrefix}/123456789`,
        status: 404,
      });
      expect(response.body.message).to.eq(`Table '123456789' not found`);
    });
    it('baseId not found', async () => {
      // TODO: fix base not found error message
      const response = await ncAxiosGet({
        url: `/api/v3/234567890/123456789`,
        status: 404,
      });
      expect(response.body.message).to.eq(`Table '123456789' not found`);
    });
    it('invalid api version', async () => {
      // TODO: somehow it's body.msg than body.message
      const response = await ncAxiosGet({
        url: `/api/v4/1234567890/2134567890`,
        status: 404,
      });
      /*
      {
        "msg": "Cannot GET /api/v4/pnzomgow3a1cfm2/mrp2x452lfu131q",
        "path": "/api/v4/pnzomgow3a1cfm2/mrp2x452lfu131q"
      }
       */
      expect(response.body.msg).to.eq(
        `Cannot GET /api/v4/1234567890/2134567890`,
      );
    });
    it('invalid view param', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}?viewId=123456890`,
        status: 404,
      });
      expect(response.body.message).to.eq(`View '123456890' not found`);
    });
    it('invalid page', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          page: 500,
        },
        status: 422,
      });
      expect(response.body.message).to.eq(`Offset value '12475' is invalid`);
    });
    it('invalid sort field', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          sort: 'NotFoundField',
        },
        status: 404,
      });
      expect(response.body.message).to.eq(`Field 'NotFoundField' not found`);
    });
    // skip, our sort direction is either {field} (asc) or -{field} (desc) so no validation required
    it.skip('invalid sort direction', async () => {});

    it('invalid filter field (column not found)', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          where: '(NotFoundField,eq,1)',
        },
        status: 422,
      });
      expect(response.body.message).to.eq(
        `INVALID_FILTER column 'NotFoundField' not found`,
      );
    });

    it('invalid filter field (invalid parsing)', async () => {
      // TODO: body change msg to message
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          where: '(NotFoundField,eq',
        },
        status: 422,
      });
      expect(response.body.message).to.eq(
        `INVALID_FILTER parsing_error: Expecting token of type --> PAREN_END <-- but found --> '' <--`,
      );
    });

    it('invalid select field', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          fields: ['Country', 'NotFoundField'],
        },
        status: 422,
      });
      expect(response.body.message).to.eq(`Field 'NotFoundField' not found`);
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
