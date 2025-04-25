/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import request from 'supertest';
import { createBulkRows } from '../../../factory/row';
import { createTable, getTable } from '../../../factory/table';
import { createUser } from '../../../factory/user';
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
      urlPrefix = `/api/${API_VERSION}/${testContext.sakilaProject.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    it('token header not exists', async () => {
      const response = await request(testContext.context.app)
        .get(`${urlPrefix}/${testContext.countryTable.id}`)
        .send({});
      expect(response.status).to.equal(401);
      expect(response.body.error).to.equal('AUTHENTICATION_REQUIRED');
      expect(response.body.message).to.equal(
        'Authentication required - Invalid token',
      );
    });
    it('token invalid', async () => {
      const response = await request(testContext.context.app)
        .get(`${urlPrefix}/${testContext.countryTable.id}`)
        .set('xc-token', 'invalid token')
        .send({});
      expect(response.status).to.equal(401);
      expect(response.body.error).to.equal('AUTHENTICATION_REQUIRED');
      expect(response.body.message).to.equal(
        'Authentication required - Invalid token',
      );
    });
    it('token has no permission', async () => {
      const newUser = await createUser(
        { app: testContext.context.app },
        { roles: 'editor', email: 'notpermitteduser@example.com' },
      );
      const { token: newUserToken } = newUser;

      const notPermittedXcToken = (
        await request(testContext.context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', newUserToken)
          .expect(200)
      ).body.token;

      const response = await request(testContext.context.app)
        .get(`${urlPrefix}/${testContext.countryTable.id}`)
        .set('xc-token', notPermittedXcToken)
        .send({});
      expect(response.status).to.equal(403);
      expect(response.body.error).to.equal('FORBIDDEN');
      expect(response.body.message).to.equal('Forbidden - Unauthorized access');
    });

    // we revert to default limit if provided limit is outside of allowed range
    // or incorrect format
    it.skip('Invalid Page Size', async () => {
      let response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 0,
        },
      });
      console.log(response.status)
      response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 1000,
        },
      });
      console.log(response.status)
      response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: -1,
        },
      });
      console.log(response.status)
      response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          limit: 'Hello',
        },
      });
      console.log(response.status)
    });

    it('tableId not found', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/123456789`,
        status: 422,
      });
      expect(response.body.error).to.eq('TABLE_NOT_FOUND');
      expect(response.body.message).to.eq(`Table '123456789' not found`);
    });
    it('baseId not found', async () => {
      const response = await ncAxiosGet({
        url: `/api/v3/234567890/123456789`,
        status: 422,
      });
      expect(response.body.error).to.equal('BASE_NOT_FOUND');
      expect(response.body.message).to.eq(`Base '234567890' not found`);
    });
    it('invalid api version', async () => {
      const response = await ncAxiosGet({
        url: `/api/v4/1234567890/2134567890`,
        status: 404,
      });
      expect(response.body.error).to.eq(`INVALID_API_VERSION`);
      expect(response.body.message).to.eq(
        `Cannot GET /api/v4/1234567890/2134567890`,
      );
    });
    it('backward compatibility for previous api version', async () => {
      const response = await ncAxiosGet({
        url: `/api/v1/abcasdasda`,
        status: 404,
      });
      expect(response.body.msg).to.eq(`Cannot GET /api/v1/abcasdasda`);
      const responsev2 = await ncAxiosGet({
        url: `/api/v2/abcasdasda`,
        status: 404,
      });
      expect(responsev2.body.msg).to.eq(`Cannot GET /api/v2/abcasdasda`);
    });
    it('invalid view param', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}?viewId=123456890`,
        status: 422,
      });
      expect(response.body.error).to.eq(`VIEW_NOT_FOUND`);
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
    it('invalid page (minus)', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          page: -1,
        },
        status: 422,
      });
      expect(response.body.message).to.eq(
        `Offset must be a non-negative integer.`,
      );
    });
    it('invalid page (string)', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          page: 'hello',
        },
        status: 422,
      });
      expect(response.body.message).to.eq(
        `Offset must be a non-negative integer.`,
      );
    });
    it('invalid sort field', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          sort: 'NotFoundField',
        },
        status: 422,
      });
      expect(response.body.error).to.eq('FIELD_NOT_FOUND');
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

    it('invalid filter (invalid parsing)', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}`,
        query: {
          where: '(NotFoundField,eq',
        },
        status: 422,
      });
      expect(response.body.message).to.eq(
        `Invalid filter syntax: expected a closing parentheses ')', but found ''.`,
      );
    });

    it('invalid filter value format', async () => {
      const paymentTable = await getTable({
        base: testContext.sakilaProject,
        name: 'payment',
      });
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${paymentTable.id}`,
        query: {
          where: '(Amount,eq,HELLO)',
        },
        status: 422,
      });
      expect(response.body.error).to.eq(`INVALID_FILTER`);
      expect(response.body.message).to.eq(
        `Invalid filter expression: Value HELLO is not supported for type Decimal on column Amount`,
      );
    });

    it('invalid filter operator', async () => {
      const paymentTable = await getTable({
        base: testContext.sakilaProject,
        name: 'payment',
      });
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${paymentTable.id}`,
        query: {
          where: '(Amount,notInOperator,HELLO)',
        },
        status: 422,
      });
      expect(response.body.error).to.eq(`INVALID_FILTER`);
      expect(response.body.message).to.eq(
        `Invalid filter expression: 'notInOperator' is not a recognized operator. Please use a valid comparison or logical operator.`,
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

    it('record id not found', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}/1032`,
        status: 404,
      });
      expect(response.body.message).to.eq("Record '1032' not found");
    });

    it('primary key not in correct data type (CountryId = number)', async () => {
      const response = await ncAxiosGet({
        url: `${urlPrefix}/${testContext.countryTable.id}/text-primary-key`,
        status: 422,
      });
      expect(response.body.error).to.eq('INVALID_PK_VALUE');
      expect(response.body.message).to.eq(
        `Primary key value 'text-primary-key' is invalid for column 'CountryId'`,
      );
    });

    it('primary key not in correct data type (Id)', async () => {
      const table = await createTable(testContext.context, testContext.base, {
        table_name: 'testTable',
        title: 'TestTable',
        columns: [
          {
            column_name: 'id',
            title: 'Id',
            uidt: UITypes.ID,
            pk: true,
          },
          {
            column_name: 'text',
            title: 'Text',
            uidt: UITypes.SingleLineText,
            pk: false,
            pv: true,
          },
        ],
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table,
        values: [
          {
            Id: 1,
            SingleLineText: 'A',
          },
        ],
      });

      const response = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/text-primary-key`,
        status: 422,
      });
      expect(response.body.error).to.eq('INVALID_PK_VALUE');
      expect(response.body.message).to.eq(
        `Primary key value 'text-primary-key' is invalid for column 'Id'`,
      );
    });

    it('url path not found', async () => {
      const response = await ncAxiosGet({
        url: `/api/v3/mybase/mytable/unknown-path/1234`,
        status: 404,
      });
      expect(response.body.error).to.eq('NOT_FOUND');
      expect(response.body.message).to.eq(
        'Cannot GET /api/v3/mybase/mytable/unknown-path/1234',
      );
    });
  });
});
