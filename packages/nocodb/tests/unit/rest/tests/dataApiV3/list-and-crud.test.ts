/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { convertMS2Duration } from 'nocodb-sdk';
import {
  beforeEachCheckbox,
  beforeEachDateBased,
  beforeEachLinkBased,
  beforeEachNumberBased,
  beforeEachSelectBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import { getColumnId, idc, initArraySeq, prepareRecords } from './helpers';
import type { ITestContext } from './helpers';
import type { ColumnType } from 'nocodb-sdk';
import type { Column, Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';
const debugMode = true;

describe('dataApiV3', () => {
  describe('list-and-crud', () => {
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

    describe('number-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let insertedRecords: any[];

      beforeEach(async function () {
        const initResult = await beforeEachNumberBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
      });

      const records: {
        Id?: number | null;
        Number?: number | null;
        Decimal?: number | null;
        Currency?: number | null;
        Percent?: number | null;
        Duration?: number | null;
        Rating?: number | null;
      }[] = [
        {
          Id: 1,
          Number: 33,
          Decimal: 33.3,
          Currency: 33.3,
          Percent: 33,
          Duration: 10 * 60,
          Rating: 0,
        },
        {
          Id: 2,
          Number: null,
          Decimal: 456.34,
          Currency: 456.34,
          Percent: null,
          Duration: 20 * 60,
          Rating: 1,
        },
        {
          Id: 3,
          Number: 456,
          Decimal: 333.3,
          Currency: 333.3,
          Percent: 456,
          Duration: 30 * 60,
          Rating: 2,
        },
        {
          Id: 4,
          Number: 333,
          Decimal: null,
          Currency: null,
          Percent: 333,
          Duration: 40 * 60,
          Rating: 3,
        },
        {
          Id: 5,
          Number: 267,
          Decimal: 267.5674,
          Currency: 267.5674,
          Percent: 267,
          Duration: 50 * 60,
          Rating: null,
        },
        {
          Id: 6,
          Number: 34,
          Decimal: 34,
          Currency: 34,
          Percent: 34,
          Duration: 60 * 60,
          Rating: 0,
        },
        {
          Id: 7,
          Number: 8754,
          Decimal: 8754,
          Currency: 8754,
          Percent: 8754,
          Duration: null,
          Rating: 4,
        },
        {
          Id: 8,
          Number: 3234,
          Decimal: 3234.547,
          Currency: 3234.547,
          Percent: 3234,
          Duration: 70 * 60,
          Rating: 5,
        },
        {
          Id: 9,
          Number: 44,
          Decimal: 44.2647,
          Currency: 44.2647,
          Percent: 44,
          Duration: 80 * 60,
          Rating: 0,
        },
        {
          Id: 10,
          Number: 33,
          Decimal: 33.98,
          Currency: 33.98,
          Percent: 33,
          Duration: 90 * 60,
          Rating: 1,
        },
      ];

      it('Number based- List & CRUD', async function () {
        // list 10 records
        let rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
            fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
          },
        });

        expect(rsp.body.pageInfo).to.have.property('next');
        expect(rsp.body.pageInfo.next).to.include(
          `${urlPrefix}/${table.id}?page=2`,
        );
        expect(rsp.body.list).to.deep.equal(records);

        ///////////////////////////////////////////////////////////////////////////

        // insert 10 records
        // remove Id's from record array
        records.forEach((r) => delete r.Id);
        rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: records.map((k) => ({
            ...k,
            Duration: k.Duration,
          })),
        });

        // prepare array with 10 Id's, from 401 to 410
        const ids: { Id: number }[] = [];
        for (let i = 401; i <= 410; i++) {
          ids.push({ Id: i });
        }
        expect(rsp.body.sort((a, b) => a.Id - b.Id)).to.deep.equal(ids);

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 401
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/401`,
          query: {
            fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
          },
        });

        expect(rsp.body).to.deep.equal({ ...records[0], Id: 401 });

        ///////////////////////////////////////////////////////////////////////////

        // update record with Id 401 to 404
        const updatedRecord = {
          Number: 55,
          Decimal: 55.5,
          Currency: 55.5,
          Percent: 55,
          Duration: 55,
          Rating: 5,
        };

        const updatedRecords = [
          {
            Id: 401,
            ...updatedRecord,
          },
          {
            Id: 402,
            ...updatedRecord,
          },
          {
            Id: 403,
            ...updatedRecord,
          },
          {
            Id: 404,
            ...updatedRecord,
          },
        ];
        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords,
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );

        // verify updated records
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
            offset: 400,
            fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
          },
        });

        expect(rsp.body.list.slice(0, 4)).to.deep.equal(updatedRecords);

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 401 to 404
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords.map((record) => ({ Id: record.Id })),
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );
      });
    });

    describe('select-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let insertedRecords: any[];

      beforeEach(async function () {
        const initResult = await beforeEachSelectBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
      });

      const records: {
        Id?: number | null;
        SingleSelect?: string | null;
        MultiSelect?: string | null;
      }[] = [
        {
          Id: 1,
          SingleSelect: 'jan',
          MultiSelect: 'jan,feb,mar',
        },
        {
          Id: 2,
          SingleSelect: 'feb',
          MultiSelect: 'apr,may,jun',
        },
        {
          Id: 3,
          SingleSelect: 'mar',
          MultiSelect: 'jul,aug,sep',
        },
        {
          Id: 4,
          SingleSelect: 'apr',
          MultiSelect: 'oct,nov,dec',
        },
        {
          Id: 5,
          SingleSelect: 'may',
          MultiSelect: 'jan,feb,mar',
        },
        {
          Id: 6,
          SingleSelect: 'jun',
          MultiSelect: null,
        },
        {
          Id: 7,
          SingleSelect: 'jul',
          MultiSelect: 'jan,feb,mar',
        },
        {
          Id: 8,
          SingleSelect: 'aug',
          MultiSelect: 'apr,may,jun',
        },
        {
          Id: 9,
          SingleSelect: 'sep',
          MultiSelect: 'jul,aug,sep',
        },
        {
          Id: 10,
          SingleSelect: 'oct',
          MultiSelect: 'oct,nov,dec',
        },
      ];

      const recordsV3: {
        Id?: number | null;
        SingleSelect?: string | null;
        MultiSelect?: string[] | null;
      }[] = records.map((r) => ({
        Id: r.Id,
        SingleSelect: r.SingleSelect,
        MultiSelect: r.MultiSelect?.split(',') ?? null,
      }));

      it('Select based- List & CRUD', async function () {
        // list 10 records
        let rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        expect(rsp.body.pageInfo).to.have.property('next');
        expect(rsp.body.pageInfo.next).to.include(
          `${urlPrefix}/${table.id}?page=2`,
        );
        expect(rsp.body.list).to.deep.equal(recordsV3);

        ///////////////////////////////////////////////////////////////////////////

        // insert 10 records
        // remove Id's from record array
        records.forEach((r) => delete r.Id);
        recordsV3.forEach((r) => delete r.Id);

        rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: recordsV3,
        });

        // prepare array with 10 Id's, from 401 to 410
        const ids: { Id: number }[] = [];
        for (let i = 401; i <= 410; i++) {
          ids.push({ Id: i });
        }
        expect(rsp.body).to.deep.equal(ids);

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 401
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/401`,
          query: {
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        expect(rsp.body).to.deep.equal({
          Id: 401,
          ...recordsV3[0],
        });

        ///////////////////////////////////////////////////////////////////////////

        // update record with Id 401 to 404
        const updatedRecord = {
          SingleSelect: 'jan',
          MultiSelect: ['jan', 'feb', 'mar'],
        };
        const updatedRecords = [
          {
            Id: 401,
            ...updatedRecord,
          },
          {
            Id: 402,
            ...updatedRecord,
          },
          {
            Id: 403,
            ...updatedRecord,
          },
          {
            Id: 404,
            ...updatedRecord,
          },
        ];
        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords,
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );

        // verify updated records
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
            offset: 400,
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        expect(rsp.body.list.slice(0, 4)).to.deep.equal(updatedRecords);

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 401 to 404
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords.map((record) => ({ Id: record.Id })),
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );
      });
    });

    describe('date-based', () => {
      let table: Model;
      let columns: Column[] = [];
      let insertedRecords: any[];

      beforeEach(async function () {
        const initResult = await beforeEachDateBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
      });

      // need to investigate first
      it('Date based- List & CRUD', async function () {
        // list 10 records
        let rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
          },
        });

        expect(rsp.body.pageInfo).to.have.property('next');
        expect(rsp.body.pageInfo.next).to.include(
          `${urlPrefix}/${table.id}?page=2`,
        );

        // extract first 10 records from inserted records
        const records = insertedRecords.slice(0, 10);
        rsp.body.list.forEach((record: any, index: number) => {
          expect(record).to.include(records[index]);
        });

        ///////////////////////////////////////////////////////////////////////////

        // insert 10 records
        // remove Id's from record array
        records.forEach((r) => {
          delete r.Id;
          delete r.CreatedAt;
          delete r.UpdatedAt;
          delete r.CreatedBy;
          delete r.UpdatedBy;
        });
        rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: records,
        });

        // prepare array with 10 Id's, from 801 to 810
        const ids: { Id: number }[] = [];
        for (let i = 801; i <= 810; i++) {
          ids.push({ Id: i });
        }
        expect(rsp.body).to.deep.equal(ids);

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 801
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/801`,
          query: {
            fields: 'Id,Date,DateTime',
          },
        });
        expect(rsp.body).to.deep.equal({
          Id: 801,
          Date: records[0].Date,
          DateTime: records[0].DateTime,
        });

        ///////////////////////////////////////////////////////////////////////////

        // update record with Id 801 to 804
        const updatedRecord = {
          Date: '2022-04-25',
          DateTime: '2022-04-25 08:30:00+00:00',
        };
        const updatedRecords = [
          {
            Id: 801,
            ...updatedRecord,
          },
          {
            Id: 802,
            ...updatedRecord,
          },
          {
            Id: 803,
            ...updatedRecord,
          },
          {
            Id: 804,
            ...updatedRecord,
          },
        ];
        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords,
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );

        // verify updated records
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}`,
          query: {
            limit: 10,
            offset: 800,
            fields: 'Id,Date,DateTime',
          },
        });
        expect(rsp.body.list.slice(0, 4)).to.deep.equal(updatedRecords);

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 801 to 804
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords.map((record) => ({ Id: record.Id })),
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );
      });
    });

    describe('Link based', () => {
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

      it('Has-Many', async function () {
        // Create hm link between Country and City
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5],
          status: 200,
        });

        // verify in Country table
        let rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
        });

        let rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        // low record count list has no next
        expect(rspFromRecordAPI.body.pageInfo).not.to.have.property('next');

        let citiesExpected = [
          { Id: 1, City: 'City 1' },
          { Id: 2, City: 'City 2' },
          { Id: 3, City: 'City 3' },
          { Id: 4, City: 'City 4' },
          { Id: 5, City: 'City 5' },
        ];

        // links
        expect(rspFromLinkAPI.body.list).to.deep.equal(citiesExpected);

        let citiesExpectedFromListAPI = citiesExpected.map((c) => ({
          Id: c.Id,
          City: c.City,
        }));
        expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.list[0]['Cities']).to.be.eq(5);
        expect(rspFromLinkAPI.body.list).to.deep.equal(
          citiesExpectedFromListAPI,
        );
        ///////////////////////////////////////////////////////////////////

        // verify in City table
        for (let i = 1; i <= 10; i++) {
          rspFromLinkAPI = await ncAxiosLinkGet({
            urlParams: {
              tableId: tblCity.id,
              linkId: getColumnId(columnsCity, 'Country'),
              rowId: `${i}`,
            },
          });

          rspFromRecordAPI = await ncAxiosGet({
            url: `${urlPrefix}/${tblCity.id}`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i <= 5) {
            expect(rspFromLinkAPI.body).to.deep.equal({
              Id: 1,
              Country: `Country 1`,
            });

            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.deep.eq({
              Id: 1,
              Country: `Country 1`, // Note the change in key
            });
          } else {
            expect(rspFromLinkAPI.body).to.deep.equal({});
            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.be.eq(null);
          }
        }

        // Update hm link between Country and City
        // List them for a record & verify in both tables
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [6, 7],
        });

        // verify in Country table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
        });

        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        citiesExpected = [
          { Id: 1, City: 'City 1' },
          { Id: 2, City: 'City 2' },
          { Id: 3, City: 'City 3' },
          { Id: 4, City: 'City 4' },
          { Id: 5, City: 'City 5' },
          { Id: 6, City: 'City 6' },
          { Id: 7, City: 'City 7' },
        ];

        expect(rspFromLinkAPI.body.list).to.deep.equal(citiesExpected);

        citiesExpectedFromListAPI = citiesExpected.map((c) => ({
          Id: c.Id,
          City: c.City,
        }));
        expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.list[0]['Cities']).to.be.eq(7);
        expect(rspFromLinkAPI.body.list).to.deep.equal(
          citiesExpectedFromListAPI,
        );

        // verify in City table
        for (let i = 1; i <= 10; i++) {
          rspFromLinkAPI = await ncAxiosLinkGet({
            urlParams: {
              tableId: tblCity.id,
              linkId: getColumnId(columnsCity, 'Country'),
              rowId: `${i}`,
            },
          });

          rspFromRecordAPI = await ncAxiosGet({
            url: `${urlPrefix}/${tblCity.id}`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i <= 7) {
            expect(rspFromLinkAPI.body).to.deep.equal({
              Id: 1,
              Country: `Country 1`,
            });

            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.deep.eq({
              Id: 1,
              Country: `Country 1`, // Note the change in key
            });
          } else {
            expect(rspFromLinkAPI.body).to.deep.equal({});
            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.be.eq(null);
          }
        }

        // Delete hm link between Country and City
        // List them for a record & verify in both tables
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 3, 5, 7],
        });

        // verify in Country table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
        });

        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        citiesExpected = [
          { Id: 2, City: 'City 2' },
          { Id: 4, City: 'City 4' },
          { Id: 6, City: 'City 6' },
        ];
        expect(rspFromLinkAPI.body.list).to.deep.equal(citiesExpected);

        citiesExpectedFromListAPI = citiesExpected.map((c) => ({
          Id: c.Id,
          City: c.City, // Notice key
        }));
        expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.list[0]['Cities']).to.be.eq(3);
        expect(rspFromLinkAPI.body.list).to.deep.equal(
          citiesExpectedFromListAPI,
        );
        // verify in City table
        for (let i = 1; i <= 10; i++) {
          rspFromLinkAPI = await ncAxiosLinkGet({
            urlParams: {
              tableId: tblCity.id,
              linkId: getColumnId(columnsCity, 'Country'),
              rowId: `${i}`,
            },
          });

          rspFromRecordAPI = await ncAxiosGet({
            url: `${urlPrefix}/${tblCity.id}`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i % 2 === 0 && i <= 6) {
            expect(rspFromLinkAPI.body).to.deep.equal({
              Id: 1,
              Country: `Country 1`,
            });

            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.deep.eq({
              Id: 1,
              Country: `Country 1`, // Note the change in key
            });
          } else {
            expect(rspFromLinkAPI.body).to.deep.equal({});
            expect(rspFromRecordAPI.body.list.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.list[0]['Country']).to.be.eq(null);
          }
        }
      });

      // Create mm link between Actor and Film
      // List them for a record & verify in both tables
      it('Create Many-Many ', async function () {
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [
            { Id: 1 },
            { Id: 2 },
            { Id: 3 },
            { Id: 4 },
            { Id: 5 },
            { Id: 6 },
            { Id: 7 },
            { Id: 8 },
            { Id: 9 },
            { Id: 10 },
            { Id: 11 },
            { Id: 12 },
            { Id: 13 },
            { Id: 14 },
            { Id: 15 },
            { Id: 16 },
            { Id: 17 },
            { Id: 18 },
            { Id: 19 },
            { Id: 20 },
          ],
        });
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblFilm.id,
            linkId: getColumnId(columnsFilm, 'Actors'),
            rowId: '1',
          },
          body: [
            { Id: 1 },
            { Id: 2 },
            { Id: 3 },
            { Id: 4 },
            { Id: 5 },
            { Id: 6 },
            { Id: 7 },
            { Id: 8 },
            { Id: 9 },
            { Id: 10 },
            { Id: 11 },
            { Id: 12 },
            { Id: 13 },
            { Id: 14 },
            { Id: 15 },
            { Id: 16 },
            { Id: 17 },
            { Id: 18 },
            { Id: 19 },
            { Id: 20 },
          ],
        });

        // verify in Actor table
        let rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
        });

        let rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(rspFromRecordAPI.body.pageInfo).not.to.have.property('next');

        const expectedFilmsFromLinkAPI = prepareRecords('Film', 20);
        const expectedFilmsFromRecordV3API = expectedFilmsFromLinkAPI.map(
          (r) => ({
            Id: r.Id,
            Value: r['Film'],
          }),
        );

        // Links
        expect(rspFromLinkAPI.body.list.length).to.equal(20);
        expect(rspFromLinkAPI.body.list.sort(idc)).to.deep.equal(
          expectedFilmsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.list.length).to.equal(1);
        expect(rspFromRecordAPI.body.list[0]['Films']).to.equal(20);

        // Second record
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '2',
          },
        });
        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}`,
          query: {
            where: `(Id,eq,2)`,
          },
        });

        expect(rspFromLinkAPI.body.list.length).to.equal(1);
        expect(rspFromLinkAPI.body.list[0]).to.deep.equal({
          Id: 1,
          Film: `Film 1`,
        });

        expect(rspFromRecordAPI.body.list.length).to.equal(1);
        expect(rspFromRecordAPI.body.list[0]['Films']).to.equal(1);
        expect(rspFromLinkAPI.body.list[0]).to.deep.equal({
          Id: 1,
          Film: `Film 1`,
        });

        // verify in Film table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblFilm.id,
            linkId: getColumnId(columnsFilm, 'Actors'),
            rowId: '1',
          },
        });
        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblFilm.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        const expectedActorsFromLinkAPI = prepareRecords('Actor', 20);

        // Links
        expect(rspFromLinkAPI.body.list.length).to.equal(20);
        expect(rspFromLinkAPI.body.list.sort(idc)).to.deep.equal(
          expectedActorsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.list.length).to.equal(1);
        expect(rspFromRecordAPI.body.list[0]['Actors']).to.equal(20);

        // Update mm link between Actor and Film
        // List them for a record & verify in both tables
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        });

        // Even though we added till 30, we need till 25 due to pagination
        expectedFilmsFromLinkAPI.push(...prepareRecords('Film', 5, 21));

        // verify in Actor table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          query: {
            limit: 25,
          },
        });
        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });
        expect(rspFromLinkAPI.body.list.length).to.equal(25);
        // We cannot compare list directly since order is not fixed, any 25, out of 30 can come.
        // expect(rspFromLinkAPI.body.list.sort(idc)).to.deep.equal(expectedFilmsFromLinkAPI.sort(idc));

        expect(rspFromRecordAPI.body.list.length).to.equal(1);
        expect(rspFromRecordAPI.body.list[0]['Films']).to.equal(30);

        // verify in Film table
        for (let i = 21; i <= 30; i++) {
          rspFromLinkAPI = await ncAxiosLinkGet({
            urlParams: {
              tableId: tblFilm.id,
              linkId: getColumnId(columnsFilm, 'Actors'),
              rowId: `${i}`,
            },
          });

          rspFromRecordAPI = await ncAxiosGet({
            url: `${urlPrefix}/${tblFilm.id}`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });
          expect(rspFromLinkAPI.body.list.length).to.equal(1);
          expect(rspFromLinkAPI.body.list[0]).to.deep.equal({
            Id: 1,
            Actor: `Actor 1`,
          });

          expect(rspFromRecordAPI.body.list.length).to.equal(1);
          expect(rspFromRecordAPI.body.list[0]['Actors']).to.equal(1);
        }

        // Delete mm link between Actor and Film
        // List them for a record & verify in both tables
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [
            { Id: 1 },
            { Id: 3 },
            { Id: 5 },
            { Id: 7 },
            { Id: 9 },
            { Id: 11 },
            { Id: 13 },
            { Id: 15 },
            { Id: 17 },
            { Id: 19 },
            { Id: 21 },
            { Id: 23 },
            { Id: 25 },
            { Id: 27 },
            { Id: 29 },
          ],
        });

        expectedFilmsFromLinkAPI.length = 0; // clear array
        expectedFilmsFromRecordV3API.length = 0; // clear array
        for (let i = 2; i <= 30; i += 2) {
          expectedFilmsFromLinkAPI.push({
            Id: i,
            Film: `Film ${i}`,
          });
          expectedFilmsFromRecordV3API.push({
            Id: i,
            Value: `Film ${i}`,
          });
        }

        // verify in Actor table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
        });
        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(rspFromLinkAPI.body.list.length).to.equal(
          expectedFilmsFromLinkAPI.length,
        );
        expect(rspFromLinkAPI.body.list.sort(idc)).to.deep.equal(
          expectedFilmsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.list.length).to.equal(1);
        expect(rspFromRecordAPI.body.list[0]['Films']).to.equal(
          expectedFilmsFromRecordV3API.length,
        );

        // verify in Film table
        for (let i = 2; i <= 30; i++) {
          rspFromLinkAPI = await ncAxiosLinkGet({
            urlParams: {
              tableId: tblFilm.id,
              linkId: getColumnId(columnsFilm, 'Actors'),
              rowId: `${i}`,
            },
          });
          rspFromRecordAPI = await ncAxiosGet({
            url: `${urlPrefix}/${tblFilm.id}`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });
          if (i % 2 === 0) {
            expect(rspFromLinkAPI.body.list.length).to.equal(1);
            expect(rspFromLinkAPI.body.list[0]).to.deep.equal({
              Id: 1,
              Actor: `Actor 1`,
            });

            expect(rspFromRecordAPI.body.list.length).to.equal(1);
            expect(rspFromRecordAPI.body.list[0]['Actors']).to.equal(1);
          } else {
            expect(rspFromLinkAPI.body.list.length).to.equal(0);
            expect(rspFromRecordAPI.body.list.length).to.equal(1);
            expect(rspFromRecordAPI.body.list[0]['Actors']).to.equal(0);
          }
        }
      });

      // Other scenarios
      // Has-many : change an existing link to a new one
      it('HM: Change an existing link to a new one', async function () {
        // add a link
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [{ Id: 1 }, { Id: 2 }, { Id: 3 }],
        });

        // update the link
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '2',
          },
          body: [{ Id: 2 }, { Id: 3 }],
        });

        // verify record 1
        let respFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
        });
        let respFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(respFromLinkAPI.body.list.length).to.equal(1);
        expect(respFromLinkAPI.body.list[0]).to.deep.equal({
          Id: 1,
          City: 'City 1',
        });

        expect(respFromRecordAPI.body.list.length).to.eq(1);
        expect(respFromRecordAPI.body.list[0]['Cities']).to.eq(1);

        respFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '2',
          },
        });
        respFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}`,
          query: {
            where: `(Id,eq,2)`,
          },
        });

        expect(respFromLinkAPI.body.list.length).to.equal(2);
        expect(respFromLinkAPI.body.list.sort(idc)).to.deep.equal(
          [
            { Id: 2, City: 'City 2' },
            { Id: 3, City: 'City 3' },
          ].sort(idc),
        );

        expect(respFromRecordAPI.body.list.length).to.eq(1);
        expect(respFromRecordAPI.body.list[0]['Cities']).to.eq(2);
      });

      // limit & offset verification
      // Records API not tested since it has different limit requirements
      // (upto 1000 records allowed, so different test will be required)
      it('Limit & offset verification', async function () {
        // add a link
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: initArraySeq(1, 50),
        });

        // verify record 1
        let rsp = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          query: {
            limit: 10,
            offset: 0,
          },
        });
        expect(rsp.body.list.length).to.equal(10);
        expect(rsp.body.list).to.deep.equal([
          { Id: 1, City: 'City 1' },
          { Id: 2, City: 'City 2' },
          { Id: 3, City: 'City 3' },
          { Id: 4, City: 'City 4' },
          { Id: 5, City: 'City 5' },
          { Id: 6, City: 'City 6' },
          { Id: 7, City: 'City 7' },
          { Id: 8, City: 'City 8' },
          { Id: 9, City: 'City 9' },
          { Id: 10, City: 'City 10' },
        ]);

        rsp = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          query: {
            limit: 10,
            offset: 5,
          },
        });
        expect(rsp.body.list.length).to.equal(10);
        expect(rsp.body.list).to.deep.equal([
          { Id: 6, City: 'City 6' },
          { Id: 7, City: 'City 7' },
          { Id: 8, City: 'City 8' },
          { Id: 9, City: 'City 9' },
          { Id: 10, City: 'City 10' },
          { Id: 11, City: 'City 11' },
          { Id: 12, City: 'City 12' },
          { Id: 13, City: 'City 13' },
          { Id: 14, City: 'City 14' },
          { Id: 15, City: 'City 15' },
        ]);

        rsp = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          query: {
            limit: 100,
            offset: 45,
          },
        });
        expect(rsp.body.list.length).to.equal(5);
        expect(rsp.body.list).to.deep.equal([
          { Id: 46, City: 'City 46' },
          { Id: 47, City: 'City 47' },
          { Id: 48, City: 'City 48' },
          { Id: 49, City: 'City 49' },
          { Id: 50, City: 'City 50' },
        ]);
      });

      async function nestedAddTests(validParams, relationType?) {
        // Link Add: Invalid table ID
        if (debugMode) console.log('Link Add: Invalid table ID');
        const response = await ncAxiosLinkAdd({
          ...validParams,
          urlParams: { ...validParams.urlParams, tableId: 9999 },
          status: 422,
        });
        console.log('response', response.body)

        // Link Add: Invalid link ID
        if (debugMode) console.log('Link Add: Invalid link ID');
        await ncAxiosLinkAdd({
          ...validParams,
          urlParams: { ...validParams.urlParams, linkId: 9999 },
          status: 404,
          msg: "Field '9999' not found",
        });

        // Link Add: Invalid Source row ID
        if (debugMode) console.log('Link Add: Invalid Source row ID');
        await ncAxiosLinkAdd({
          ...validParams,
          urlParams: { ...validParams.urlParams, rowId: 9999 },
          status: 404,
          msg: "Record '9999' not found",
        });

        // Body parameter error
        //

        // Link Add: Invalid body parameter - empty body : ignore
        if (debugMode)
          console.log('Link Add: Invalid body parameter - empty body : ignore');
        await ncAxiosLinkAdd({
          ...validParams,
          body: [],
          status: 200,
        });

        if (relationType === 'bt') {
          // Link Add: Invalid body parameter - row id invalid
          if (debugMode)
            console.log('Link Add: Invalid body parameter - row id invalid');
          await ncAxiosLinkAdd({
            ...validParams,
            body: [999, 998],
            status: 404,
            msg: "Record '999' not found",
          });
        } else {
          // Link Add: Invalid body parameter - row id invalid
          if (debugMode)
            console.log('Link Add: Invalid body parameter - row id invalid');
          await ncAxiosLinkAdd({
            ...validParams,
            body: [999, 998, 997],
            status: 404,
            msg: "Records '999, 998, 997' not found",
          });

          // Link Add: Invalid body parameter - repeated row id
          if (debugMode)
            console.log('Link Add: Invalid body parameter - repeated row id');
          await ncAxiosLinkAdd({
            ...validParams,
            body: [1, 2, 1, 2],
            status: 422,
            msg: "Records '1, 2' already exists",
          });
        }
      }

      async function nestedRemoveTests(validParams, relationType?) {
        // Link Remove: Invalid table ID
        if (debugMode) console.log('Link Remove: Invalid table ID');
        await ncAxiosLinkRemove({
          ...validParams,
          urlParams: { ...validParams.urlParams, tableId: 9999 },
          status: 422,
        });

        // Link Remove: Invalid link ID
        if (debugMode) console.log('Link Remove: Invalid link ID');
        await ncAxiosLinkRemove({
          ...validParams,
          urlParams: { ...validParams.urlParams, linkId: 9999 },
          status: 404,
          msg: "Field '9999' not found",
        });

        // Link Remove: Invalid Source row ID
        if (debugMode) console.log('Link Remove: Invalid Source row ID');
        await ncAxiosLinkRemove({
          ...validParams,
          urlParams: { ...validParams.urlParams, rowId: 9999 },
          status: 404,
          msg: "Record '9999' not found",
        });

        // Body parameter error
        //

        // Link Remove: Invalid body parameter - empty body : ignore
        if (debugMode)
          console.log(
            'Link Remove: Invalid body parameter - empty body : ignore',
          );
        await ncAxiosLinkRemove({
          ...validParams,
          body: [],
          status: 200,
        });

        if (relationType === 'bt') {
          // Link Remove: Invalid body parameter - row id invalid
          if (debugMode)
            console.log('Link Remove: Invalid body parameter - row id invalid');
          await ncAxiosLinkRemove({
            ...validParams,
            body: [999, 998],
            status: 422,
            msg: 'Request must contain only one parent id',
          });
        } else {
          // Link Remove: Invalid body parameter - row id invalid
          if (debugMode)
            console.log('Link Remove: Invalid body parameter - row id invalid');
          await ncAxiosLinkRemove({
            ...validParams,
            body: [999, 998],
            status: 404,
            msg: "Records '999, 998' not found",
          });

          // Link Remove: Invalid body parameter - repeated row id
          if (debugMode)
            console.log(
              'Link Remove: Invalid body parameter - repeated row id',
            );
          await ncAxiosLinkRemove({
            ...validParams,
            body: [1, 2, 1, 2],
            status: 422,
            msg: "Records '1, 2' already exists",
          });
        }
      }

      async function nestedListTests(validParams, relationType?) {
        // Link List: Invalid table ID
        if (debugMode) console.log('Link List: Invalid table ID');
        await ncAxiosLinkGet({
          ...validParams,
          urlParams: { ...validParams.urlParams, tableId: 9999 },
          status: 422,
        });

        // Link List: Invalid link ID
        if (debugMode) console.log('Link List: Invalid link ID');
        await ncAxiosLinkGet({
          ...validParams,
          urlParams: { ...validParams.urlParams, linkId: 9999 },
          status: 404,
          msg: "Field '9999' not found",
        });

        // Link List: Invalid Source row ID
        if (debugMode) console.log('Link List: Invalid Source row ID');
        await ncAxiosLinkGet({
          ...validParams,
          urlParams: { ...validParams.urlParams, rowId: 9999 },
          status: 404,
          msg: "Record '9999' not found",
        });

        // Query parameter error
        //

        // Link List: Invalid query parameter - negative offset
        if (debugMode)
          console.log('Link List: Invalid query parameter - negative offset');
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, offset: -1 },
          status: 200,
        });

        // Link List: Invalid query parameter - string offset
        if (debugMode)
          console.log('Link List: Invalid query parameter - string offset');
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, offset: 'abcd' },
          status: 200,
        });

        // Link List: Invalid query parameter - offset > total records
        if (debugMode)
          console.log(
            'Link List: Invalid query parameter - offset > total records',
          );
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, offset: 9999 },
          // for BT relation we use btRead so we don't apply offset & limit, also we don't return page info where this check is done
          status: relationType === 'bt' ? 200 : 422,
        });

        // Link List: Invalid query parameter - negative limit
        if (debugMode)
          console.log('Link List: Invalid query parameter - negative limit');
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, limit: -1 },
          status: 200,
        });

        // Link List: Invalid query parameter - string limit
        if (debugMode)
          console.log('Link List: Invalid query parameter - string limit');
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, limit: 'abcd' },
          status: 200,
        });

        // Link List: Invalid query parameter - limit > total records
        if (debugMode)
          console.log(
            'Link List: Invalid query parameter - limit > total records',
          );
        await ncAxiosLinkGet({
          ...validParams,
          query: { ...validParams.query, limit: 9999 },
          status: 200,
        });
      }

      // Error handling (has-many)
      it('Error handling : HM: Nested ADD', async function () {
        const validParams = {
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        };

        await nestedAddTests(validParams);
      });

      it('Error handling : HM: Nested REMOVE', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3],
          status: 200,
        };

        await nestedRemoveTests(validParams);
      });

      it('Error handling : HM: Nested List', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          query: {
            offset: 0,
            limit: 10,
          },
          status: 200,
        };

        await nestedListTests(validParams);
      });

      // Error handling (belongs to)
      it('Error handling : BT: Nested ADD', async function () {
        const validParams = {
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          body: [1],
          status: 200,
        };

        await nestedAddTests(validParams, 'bt');
      });

      it('Error handling : BT: Nested REMOVE', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          body: [1],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          body: [1],
          status: 200,
        };

        await nestedRemoveTests(validParams, 'bt');
      });

      it('Error handling : BT: Nested List', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          query: {
            offset: 0,
            limit: 10,
          },
          status: 200,
        };

        await nestedListTests(validParams, 'bt');
      });

      // Error handling (many-many)
      it('Error handling : MM: Nested ADD', async function () {
        const validParams = {
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        };

        await nestedAddTests(validParams);
      });

      it('Error handling : MM: Nested REMOVE', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3],
          status: 200,
        };

        await nestedRemoveTests(validParams);
      });

      it('Error handling : MM: Nested List', async function () {
        // Prepare data
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          status: 200,
        });

        const validParams = {
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          query: {
            offset: 0,
            limit: 10,
          },
          status: 200,
        };

        await nestedListTests(validParams);
      });
    });

    describe('checkbox', () => {
      let table: Model;
      let columns: Column[] = [];

      beforeEach(async function () {
        const initResult = await beforeEachCheckbox(testContext);
        table = initResult.table;
        columns = initResult.columns;
        urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
      });

      const valueCases = [
        { value: true, expect: true },
        { value: 'true', expect: true },
        { value: 'TRUE', expect: true },
        { value: 'Y', expect: true },
        { value: 'y', expect: true },
        { value: 'YES', expect: true },
        { value: 'yes', expect: true },
        { value: '1', expect: true },
        { value: 1, expect: true },

        { value: false, expect: false },
        { value: 'false', expect: false },
        { value: 'FALSE', expect: false },
        { value: 'N', expect: false },
        { value: 'n', expect: false },
        { value: 'NO', expect: false },
        { value: 'no', expect: false },
        { value: '0', expect: false },
        { value: 0, expect: false },
      ];
      it(`will handle various insert value (single)`, async () => {
        // single
        for (const valueCase of valueCases) {
          const response = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}`,
            body: [
              {
                Checkbox: valueCase.value,
              },
            ],
            status: 200,
          });
          const id = response.body[0]?.Id;
          expect(id).to.greaterThan(0);
          const getResponse = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/${id}`,
            status: 200,
          });
          expect(getResponse.body.Checkbox).to.equal(valueCase.expect);
          const patchResponse = await ncAxiosPatch({
            url: `${urlPrefix}/${table.id}`,
            body: [
              {
                Id: id,
                Checkbox: valueCase.value,
              },
            ],
            status: 200,
          });
          expect(patchResponse.body[0].Id).to.equal(id);
          const listResponse = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}`,
            query: {
              where: `(Id,eq,${id})`,
            },
            status: 200,
          });
          expect(listResponse.body.list[0].Checkbox).to.equal(valueCase.expect);
        }
      });

      it(`will handle various insert value (bulk)`, async () => {
        for (const expectedValue of [true, false]) {
          const expectedValueCases = valueCases.filter(
            (k) => k.expect === expectedValue,
          );
          // bulk
          const recordsToAdd: any[] = [];
          for (const valueCase of expectedValueCases) {
            recordsToAdd.push({
              Checkbox: valueCase.value,
            });
          }
          const bulkPostResponse = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}`,
            body: recordsToAdd,
            status: 200,
          });
          expect(
            bulkPostResponse.body.filter((row) => row.Id > 0).length,
          ).to.equal(recordsToAdd.length);
          const listGet1 = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}`,
            query: {
              where: `(Id,gte,${bulkPostResponse.body[0].Id})`,
            },
            status: 200,
          });
          expect(listGet1.body.list.length).to.equal(recordsToAdd.length);
          const recordToUpdate: any[] = [];
          for (let i = 0; i < expectedValueCases.length; i++) {
            expect(listGet1.body.list[i].Checkbox).to.equal(
              expectedValueCases[i].expect,
            );
            recordToUpdate.push({
              Id: listGet1.body.list[i].Id,
              Checkbox: expectedValueCases[i].value,
            });
          }

          const bulkPatchResponse = await ncAxiosPatch({
            url: `${urlPrefix}/${table.id}`,
            body: recordToUpdate,
            status: 200,
          });

          const listGet2 = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}`,
            query: {
              where: `(Id,gte,${bulkPatchResponse.body[0].Id})`,
            },
            status: 200,
          });
          expect(listGet2.body.list.length).to.equal(recordToUpdate.length);
          for (let i = 0; i < expectedValueCases.length; i++) {
            expect(listGet1.body.list[i].Checkbox).to.equal(
              expectedValueCases[i].expect,
            );
          }
        }
      });
    });
  });
});
