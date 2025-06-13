/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import request from 'supertest';
import { createBulkRows } from '../../../factory/row';
import { createTable, getTable } from '../../../factory/table';
import { createUser } from '../../../factory/user';
import { isPg } from '../../../init/db';
import { customColumns } from '../../../factory/column';
import {
  beforeEachAttachment,
  beforeEachCheckbox,
  beforeEachDateBased,
  beforeEachJSON,
  beforeEachNumberBased,
  beforeEachSelectBased,
  beforeEachTextBased,
  beforeEachUserBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import { getUsers } from './helpers';
import type { ITestContext } from './helpers';
import type { Column, Model } from '../../../../../src/models';
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
      urlPrefix = `/api/${API_VERSION}/data/${testContext.sakilaProject.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    describe('general', () => {
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
        expect(response.body.message).to.equal(
          'Forbidden - Unauthorized access',
        );
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
        console.log(response.status);
        response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 1000,
          },
        });
        console.log(response.status);
        response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: -1,
          },
        });
        console.log(response.status);
        response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            limit: 'Hello',
          },
        });
        console.log(response.status);
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
      // TODO: reenable after fix/not-found-module
      it.skip('invalid api version', async () => {
        const response = await ncAxiosGet({
          url: `/api/v4/1234567890/2134567890`,
          status: 404,
        });
        expect(response.body.error).to.eq(`INVALID_API_VERSION`);
        expect(response.body.message).to.eq(`API version unsupported`);
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
          `Offset must be a non-negative integer`,
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
          `Offset must be a non-negative integer`,
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
          `Invalid filter field 'NotFoundField' not found`,
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
          `Invalid filter syntax: expected a closing parentheses ')', but found ''`,
        );
      });

      it('invalid filter (missing comma)', async () => {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}`,
          query: {
            where: '(NotFoundField',
          },
          status: 422,
        });
        expect(response.body.message).to.eq(
          `Invalid filter syntax: expected comma ',' followed with operator (and value) after field`,
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
          `Invalid filter expression: 'notInOperator' is not a recognized operator. Please use a valid comparison or logical operator`,
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
        const table = await createTable(
          testContext.context,
          testContext.sakilaProject,
          {
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
          },
        );
        await createBulkRows(testContext.context, {
          base: testContext.sakilaProject,
          table,
          values: [
            {
              Id: 1,
              SingleLineText: 'A',
            },
          ],
        });

        const response = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/text-primary-key`,
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_PK_VALUE');
        expect(response.body.message).to.eq(
          `Primary key value 'text-primary-key' is invalid for column 'Id'`,
        );
      });

      // TODO: reenable after fix/not-found-module
      it.skip('url path not found', async () => {
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

    describe('text-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let expectedColumns: Column[] = [];
      let insertedRecords: any[];
      let textBasedUrlPrefix: string;

      beforeEach(async function () {
        const initResult = await beforeEachTextBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        expectedColumns = [
          // if we want to include created at & updated at as default
          { column_name: 'CreatedAt', title: 'CreatedAt' } as any,
          { column_name: 'UpdatedAt', title: 'UpdatedAt' } as any,
          ...columns,
        ];
        insertedRecords = initResult.insertedRecords;
        textBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it(`will handle update length exceed 100k`, async () => {
        const base50 = '01234567890123456789012345678901234567890123456789';
        // Generate ~100001-character string by repeating the above 40 times and adding '1'
        const content100k1Length =
          Array.from(
            { length: 500 },
            () => base50 + base50 + base50 + base50,
          ).join('') + '1'; // 500 * 200 + 1 = 100001

        const response = await ncAxiosPatch({
          url: `${textBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: content100k1Length,
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(response.body.message).to.eq(
          `Value length '100001' is exceeding allowed limit '100000' for type 'SingleLineText' on column 'SingleLineText'`,
        );
      });

      it(`will handle update record not found`, async () => {
        const response = await ncAxiosPatch({
          url: `${textBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: 'Hello',
            },
            {
              Id: 998091,
              SingleLineText: 'Hello',
            },
          ],
          status: 404,
        });
        expect(response.body.error).to.eq('RECORD_NOT_FOUND');
        expect(response.body.message).to.eq(`Record '998091' not found`);
      });

      it(`will handle delete record not found`, async () => {
        const response = await ncAxiosDelete({
          url: `${textBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
            },
            {
              Id: 998091,
            },
          ],
          status: 404,
        });
        expect(response.body.error).to.eq('RECORD_NOT_FOUND');
        expect(response.body.message).to.eq(`Record '998091' not found`);
      });
      it(`will handle delete id format invalid`, async () => {
        const response = await ncAxiosDelete({
          url: `${textBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 'text-primary-key',
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_PK_VALUE');
        expect(response.body.message).to.eq(
          `Primary key value 'text-primary-key' is invalid for column 'Id'`,
        );
      });
      it(`will handle email wrong format`, async () => {
        const response = await ncAxiosPost({
          url: `${textBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Email: '++notanemail321',
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(response.body.message).to.eq(
          `Invalid value '++notanemail321' for type 'Email' on column 'Email'`,
        );
      });
    });

    describe('number-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let expectedColumns: Column[] = [];
      let insertedRecords: any[];
      let numberBasedUrlPrefix: string;

      beforeEach(async function () {
        const initResult = await beforeEachNumberBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        expectedColumns = [
          // if we want to include created at & updated at as default
          { column_name: 'CreatedAt', title: 'CreatedAt' } as any,
          { column_name: 'UpdatedAt', title: 'UpdatedAt' } as any,
          ...columns,
        ];
        insertedRecords = initResult.insertedRecords;
        numberBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it(`will handle insert and update zero record`, async () => {
        let response = await ncAxiosPost({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [],
          status: 200,
        });
        response = await ncAxiosPatch({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [],
          status: 200,
        });
      });
      it(`will handle insert field format not valid`, async () => {
        if (!isPg(testContext.context)) {
          return;
        }
        const response = await ncAxiosPost({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Number: 'HELLOW',
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(
          response.body.message.startsWith(`Invalid value 'HELLOW' for type `),
        ).to.eq(true);
      });
      it(`will handle insert field format not valid for uidt Rating`, async () => {
        const values = ['HELLOW', -1, 9999];
        for (const value of values) {
          const response = await ncAxiosPost({
            url: `${numberBasedUrlPrefix}/${table.id}`,
            body: {
              Rating: value,
            },
            status: 422,
          });
          expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
          expect(
            response.body.message.startsWith(
              `Invalid value '${value}' for type `,
            ),
          ).to.eq(true);
        }
      });
      it(`will handle insert field format not valid for uidt Rating and above max`, async () => {
        if (!isPg(testContext.context)) {
          return;
        }
        const response = await ncAxiosPost({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Rating: 99,
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(
          response.body.message.startsWith(`Invalid value '99' for type `),
        ).to.eq(true);
      });
      it(`will handle insert field format not valid for uidt Year`, async () => {
        if (!isPg(testContext.context)) {
          return;
        }
        for (const year of [99, 19999, 'HELLOW', 19.778, -123]) {
          const response = await ncAxiosPost({
            url: `${numberBasedUrlPrefix}/${table.id}`,
            body: [
              {
                Year: year,
              },
            ],
            status: 422,
          });
          expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
          expect(
            response.body.message.startsWith(
              `Invalid value '${year}' for type `,
            ),
          ).to.eq(true);
        }
      });

      it('will handle insert field format not valid for uidt Duration', async () => {
        const values = ['HELLOW', -1, 1.365];
        for (const value of values) {
          const response = await ncAxiosPost({
            url: `${numberBasedUrlPrefix}/${table.id}`,
            body: {
              Duration: value,
            },
            status: 422,
          });
          expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
          expect(
            response.body.message.startsWith(
              `Invalid value '${value}' for type `,
            ),
          ).to.eq(true);
        }
      });

      it(`will handle insert field more than 10 rows`, async () => {
        const insertObj = [
          {
            Number: 1,
          },
        ];
        for (let i = 2; i < 30; i++) {
          insertObj.push({
            Number: i,
          });
        }
        const response = await ncAxiosPost({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: insertObj,
          status: 422,
        });
        expect(response.body.error).to.eq('MAX_INSERT_LIMIT_EXCEEDED');
        expect(response.body.message).to.eq(`Maximum 10 records during insert`);
      });
      it(`will handle update field format not valid`, async () => {
        if (!isPg(testContext.context)) {
          return;
        }
        const response = await ncAxiosPatch({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              Number: 'HELLOW',
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(
          response.body.message.startsWith(`Invalid value 'HELLOW' for type `),
        ).to.eq(true);
      });
      it(`will handle update field id format not valid`, async () => {
        const response = await ncAxiosPatch({
          url: `${numberBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Id: 'HELLOW',
              Number: 1,
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_PK_VALUE');
        expect(response.body.message).to.eq(
          `Primary key value 'HELLOW' is invalid for column 'Id'`,
        );
      });
    });

    describe('date-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let insertedRecords: any[];
      let dateBasedUrlPrefix: string;

      beforeEach(async function () {
        const initResult = await beforeEachDateBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
        dateBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it(`will handle insert field format not valid`, async () => {
        if (!isPg(testContext.context)) {
          return;
        }
        const response = await ncAxiosPost({
          url: `${dateBasedUrlPrefix}/${table.id}`,
          body: [
            {
              Date: 'HELLOW',
            },
          ],
          status: 422,
        });
        expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
        expect(
          response.body.message.startsWith(`Invalid value 'HELLOW' for type `),
        ).to.eq(true);
      });
    });

    describe('select-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let insertedRecords: any[];
      let selectBasedUrlPrefix: string;

      beforeEach(async function () {
        const initResult = await beforeEachSelectBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
        selectBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it('insert with value outside of options', async () => {
        const rspSingle = await ncAxiosPost({
          url: `${selectBasedUrlPrefix}/${table.id}`,
          body: [
            {
              SingleSelect: 'jan2',
            },
          ],
          status: 422,
        });
        const rspMulti = await ncAxiosPost({
          url: `${selectBasedUrlPrefix}/${table.id}`,
          body: [
            {
              MultiSelect: 'jan2,feb,mar2',
            },
          ],
          status: 422,
        });
        expect(rspSingle.body.error).to.equal('INVALID_VALUE_FOR_FIELD');
        expect(rspMulti.body.error).to.equal('INVALID_VALUE_FOR_FIELD');
        expect(rspSingle.body.message).to.equal(
          'Invalid option(s) "jan2" provided for column "SingleSelect"',
        );
        expect(rspMulti.body.message).to.equal(
          'Invalid option(s) "jan2, mar2" provided for column "MultiSelect"',
        );
      });
    });

    describe('checkbox', () => {
      let table: Model;
      let columns: Column[] = [];

      beforeEach(async function () {
        const initResult = await beforeEachCheckbox(testContext);
        table = initResult.table;
        columns = initResult.columns;
        urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it(`will handle insert field format not valid`, async () => {
        const insertCases = [
          [
            {
              Checkbox: 'anythingelse',
            },
          ],
          [
            {
              Checkbox: 'true',
            },
            {
              Checkbox: 'anythingelse',
            },
          ],
        ];
        for (const insertCase of insertCases) {
          const response = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}`,
            body: insertCase,
            status: 422,
          });
          expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
          expect(
            response.body.message.startsWith(
              `Invalid value 'anythingelse' for type `,
            ),
          ).to.eq(true);
        }
      });
    });

    describe('json', () => {
      let table: Model;
      let columns: Column[] = [];

      beforeEach(async function () {
        const initResult = await beforeEachJSON(testContext);
        table = initResult.table;
        columns = initResult.columns;
        urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it(`will handle insert field format not valid`, async () => {
        const insertCases = [
          [
            {
              JSON: 'anythingelse',
            },
          ],
          [
            {
              JSON: '{}',
            },
            {
              JSON: 'anythingelse',
            },
          ],
        ];
        for (const insertCase of insertCases) {
          const response = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}`,
            body: insertCase,
            status: 422,
          });
          expect(response.body.error).to.eq('INVALID_VALUE_FOR_FIELD');
          expect(
            response.body.message.startsWith(
              `Invalid value 'anythingelse' for type `,
            ),
          ).to.eq(true);
        }
      });
    });

    describe('user-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let userBasedUrlPrefix: string = '';

      beforeEach(async () => {
        const initResult = await beforeEachUserBased(testContext);

        userBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
        table = initResult.table;
        columns = initResult.columns;
      });

      it('Create record : duplicate ID', async function () {
        const userList = await getUsers(testContext);

        const newRecord1 = {
          userFieldSingle: userList[0].id,
          userFieldMulti: `${userList[0].id},${userList[0].id}`,
        };
        const rsp = await ncAxiosPost({
          url: `${userBasedUrlPrefix}/${table.id}`,
          body: newRecord1,
          status: 422,
        });
        expect(
          rsp.body.message.startsWith(
            `Invalid value '${userList[0].id},${userList[0].id}' for type `,
          ),
        ).to.equal(true);

        const newRecord2 = {
          userFieldSingle: `${userList[0].id},${userList[1].id}`,
          userFieldMulti: `${userList[0].id},${userList[1].id}`,
        };
        const rsp2 = await ncAxiosPost({
          url: `${userBasedUrlPrefix}/${table.id}`,
          body: newRecord2,
          status: 422,
        });
        expect(
          rsp2.body.message.startsWith(
            `Invalid value '${userList[0].id},${userList[1].id}' for type `,
          ),
        ).to.equal(true);
      });

      it('Create record : ID not exists', async function () {
        const newRecord1 = {
          userFieldSingle: 'afcdef',
        };
        const rsp = await ncAxiosPost({
          url: `${userBasedUrlPrefix}/${table.id}`,
          body: newRecord1,
          status: 422,
        });
        console.log(rsp.body.message);
        expect(
          rsp.body.message.startsWith(`Invalid value 'afcdef' for type `),
        ).to.equal(true);
      });
    });

    describe.skip('attachment', () => {
      let table: Model;
      const columns: Column[] = [];

      beforeEach(async function () {
        const initResult = await beforeEachAttachment(testContext);
        urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });
    });
  });
});
