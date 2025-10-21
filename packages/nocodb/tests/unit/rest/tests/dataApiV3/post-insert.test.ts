/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { checkboxTypeMap, type ColumnType } from 'nocodb-sdk';
import {
  beforeEachAttachment,
  beforeEachCheckbox,
  beforeEachLinkBased,
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
  describe('post-insert', () => {
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
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
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

      const newRecord = {
        fields: {
          SingleLineText: 'abc',
          MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
          Email: 'a@b.com',
          Url: 'https://www.abc.com',
          Phone: '1-234-567-8910',
        },
      };

      it('Create: all fields', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: newRecord,
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[0]).to.have.property('fields');
      });

      it('Create: few fields left out', async function () {
        const newRecord = {
          fields: {
            SingleLineText: 'abc',
            MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
          },
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: newRecord,
        });

        // fields left out should be null
        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[0]).to.have.property('fields');
      });

      it('Create: bulk', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: [newRecord, newRecord, newRecord],
        });
        expect(rsp.body.records).to.have.length(3);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[1]).to.have.property('id', 402);
        expect(rsp.body.records[2]).to.have.property('id', 403);
        rsp.body.records.forEach((record) => {
          expect(record).to.have.property('fields');
        });
      });

      // Error handling
      it('Create: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosPost({
          url: `${urlPrefix}/123456789/records`,
          status: 422,
        });

        // Invalid data - number instead of string
        // await ncAxiosPost({
        //   body: { ...newRecord, SingleLineText: 300 },
        //   status: 400,
        // });
      });

      it('Create: single with column id', async function () {
        const idMap = {
          SingleLineText: columns.find((col) => col.title === 'SingleLineText')
            ?.id,
          MultiLineText: columns.find((col) => col.title === 'MultiLineText')
            ?.id,
        };

        const createPayload = {
          fields: {
            [idMap['SingleLineText']!]: 'SingleLineText',
            [idMap['MultiLineText']!]: 'MultiLineText',
          },
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: createPayload,
        });
        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[0]).to.have.property('fields');
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            where: '(Id,gte,401)',
          },
        });
        expect(
          rspGet.body.records.map((k) => k.fields.SingleLineText).join(','),
        ).to.equal('SingleLineText');
      });

      it('Create: bulk with column id', async function () {
        const idMap = {
          SingleLineText: columns.find((col) => col.title === 'SingleLineText')
            ?.id,
          MultiLineText: columns.find((col) => col.title === 'MultiLineText')
            ?.id,
        };

        const createPayload = [
          {
            fields: {
              [idMap['SingleLineText']!]: 'SingleLineText',
              [idMap['MultiLineText']!]: 'MultiLineText',
            },
          },
          {
            fields: {
              [idMap['SingleLineText']!]: 'SingleLineText2',
              [idMap['MultiLineText']!]: 'MultiLineText2',
            },
          },
        ];
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: createPayload,
        });
        expect(rsp.body.records).to.have.length(2);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[1]).to.have.property('id', 402);
        rsp.body.records.forEach((record) => {
          expect(record).to.have.property('fields');
        });
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            where: '(Id,gte,401)',
          },
        });
        expect(
          rspGet.body.records.map((k) => k.fields.SingleLineText).join(','),
        ).to.equal('SingleLineText,SingleLineText2');
      });
    });

    describe('link-insert', function () {
      let tblCity: Model;
      let tblCountry: Model;
      let tblActor: Model;
      let tblFilm: Model;

      let columnsFilm: ColumnType[];
      let columnsActor: ColumnType[];
      let columnsCountry: ColumnType[];
      let columnsCity: ColumnType[];

      beforeEach(async function () {
        const initResult = await beforeEachLinkBased(testContext, true);
        tblCity = initResult.tblCity;
        tblCountry = initResult.tblCountry;
        tblActor = initResult.tblActor;
        tblFilm = initResult.tblFilm;
        columnsFilm = initResult.columnsFilm;
        columnsActor = initResult.columnsActor;
        columnsCountry = initResult.columnsCountry;
        columnsCity = initResult.columnsCity;
      });

      it('POST insert', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            {
              fields: {
                Cities: [{ id: 1 }],
              },
            },
          ],
        });
        expect(rsp.body.records.length).to.greaterThan(0);
        const getRsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/${rsp.body.records[0].id}`,
        });

        expect(getRsp.body.fields.Cities.length).to.greaterThan(0);
      });
    });

    describe('user-based', () => {
      let table: Model;
      let columns: Column[] = [];

      beforeEach(async () => {
        const initResult = await beforeEachUserBased(testContext);

        table = initResult.table;
        columns = initResult.columns;
        urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      });

      it('Create record : using email', async function () {
        const newRecord = {
          fields: {
            userFieldSingle: 'a@nocodb.com',
            userFieldMulti: 'a@nocodb.com,b@nocodb.com',
          },
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: newRecord,
        });
        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[0]).to.have.property('fields');

        const record = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/401`,
        });
        expect(record.body.id).to.equal(401);
        expect(record.body.fields.userFieldSingle[0].email).to.equal(
          'a@nocodb.com',
        );
        expect(record.body.fields.userFieldMulti[0].email).to.equal(
          'a@nocodb.com',
        );
        expect(record.body.fields.userFieldMulti[1].email).to.equal(
          'b@nocodb.com',
        );
      });

      it('Create record : using ID', async function () {
        const userList = await getUsers(testContext);

        const id0 = userList.find((u) => u.email === 'test@example.com').id;
        const id1 = userList.find((u) => u.email === 'a@nocodb.com').id;

        const newRecord = {
          fields: {
            userFieldSingle: id0,
            userFieldMulti: `${id0},${id1}`,
          },
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: newRecord,
        });
        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', 401);
        expect(rsp.body.records[0]).to.have.property('fields');
        const record = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/401`,
        });
        expect(record.body.id).to.equal(401);
        expect(record.body.fields.userFieldSingle[0].email).to.equal(
          'test@example.com',
        );
        expect(record.body.fields.userFieldMulti[0].email).to.equal(
          'test@example.com',
        );
        expect(record.body.fields.userFieldMulti[1].email).to.equal(
          'a@nocodb.com',
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

      it(`will handle insert field format valid`, async () => {
        const insertCases = Object.keys(checkboxTypeMap);
        const body: any[] = [];
        for (const insertCase of insertCases) {
          body.push({ fields: { Checkbox: insertCase } });
        }
        for (let batch = 0; batch < body.length; batch += 5) {
          const response = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}/records`,
            body: body.slice(batch, batch + 5),
          });

          const list = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/records`,
            query: {
              where: `(Id,gte,${response.body.records[0].id})`,
            },
          });
          for (let index = 0; index < list.body.records.length; index++) {
            const actual = list.body.records[index];
            const expected = checkboxTypeMap[insertCases[batch + index]];
            expect(actual.fields.Checkbox).to.equal(expected);
          }
        }
      });
    });
  });
});
