/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { convertMS2Duration } from 'nocodb-sdk';
import {
  beforeEachNumberBased,
  beforeEachSelectBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { Column, Model } from '../../../../../src/models';
import type { ITestContext } from './beforeEach';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('list-and-crud', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext.context);
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
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

      // TODO: skipped for now, v3 CRUD api is not ordered by db rows
      it.skip('Number based- List & CRUD', async function () {
        // list 10 records
        let rsp = await testAxios.ncAxiosGet({
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
        rsp = await testAxios.ncAxiosPost({
          url: `${urlPrefix}/${table.id}`,
          body: records.map((k) => ({
            ...k,
            Duration: convertMS2Duration(k.Duration, 0),
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
        rsp = await testAxios.ncAxiosGet({
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
        rsp = await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords,
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );

        // verify updated records
        rsp = await testAxios.ncAxiosGet({
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
        rsp = await testAxios.ncAxiosDelete({
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
        MultiSelect: r.MultiSelect?.split(','),
      }));

      // TODO: skipped for now, v3 return undefined instead of null
      // need to investigate first
      it.skip('Select based- List & CRUD', async function () {
        // list 10 records
        let rsp = await testAxios.ncAxiosGet({
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

        rsp = await testAxios.ncAxiosPost({
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
        rsp = await testAxios.ncAxiosGet({
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
        rsp = await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords,
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );

        // verify updated records
        rsp = await testAxios.ncAxiosGet({
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
        rsp = await testAxios.ncAxiosDelete({
          url: `${urlPrefix}/${table.id}`,
          body: updatedRecords.map((record) => ({ Id: record.Id })),
        });
        expect(rsp.body).to.deep.equal(
          updatedRecords.map((record) => ({ Id: record.Id })),
        );
      });
    });
  });
});
