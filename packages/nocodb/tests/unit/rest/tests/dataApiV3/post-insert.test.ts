/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { type ColumnType } from 'nocodb-sdk';
import {
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
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;

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
        SingleLineText: 'abc',
        MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
        Email: 'a@b.com',
        Url: 'https://www.abc.com',
        Phone: '1-234-567-8910',
      };

      it('Create: all fields', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });

        expect(rsp.body).to.deep.equal({ Id: 401 });
      });

      it('Create: few fields left out', async function () {
        const newRecord = {
          SingleLineText: 'abc',
          MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });

        // fields left out should be null
        expect(rsp.body).to.deep.equal({ Id: 401 });
      });

      it('Create: bulk', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: [newRecord, newRecord, newRecord],
        });
        expect(rsp.body.sort((a, b) => a.Id - b.Id)).to.deep.equal([
          { Id: 401 },
          { Id: 402 },
          { Id: 403 },
        ]);
      });

      // Error handling
      it('Create: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosPost({
          url: `${urlPrefix}/123456789`,
          status: 422,
        });

        // Invalid data - create should not specify ID
        await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: { ...newRecord, Id: 300 },
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
          [idMap['SingleLineText']!]: 'SingleLineText',
          [idMap['MultiLineText']!]: 'MultiLineText',
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: createPayload,
        });
        expect(rsp.body).to.deep.equal({ Id: 401 });
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            where: '(Id,gte,401)',
          },
        });
        expect(
          rspGet.body.list.map((k) => k.SingleLineText).join(','),
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
            [idMap['SingleLineText']!]: 'SingleLineText',
            [idMap['MultiLineText']!]: 'MultiLineText',
          },
          {
            [idMap['SingleLineText']!]: 'SingleLineText2',
            [idMap['MultiLineText']!]: 'MultiLineText2',
          },
        ];
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: createPayload,
        });
        expect(rsp.body).to.deep.equal([{ Id: 401 }, { Id: 402 }]);
        const rspGet = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            where: '(Id,gte,401)',
          },
        });
        expect(
          rspGet.body.list.map((k) => k.SingleLineText).join(','),
        ).to.equal('SingleLineText,SingleLineText2');
      });
    });

    describe('link-insert', () => {
      let tblCity: Model;
      let tblCountry: Model;
      let tblActor: Model;
      let tblFilm: Model;

      let columnsFilm: ColumnType[];
      let columnsActor: ColumnType[];
      let columnsCountry: ColumnType[];
      let columnsCity: ColumnType[];

      beforeEach(async function () {
        const initResult = await beforeEachLinkBased(testContext);
        tblCity = initResult.tblCity;
        tblCountry = initResult.tblCountry;
        tblActor = initResult.tblActor;
        tblFilm = initResult.tblFilm;
        columnsFilm = initResult.columnsFilm;
        columnsActor = initResult.columnsActor;
        columnsCountry = initResult.columnsCountry;
        columnsCity = initResult.columnsCity;
      });

      it('will perform single insert with linked field', async () => {
        const citiesToInsert = {
          City: 'ImaginaryCity',
          Country: {
            Id: 1,
          },
        };

        const citiesInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCity.id}`,
          body: citiesToInsert,
        });
        const emptyCitiesToInsert = [
          {
            City: 'TestCity1',
          },
          {
            City: 'TestCity2',
          },
          {
            City: 'TestCity3',
          },
          {
            City: 'TestCity4',
          },
          {
            City: 'TestCity5',
          },
        ];
        const emptyCitiesInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCity.id}`,
          body: emptyCitiesToInsert,
        });
        const countriesToInsert = {
          Country: 'ImaginaryCountry',
          Cities: emptyCitiesInsertResponse.body,
        };

        const countryInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}`,
          body: countriesToInsert,
        });

        const citiesToValidate = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}`,
          query: {
            filter: '(Id, gt, 100)',
          },
        });
        const countriesToValidate = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            filter: '(Id, gt, 100)',
          },
        });
        const insertedCity = citiesToValidate.body.list.find(
          (city) => city.Id === citiesInsertResponse.body.Id,
        );
        expect(
          insertedCity !== null && typeof insertedCity !== 'undefined',
        ).to.eq(true);
        const emptyInsertedCity = citiesToValidate.body.list.filter((city) =>
          emptyCitiesInsertResponse.body.some((k) => k.Id === city.Id),
        );

        expect(emptyInsertedCity.length).to.eq(emptyCitiesToInsert.length);
        expect(emptyInsertedCity.map((k) => k.City)).to.deep.eq(
          emptyCitiesToInsert.map((k) => k.City),
        );
        expect(insertedCity.Country.Id).to.eq(1);
        expect(emptyInsertedCity[0].Country.Id).to.eq(
          countriesToValidate.body.list[0].Id,
        );
      });

      it('will perform bulk insert with linked field', async () => {
        const citiesToInsert = [
          {
            City: 'ImaginaryCity',
            Country: {
              Id: 1,
            },
          },
          {
            City: 'ImaginaryCity2',
            Country: {
              Id: 2,
            },
          },
        ];

        const citiesInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCity.id}`,
          body: citiesToInsert,
        });
        const emptyCitiesToInsert = [
          {
            City: 'TestCity1',
          },
          {
            City: 'TestCity2',
          },
          {
            City: 'TestCity3',
          },
          {
            City: 'TestCity4',
          },
          {
            City: 'TestCity5',
          },
        ];
        const emptyCitiesInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCity.id}`,
          body: emptyCitiesToInsert,
        });
        const countriesToInsert = [
          {
            Country: 'ImaginaryCountry',
            Cities: emptyCitiesInsertResponse.body.slice(0, 2),
          },
          {
            Country: 'ImaginaryCountry2',
            Cities: [emptyCitiesInsertResponse.body[2]],
          },
        ];

        const countryInsertResponse = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}`,
          body: countriesToInsert,
        });

        const citiesToValidate = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}`,
          query: {
            filter: '(Id, gt, 100)',
            sort: 'Id',
          },
        });
        const countriesToValidate = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            filter: '(Id, gt, 100)',
            sort: 'Id',
          },
        });
        const insertedCities = citiesToValidate.body.list.filter((city) =>
          citiesInsertResponse.body.some((k) => k.Id === city.Id),
        );
        expect(insertedCities.length).to.eq(2);
        const emptyInsertedCities = citiesToValidate.body.list.filter((city) =>
          emptyCitiesInsertResponse.body.some((k) => k.Id === city.Id),
        );

        expect(emptyInsertedCities.length).to.eq(emptyCitiesToInsert.length);
        expect(
          insertedCities.map((k) => ({ Id: k.Country?.Id })),
        ).to.deep.equal([{ Id: 1 }, { Id: 2 }]);
        expect(
          emptyInsertedCities.map((k) => ({ Id: k.Country?.Id })),
        ).to.deep.eq([
          { Id: 101 },
          { Id: 101 },
          { Id: 102 },
          { Id: undefined },
          { Id: undefined },
        ]);
      });
    });

    describe('user-based', () => {
      let table: Model;
      let columns: Column[] = [];

      beforeEach(async () => {
        const initResult = await beforeEachUserBased(testContext);

        table = initResult.table;
        columns = initResult.columns;
        urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
      });

      it('Create record : using email', async function () {
        const newRecord = {
          userFieldSingle: 'a@nocodb.com',
          userFieldMulti: 'a@nocodb.com,b@nocodb.com',
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });
        expect(rsp.body).to.deep.equal({ Id: 401 });

        const record = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/401`,
        });
        expect(record.body.Id).to.equal(401);
        expect(record.body.userFieldSingle[0].email).to.equal('a@nocodb.com');
        expect(record.body.userFieldMulti[0].email).to.equal('a@nocodb.com');
        expect(record.body.userFieldMulti[1].email).to.equal('b@nocodb.com');
      });

      it('Create record : using ID', async function () {
        const userList = await getUsers(testContext);

        const id0 = userList.find((u) => u.email === 'test@example.com').id;
        const id1 = userList.find((u) => u.email === 'a@nocodb.com').id;

        const newRecord = {
          userFieldSingle: id0,
          userFieldMulti: `${id0},${id1}`,
        };
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: newRecord,
        });
        expect(rsp.body).to.deep.equal({ Id: 401 });
        const record = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/401`,
        });
        expect(record.body.Id).to.equal(401);
        expect(record.body.userFieldSingle[0].email).to.equal(
          'test@example.com',
        );
        expect(record.body.userFieldMulti[0].email).to.equal(
          'test@example.com',
        );
        expect(record.body.userFieldMulti[1].email).to.equal('a@nocodb.com');
      });
    });
  });
});
