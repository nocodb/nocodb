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
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

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
        // Create a backup of original records for later use
        const originalRecords = JSON.parse(JSON.stringify(records));

        // list 10 records
        let rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            limit: 10,
            fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
          },
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${urlPrefix}/${table.id}/records?page=2`,
        );
        expect(rsp.body.records).to.deep.equal(
          records.map((record) => {
            const { Id, ...fields } = record;
            return {
              id: Id,
              fields,
            };
          }),
        );

        ///////////////////////////////////////////////////////////////////////////

        // insert 10 records
        // remove Id's from record array
        records.forEach((r) => delete r.Id);
        rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: records.map((record) => {
            // Ensure Id is not in fields even if it somehow exists
            const { Id, ...fields } = record;
            return {
              fields,
            };
          }),
        });

        // APIv3 insert returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(10);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', 401 + index);
          expect(record).to.have.property('fields');
        });

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 401
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/401`,
          query: {
            fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
          },
        });

        // Use the original record data instead of the modified records array
        const { Id, ...firstRecordFields } = originalRecords[0];

        // Handle the case where the response might be null/undefined
        if (!rsp || !rsp.body) {
          throw new Error('Response or response body is null/undefined');
        }

        expect(rsp.body).to.deep.equal({
          id: 401,
          fields: firstRecordFields,
        });

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

        const updatedRecords = [401, 402, 403, 404].map((id) => ({
          id,
          fields: { ...updatedRecord },
        }));

        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords,
        });
        // APIv3 update returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(updatedRecords.length);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', updatedRecords[index].id);
          expect(record).to.have.property('fields');
          expect(record.fields).to.include(updatedRecords[index].fields);
        });

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 401 to 404
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords.map((record) => ({ id: record.id })),
        });
        expect(rsp.body.records).to.deep.equal(
          updatedRecords.map((record) => ({
            id: record.id,
            deleted: true,
          })),
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
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            limit: 10,
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${urlPrefix}/${table.id}/records?page=2`,
        );
        expect(rsp.body.records).to.deep.equal(
          recordsV3.map((record) => {
            const { Id, ...fields } = record;
            return {
              id: Id,
              fields,
            };
          }),
        );

        ///////////////////////////////////////////////////////////////////////////

        // insert 10 records
        // remove Id's from record array
        records.forEach((r) => delete r.Id);
        recordsV3.forEach((r) => delete r.Id);

        rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: recordsV3.map((record) => {
            // Ensure Id is not in fields even if it somehow exists
            const { Id, ...fields } = record;
            return {
              fields,
            };
          }),
        });

        // APIv3 insert returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(10);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', 401 + index);
          expect(record).to.have.property('fields');
        });

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 401
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/401`,
          query: {
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        const firstRecordV3 = recordsV3[0] || {};
        const { Id: firstId, ...firstRecordFields } = firstRecordV3;
        expect(rsp.body).to.deep.equal({
          id: 401,
          fields: firstRecordFields,
        });

        ///////////////////////////////////////////////////////////////////////////

        // update record with Id 401 to 404
        const updatedRecord = {
          SingleSelect: 'jan',
          MultiSelect: ['jan', 'feb', 'mar'],
        };
        const updatedRecords = [401, 402, 403, 404].map((id) => ({
          id,
          fields: { ...updatedRecord },
        }));
        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords,
        });
        // APIv3 update returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(updatedRecords.length);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', updatedRecords[index].id);
          expect(record).to.have.property('fields');
          // Use specific field comparisons for select fields to handle arrays properly
          expect(record.fields.SingleSelect).to.equal(
            updatedRecords[index].fields.SingleSelect,
          );
          expect(JSON.stringify(record.fields.MultiSelect)).to.equal(
            JSON.stringify(updatedRecords[index].fields.MultiSelect),
          );
        });

        // verify updated records
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            limit: 10,
            offset: 400,
            fields: 'Id,SingleSelect,MultiSelect',
          },
        });
        // APIv3 verify updated records with flexible array comparison
        const actualRecords = rsp.body.records.slice(0, 4);
        expect(actualRecords).to.have.lengthOf(updatedRecords.length);
        actualRecords.forEach((record, index) => {
          expect(record).to.have.property('id', updatedRecords[index].id);
          expect(record).to.have.property('fields');
          expect(record.fields.SingleSelect).to.equal(
            updatedRecords[index].fields.SingleSelect,
          );
          // Use deep equality for MultiSelect array comparison
          expect(JSON.stringify(record.fields.MultiSelect)).to.equal(
            JSON.stringify(updatedRecords[index].fields.MultiSelect),
          );
        });

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 401 to 404
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords.map((record) => ({ id: record.id })),
        });
        expect(rsp.body.records).to.deep.equal(
          updatedRecords.map((record) => ({
            id: record.id,
            deleted: true,
          })),
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
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            limit: 10,
          },
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${urlPrefix}/${table.id}/records?page=2`,
        );

        // extract first 10 records from inserted records
        const records = insertedRecords.slice(0, 10);
        rsp.body.records.forEach((record: any, index: number) => {
          // Create expected record in new format for comparison
          const { Id, ...expectedFields } = records[index];
          expect(record.id).to.equal(Id);
          expect(record.fields).to.include(expectedFields);
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
          url: `${urlPrefix}/${table.id}/records`,
          body: records.map((record) => ({ fields: record })),
        });

        // APIv3 insert returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(10);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', 801 + index);
          expect(record).to.have.property('fields');
        });

        ///////////////////////////////////////////////////////////////////////////

        // read record with Id 801
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records/801`,
          query: {
            fields: 'Id,Date,DateTime',
          },
        });
        expect(rsp.body).to.deep.equal({
          id: 801,
          fields: {
            Date: records[0].Date,
            DateTime: records[0].DateTime,
          },
        });

        ///////////////////////////////////////////////////////////////////////////

        // update record with Id 801 to 804
        const updatedRecord = {
          Date: '2022-04-25',
          DateTime: '2022-04-25 08:30:00+00:00',
        };
        const updatedRecords = [801, 802, 803, 804].map((id) => ({
          id,
          fields: updatedRecord,
        }));
        rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords,
        });
        // APIv3 update returns full records with fields
        expect(rsp.body.records).to.have.lengthOf(updatedRecords.length);
        rsp.body.records.forEach((record, index) => {
          expect(record).to.have.property('id', updatedRecords[index].id);
          expect(record).to.have.property('fields');
          expect(record.fields).to.include(updatedRecords[index].fields);
        });

        // verify updated records
        rsp = await ncAxiosGet({
          url: `${urlPrefix}/${table.id}/records`,
          query: {
            limit: 10,
            offset: 800,
            fields: 'Id,Date,DateTime',
          },
        });
        expect(rsp.body.records.slice(0, 4)).to.deep.equal(updatedRecords);

        ///////////////////////////////////////////////////////////////////////////

        // delete record with ID 801 to 804
        rsp = await ncAxiosDelete({
          url: `${urlPrefix}/${table.id}/records`,
          body: updatedRecords.map((record) => ({ id: record.id })),
        });
        expect(rsp.body.records).to.deep.equal(
          updatedRecords.map((record) => ({
            id: record.id,
            deleted: true,
          })),
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
          body: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
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
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        // low record count list has no next
        expect(rspFromRecordAPI.body).not.to.have.property('next');

        let citiesExpected = [
          { id: 1, fields: { City: 'City 1' } },
          { id: 2, fields: { City: 'City 2' } },
          { id: 3, fields: { City: 'City 3' } },
          { id: 4, fields: { City: 'City 4' } },
          { id: 5, fields: { City: 'City 5' } },
        ];

        // links
        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);

        expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.records[0].fields['Cities']).to.be.eq(5);
        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);

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
            url: `${urlPrefix}/${tblCity.id}/records`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i <= 5) {
            expect(rspFromLinkAPI.body.record).to.deep.equal({
              id: 1,
              fields: { Country: `Country 1` },
            });

            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(
              rspFromRecordAPI.body.records[0].fields['Country'],
            ).to.deep.eq({
              id: 1,
              fields: { Country: `Country 1` },
            });
          } else {
            expect(rspFromLinkAPI.body.record || {}).to.deep.equal({});
            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.records[0].fields['Country']).to.be.eq(
              null,
            );
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
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        citiesExpected = [
          { id: 1, fields: { City: 'City 1' } },
          { id: 2, fields: { City: 'City 2' } },
          { id: 3, fields: { City: 'City 3' } },
          { id: 4, fields: { City: 'City 4' } },
          { id: 5, fields: { City: 'City 5' } },
          { id: 6, fields: { City: 'City 6' } },
          { id: 7, fields: { City: 'City 7' } },
        ];

        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);

        expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.records[0].fields['Cities']).to.be.eq(7);
        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);

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
            url: `${urlPrefix}/${tblCity.id}/records`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i <= 7) {
            expect(rspFromLinkAPI.body.record).to.deep.equal({
              id: 1,
              fields: { Country: `Country 1` },
            });

            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(
              rspFromRecordAPI.body.records[0].fields['Country'],
            ).to.deep.eq({
              id: 1,
              fields: { Country: `Country 1` },
            });
          } else {
            expect(rspFromLinkAPI.body.record || {}).to.deep.equal({});
            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.records[0].fields['Country']).to.be.eq(
              null,
            );
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
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        citiesExpected = [
          { id: 2, fields: { City: 'City 2' } },
          { id: 4, fields: { City: 'City 4' } },
          { id: 6, fields: { City: 'City 6' } },
        ];
        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);

        expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
        expect(rspFromRecordAPI.body.records[0].fields['Cities']).to.be.eq(3);
        expect(rspFromLinkAPI.body.records).to.deep.equal(citiesExpected);
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
            url: `${urlPrefix}/${tblCity.id}/records`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });

          if (i % 2 === 0 && i <= 6) {
            expect(rspFromLinkAPI.body.record).to.deep.equal({
              id: 1,
              fields: { Country: `Country 1` },
            });

            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(
              rspFromRecordAPI.body.records[0].fields['Country'],
            ).to.deep.eq({
              id: 1,
              fields: { Country: `Country 1` },
            });
          } else {
            expect(rspFromLinkAPI.body.record || {}).to.deep.equal({});
            expect(rspFromRecordAPI.body.records.length).to.be.eq(1);
            expect(rspFromRecordAPI.body.records[0].fields['Country']).to.be.eq(
              null,
            );
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
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
            { id: 5 },
            { id: 6 },
            { id: 7 },
            { id: 8 },
            { id: 9 },
            { id: 10 },
            { id: 11 },
            { id: 12 },
            { id: 13 },
            { id: 14 },
            { id: 15 },
            { id: 16 },
            { id: 17 },
            { id: 18 },
            { id: 19 },
            { id: 20 },
          ],
        });
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblFilm.id,
            linkId: getColumnId(columnsFilm, 'Actors'),
            rowId: '1',
          },
          body: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
            { id: 5 },
            { id: 6 },
            { id: 7 },
            { id: 8 },
            { id: 9 },
            { id: 10 },
            { id: 11 },
            { id: 12 },
            { id: 13 },
            { id: 14 },
            { id: 15 },
            { id: 16 },
            { id: 17 },
            { id: 18 },
            { id: 19 },
            { id: 20 },
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
          url: `${urlPrefix}/${tblActor.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(rspFromRecordAPI.body).not.to.have.property('next');

        const expectedFilmsFromLinkAPI = prepareRecords('Film', 20).map(
          (record) => ({
            id: record.Id,
            fields: { Film: record.Film },
          }),
        );

        // Links
        expect(rspFromLinkAPI.body.records.length).to.equal(20);
        expect(rspFromLinkAPI.body.records.sort(idc)).to.deep.equal(
          expectedFilmsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.records.length).to.equal(1);
        expect(rspFromRecordAPI.body.records[0].fields['Films']).to.equal(20);

        // verify in Film table
        rspFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblFilm.id,
            linkId: getColumnId(columnsFilm, 'Actors'),
            rowId: '1',
          },
        });
        rspFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblFilm.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        const expectedActorsFromLinkAPI = prepareRecords('Actor', 20).map(
          (record) => ({
            id: record.Id,
            fields: { Actor: record.Actor },
          }),
        );

        // Links
        expect(rspFromLinkAPI.body.records.length).to.equal(20);
        expect(rspFromLinkAPI.body.records.sort(idc)).to.deep.equal(
          expectedActorsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.records.length).to.equal(1);
        expect(rspFromRecordAPI.body.records[0].fields['Actors']).to.equal(20);

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
        expectedFilmsFromLinkAPI.push(
          ...prepareRecords('Film', 5, 21).map((record) => ({
            id: record.Id,
            fields: { Film: record.Film },
          })),
        );

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
          url: `${urlPrefix}/${tblActor.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });
        expect(rspFromLinkAPI.body.records.length).to.equal(25);
        // We cannot compare list directly since order is not fixed, any 25, out of 30 can come.
        // expect(rspFromLinkAPI.body.records.sort(idc)).to.deep.equal(expectedFilmsFromLinkAPI.sort(idc));

        expect(rspFromRecordAPI.body.records.length).to.equal(1);
        expect(rspFromRecordAPI.body.records[0].fields['Films']).to.equal(30);

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
            url: `${urlPrefix}/${tblFilm.id}/records`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });
          expect(rspFromLinkAPI.body.records.length).to.equal(1);
          expect(rspFromLinkAPI.body.records[0]).to.deep.equal({
            id: 1,
            fields: {
              Actor: `Actor 1`,
            },
          });

          expect(rspFromRecordAPI.body.records.length).to.equal(1);
          expect(rspFromRecordAPI.body.records[0].fields['Actors']).to.equal(1);
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
            { id: 1 },
            { id: 3 },
            { id: 5 },
            { id: 7 },
            { id: 9 },
            { id: 11 },
            { id: 13 },
            { id: 15 },
            { id: 17 },
            { id: 19 },
            { id: 21 },
            { id: 23 },
            { id: 25 },
            { id: 27 },
            { id: 29 },
          ],
        });

        expectedFilmsFromLinkAPI.length = 0; // clear array
        const expectedFilmsFromRecordV3API: { Id: number; Value: string }[] =
          []; // clear array
        for (let i = 2; i <= 30; i += 2) {
          expectedFilmsFromLinkAPI.push({
            id: i,
            fields: { Film: `Film ${i}` },
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
          url: `${urlPrefix}/${tblActor.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(rspFromLinkAPI.body.records.length).to.equal(
          expectedFilmsFromLinkAPI.length,
        );
        expect(rspFromLinkAPI.body.records.sort(idc)).to.deep.equal(
          expectedFilmsFromLinkAPI.sort(idc),
        );

        expect(rspFromRecordAPI.body.records.length).to.equal(1);
        expect(rspFromRecordAPI.body.records[0].fields['Films']).to.equal(
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
            url: `${urlPrefix}/${tblFilm.id}/records`,
            query: {
              where: `(Id,eq,${i})`,
            },
          });
          if (i % 2 === 0) {
            expect(rspFromLinkAPI.body.records.length).to.equal(1);
            expect(rspFromLinkAPI.body.records[0]).to.deep.equal({
              id: 1,
              fields: {
                Actor: `Actor 1`,
              },
            });

            expect(rspFromRecordAPI.body.records.length).to.equal(1);
            expect(rspFromRecordAPI.body.records[0].fields['Actors']).to.equal(
              1,
            );
          } else {
            expect(rspFromLinkAPI.body.records.length).to.equal(0);
            expect(rspFromRecordAPI.body.records.length).to.equal(1);
            expect(rspFromRecordAPI.body.records[0].fields['Actors']).to.equal(
              0,
            );
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
          body: [{ id: 1 }, { id: 2 }, { id: 3 }],
        });

        // update the link
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '2',
          },
          body: [{ id: 2 }, { id: 3 }],
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
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: `(Id,eq,1)`,
          },
        });

        expect(respFromLinkAPI.body.records.length).to.equal(1);
        expect(respFromLinkAPI.body.records[0]).to.deep.equal({
          id: 1,
          fields: { City: 'City 1' },
        });

        expect(respFromRecordAPI.body.records.length).to.eq(1);
        expect(respFromRecordAPI.body.records[0].fields['Cities']).to.eq(1);

        respFromLinkAPI = await ncAxiosLinkGet({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '2',
          },
        });
        respFromRecordAPI = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: `(Id,eq,2)`,
          },
        });

        expect(respFromLinkAPI.body.records.length).to.equal(2);
        expect(respFromLinkAPI.body.records.sort(idc)).to.deep.equal(
          [
            { id: 2, fields: { City: 'City 2' } },
            { id: 3, fields: { City: 'City 3' } },
          ].sort(idc),
        );

        expect(respFromRecordAPI.body.records.length).to.eq(1);
        expect(respFromRecordAPI.body.records[0].fields['Cities']).to.eq(2);
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
        expect(rsp.body.records.length).to.equal(10);
        expect(rsp.body.records).to.deep.equal([
          { id: 1, fields: { City: 'City 1' } },
          { id: 2, fields: { City: 'City 2' } },
          { id: 3, fields: { City: 'City 3' } },
          { id: 4, fields: { City: 'City 4' } },
          { id: 5, fields: { City: 'City 5' } },
          { id: 6, fields: { City: 'City 6' } },
          { id: 7, fields: { City: 'City 7' } },
          { id: 8, fields: { City: 'City 8' } },
          { id: 9, fields: { City: 'City 9' } },
          { id: 10, fields: { City: 'City 10' } },
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
        expect(rsp.body.records.length).to.equal(10);
        expect(rsp.body.records).to.deep.equal([
          { id: 6, fields: { City: 'City 6' } },
          { id: 7, fields: { City: 'City 7' } },
          { id: 8, fields: { City: 'City 8' } },
          { id: 9, fields: { City: 'City 9' } },
          { id: 10, fields: { City: 'City 10' } },
          { id: 11, fields: { City: 'City 11' } },
          { id: 12, fields: { City: 'City 12' } },
          { id: 13, fields: { City: 'City 13' } },
          { id: 14, fields: { City: 'City 14' } },
          { id: 15, fields: { City: 'City 15' } },
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
        expect(rsp.body.records.length).to.equal(5);
        expect(rsp.body.records).to.deep.equal([
          { id: 46, fields: { City: 'City 46' } },
          { id: 47, fields: { City: 'City 47' } },
          { id: 48, fields: { City: 'City 48' } },
          { id: 49, fields: { City: 'City 49' } },
          { id: 50, fields: { City: 'City 50' } },
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
        console.log('response', response.body);

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
        urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
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
            url: `${urlPrefix}/${table.id}/records`,
            body: [
              {
                fields: {
                  Checkbox: valueCase.value,
                },
              },
            ],
            status: 200,
          });
          const id = response.body.records[0]?.id;
          expect(id).to.greaterThan(0);
          const getResponse = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/records/${id}`,
            status: 200,
          });
          expect(getResponse.body.fields.Checkbox).to.equal(valueCase.expect);
          const patchResponse = await ncAxiosPatch({
            url: `${urlPrefix}/${table.id}/records`,
            body: [
              {
                id: id,
                fields: {
                  Checkbox: valueCase.value,
                },
              },
            ],
            status: 200,
          });
          expect(patchResponse.body.records[0].id).to.equal(id);
          const listResponse = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/records`,
            query: {
              where: `(Id,eq,${id})`,
            },
            status: 200,
          });
          expect(listResponse.body.records[0].fields.Checkbox).to.equal(
            valueCase.expect,
          );
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
              fields: {
                Checkbox: valueCase.value,
              },
            });
          }
          const bulkPostResponse = await ncAxiosPost({
            url: `${urlPrefix}/${table.id}/records`,
            body: recordsToAdd,
            status: 200,
          });
          expect(
            bulkPostResponse.body.records.filter((row) => row.id > 0).length,
          ).to.equal(recordsToAdd.length);
          const listGet1 = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/records`,
            query: {
              where: `(Id,gte,${bulkPostResponse.body.records[0].id})`,
            },
            status: 200,
          });
          expect(listGet1.body.records.length).to.equal(recordsToAdd.length);
          const recordToUpdate: any[] = [];
          for (let i = 0; i < expectedValueCases.length; i++) {
            expect(listGet1.body.records[i].fields.Checkbox).to.equal(
              expectedValueCases[i].expect,
            );
            recordToUpdate.push({
              id: listGet1.body.records[i].id,
              fields: {
                Checkbox: expectedValueCases[i].value,
              },
            });
          }

          const bulkPatchResponse = await ncAxiosPatch({
            url: `${urlPrefix}/${table.id}/records`,
            body: recordToUpdate,
            status: 200,
          });

          const listGet2 = await ncAxiosGet({
            url: `${urlPrefix}/${table.id}/records`,
            query: {
              where: `(Id,gte,${bulkPatchResponse.body.records[0].id})`,
            },
            status: 200,
          });
          expect(listGet2.body.records.length).to.equal(recordToUpdate.length);
          for (let i = 0; i < expectedValueCases.length; i++) {
            expect(listGet1.body.records[i].fields.Checkbox).to.equal(
              expectedValueCases[i].expect,
            );
          }
        }
      });
    });
  });
});
