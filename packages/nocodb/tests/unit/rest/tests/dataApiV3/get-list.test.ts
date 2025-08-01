/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import {
  convertMS2Duration,
  isCreatedOrLastModifiedTimeCol,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import {
  createLookupColumn,
  createRollupColumn,
} from '../../../factory/column';
import { createView, updateView } from '../../../factory/view';
import { createTable } from '../../../factory/table';
import { createBulkRows, createBulkRowsV3 } from '../../../factory/row';
import {
  beforeEachNumberBased,
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import { normalizeObject, verifyColumnsInRsp } from './helpers';
import type { ITestContext } from './helpers';
import type { Column, Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

interface ListResult {
  records: any[];
  next?: string;
  prev?: string;
}

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('get-list', () => {
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

    describe('general-based', () => {
      it('get list country with limit 4 and next offset', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            limit: 4,
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.eq(4);

        const nextResponse = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            limit: 4,
            page: 2,
          },
        });
        const nextResult = nextResponse.body as ListResult;
        expect(nextResult.records.length).to.eq(4);
        expect(nextResult.records.map((k) => k.CountryId).sort()).to.not.eq(
          result.records.map((k) => k.CountryId).sort(),
        );
      });

      it('get list country with 1 field', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            fields: 'Country',
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.greaterThan(0);

        // Verify that only the requested field is present in fields
        const firstRecord = result.records[0];
        expect(firstRecord.fields).to.have.property('Country');
        expect(Object.keys(firstRecord.fields)).to.have.length(1);

        // Verify that id is always included for APIv3
        expect(firstRecord).to.have.property('id');
      });

      it('get list country with primary key field included', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            fields: ['CountryId', 'Country'],
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.greaterThan(0);

        // Verify that both requested fields are present
        const firstRecord = result.records[0];
        expect(firstRecord.fields).to.have.property('Country');
        // CountryId might not be included in fields when it's the primary key
        expect(Object.keys(firstRecord.fields)).to.include('Country');

        // Verify that id IS included when primary key is in fields
        expect(firstRecord).to.have.property('id');
      });

      it.skip('get list country with 2 fields on same query param', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            fields: 'CountryId,Country',
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.greaterThan(0);

        // TODO: handle space between fields
        // with space after delimiter
        const nextResponse = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            fields: 'CountryId, Country',
          },
        });
        const nextResult = nextResponse.body as ListResult;
        expect(nextResult.records.length).to.greaterThan(0);
      });

      it('get list country with 2 fields on different query param (array)', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            fields: ['CountryId', 'Country'],
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.greaterThan(0);
      });

      it('get list country with name like Ind', async function () {
        const response = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            filter: '(Country,like,Ind)',
          },
        });
        const result = response.body as ListResult;
        expect(result.records.length).to.greaterThan(0);
        expect(
          result.records.some((k) =>
            k.fields.Country.toLowerCase().startsWith('ind'),
          ),
        ).to.eq(true);
      });

      it('Nested List - Link to another record', async function () {
        const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];
        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.records.length).to.equal(expectedRecords.length);

        const cityList = records.body.records.map(
          (r: any) => r.fields['Cities'],
        );
        expect(cityList).to.deep.equal(expectedRecords);
      });

      it('Nested List - Lookup', async function () {
        await createLookupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Lookup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
        });

        const expectedRecords = [
          ['Kabul'],
          ['Batna', 'Bchar', 'Skikda'],
          ['Tafuna'],
          ['Benguela', 'Namibe'],
          ['South Hill'],
          [
            'Almirante Brown',
            'Avellaneda',
            'Baha Blanca',
            'Crdoba',
            'Escobar',
            'Ezeiza',
            'La Plata',
            'Merlo',
            'Quilmes',
            'San Miguel de Tucumn',
            'Santa F',
            'Tandil',
            'Vicente Lpez',
          ],
          ['Yerevan'],
          ['Woodridge'],
          ['Graz', 'Linz', 'Salzburg'],
          ['Baku', 'Sumqayit'],
        ];

        // read first 10 records
        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.records.length).to.equal(10);

        // extract Lookup column
        const lookupData = records.body.records.map(
          (record: any) => record.fields['Lookup'],
        );
        expect(lookupData).to.deep.equal(expectedRecords);
      });

      it('Nested List - Rollup', async function () {
        await createRollupColumn(testContext.context, {
          base: testContext.sakilaProject,
          title: 'Rollup',
          table: testContext.countryTable,
          relatedTableName: testContext.cityTable.table_name,
          relatedTableColumnTitle: 'City',
          rollupFunction: 'count',
        });

        const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];
        const records = await ncAxiosGet({
          url: `${urlPrefix}/${testContext.countryTable.id}/records`,
          query: {
            limit: 10,
          },
        });
        expect(records.body.records.length).to.equal(expectedRecords.length);
        const rollupData = records.body.records.map(
          (record: any) => record.fields['Rollup'],
        );

        expect(rollupData).to.deep.equal(expectedRecords);
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

      it('List: default', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {},
          status: 200,
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );

        // verify if all the columns are present in the response
        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);

        // verify column data
        const expectedData = insertedRecords.slice(0, 1);
        // compare ignoring property order
        // rsp.body.records only return a part of columns as per specification
        expect(normalizeObject(expectedData[0])).to.contain(
          normalizeObject(rsp.body.records[0].fields),
        );
      });

      it('List: offset, limit', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: { offset: 200, limit: 100 },
          status: 200,
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body).to.have.property('prev');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=4`,
        );
        expect(rsp.body.prev).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );
      });

      it('List: fields, single', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: { fields: 'SingleLineText' },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], [
            { title: 'SingleLineText' },
          ]),
        ).to.equal(true);
      });

      it('List: fields, multiple', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: { fields: ['SingleLineText', 'MultiLineText'] },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], [
            { title: 'SingleLineText' },
            { title: 'MultiLineText' },
          ]),
        ).to.equal(true);
      });

      it('List: sort, ascending', async function () {
        const sortColumn = columns.find((c) => c.title === 'SingleLineText')!;
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            sort: JSON.stringify([
              { direction: 'asc', field: 'SingleLineText' },
            ]),
            limit: 400,
          },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);
        const sortedArray = rsp.body.records.map(
          (r) => r.fields[sortColumn.title],
        );
        expect(sortedArray).to.deep.equal(sortedArray.sort());
      });

      it('List: sort, descending', async function () {
        const sortColumn = columns.find((c) => c.title === 'SingleLineText')!;
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            sort: JSON.stringify([
              { direction: 'desc', field: 'SingleLineText' },
            ]),
            limit: 400,
          },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);
        const descSortedArray = rsp.body.records.map(
          (r) => r.fields[sortColumn.title],
        );
        expect(descSortedArray).to.deep.equal(descSortedArray.sort().reverse());
      });

      it('List: sort, multiple', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            sort: JSON.stringify([
              { direction: 'desc', field: 'SingleLineText' },
              { direction: 'desc', field: 'MultiLineText' },
            ]),
            limit: 400,
          },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);
        // Combination of SingleLineText & MultiLineText should be in descending order
        const sortedArray = rsp.body.records.map(
          (r: any) => r.fields.SingleLineText + r.fields.MultiLineText,
        );
        expect(sortedArray).to.deep.equal(sortedArray.sort().reverse());
      });

      it('List: filter, single', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            where: '(SingleLineText,eq,Afghanistan)',
            limit: 400,
          },
        });

        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);
        const filteredArray = rsp.body.records.map(
          (r: any) => r.fields.SingleLineText,
        );
        expect(filteredArray).to.deep.equal(filteredArray.fill('Afghanistan'));
      });

      it('List: filter, multiple', async function () {
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            where:
              '(SingleLineText,eq,Afghanistan)~and(MultiLineText,eq,"Allahabad, India")',
            limit: 400,
          },
        });
        expect(
          verifyColumnsInRsp(rsp.body.records[0], expectedColumns),
        ).to.equal(true);
        const filteredArray = rsp.body.records.map(
          (r: any) => r.fields.SingleLineText + ' ' + r.fields.MultiLineText,
        );
        expect(filteredArray).to.deep.equal(
          filteredArray.fill('Afghanistan Allahabad, India'),
        );
      });

      it('List: view ID', async function () {
        const gridView = await createView(testContext.context, {
          title: 'grid0',
          table,
          type: ViewTypes.GRID,
        });

        const fk_column_id = columns.find(
          (c) => c.title === 'SingleLineText',
        )!.id;
        await updateView(testContext.context, {
          table,
          view: gridView,
          filter: [
            {
              comparison_op: 'eq',
              fk_column_id,
              logical_op: 'or',
              value: 'Afghanistan',
            },
          ],
        });

        // fetch records from view
        let rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: { viewId: gridView.id },
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?viewId=${gridView.id}&page=2`,
        );

        await updateView(testContext.context, {
          table,
          view: gridView,
          filter: [
            {
              comparison_op: 'eq',
              fk_column_id,
              logical_op: 'or',
              value: 'Austria',
            },
          ],
        });

        // fetch records from view
        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
          },
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?viewId=${gridView.id}&page=2`,
        );

        // use count api to verify since we are not including count in pageInfo
        let countRsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: {
            viewId: gridView.id,
          },
        });
        expect(countRsp.body.count).to.equal(61);

        // Sort by SingleLineText
        await updateView(testContext.context, {
          table,
          view: gridView,
          sort: [
            {
              direction: 'asc',
              fk_column_id,
              push_to_top: true,
            },
          ],
        });

        // fetch records from view
        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
          },
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?viewId=${gridView.id}&page=2`,
        );

        // use count api to verify since we are not including count in pageInfo
        countRsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: {
            viewId: gridView.id,
          },
        });
        expect(countRsp.body.count).to.equal(61);

        // verify sorted order
        // Would contain all 'Afghanistan' as we have 31 records for it
        expect(
          verifyColumnsInRsp(
            rsp.body.records[0],
            columns.filter(
              (c) => !isCreatedOrLastModifiedTimeCol(c) || !c.system,
            ),
          ),
        ).to.equal(true);
        const filteredArray = rsp.body.records.map(
          (r) => r.fields.SingleLineText,
        );
        expect(filteredArray).to.deep.equal(filteredArray.fill('Afghanistan'));

        await updateView(testContext.context, {
          table,
          view: gridView,
          field: ['MultiLineText'],
        });

        // fetch records from view
        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
          },
        });
        const displayColumns = columns.filter(
          (c) =>
            c.title !== 'MultiLineText' &&
            (!isCreatedOrLastModifiedTimeCol(c) || !c.system),
        );
        expect(
          verifyColumnsInRsp(rsp.body.records[0], displayColumns),
        ).to.equal(true);
      });

      async function prepareViewForTests() {
        const gridView = await createView(testContext.context, {
          title: 'grid0',
          table,
          type: ViewTypes.GRID,
        });

        const fk_column_id = columns.find(
          (c) => c.title === 'SingleLineText',
        )!.id;
        await updateView(testContext.context, {
          table,
          view: gridView,
          filter: [
            {
              comparison_op: 'eq',
              fk_column_id,
              logical_op: 'or',
              value: 'Afghanistan',
            },
            {
              comparison_op: 'eq',
              fk_column_id,
              logical_op: 'or',
              value: 'Austria',
            },
          ],
          sort: [
            {
              direction: 'asc',
              fk_column_id,
              push_to_top: true,
            },
          ],
          field: ['MultiLineText', 'Email'],
        });

        // fetch records from view
        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: { viewId: gridView.id },
        });
        const rspCount = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: { viewId: gridView.id },
        });
        expect(rspCount.body.count).to.equal(61);
        const displayColumns = columns.filter(
          (c) =>
            c.title !== 'MultiLineText' &&
            c.title !== 'Email' &&
            !isCreatedOrLastModifiedTimeCol(c),
        );
        expect(
          verifyColumnsInRsp(rsp.body.records[0], displayColumns),
        ).to.equal(true);
        return gridView;
      }

      it('List: view ID + sort', async function () {
        const gridView = await prepareViewForTests();

        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
            sort: JSON.stringify([{ direction: 'asc', field: 'Url' }]),
            limit: 100,
          },
        });
        const displayColumns = columns.filter(
          (c) =>
            c.title !== 'MultiLineText' &&
            c.title !== 'Email' &&
            !isCreatedOrLastModifiedTimeCol(c),
        );

        // limit > count has no next property
        expect(rsp.body).to.not.have.property('next');

        // use count api to verify since we are not including count in pageInfo
        const countRsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: {
            viewId: gridView.id,
          },
        });
        expect(countRsp.body.count).to.equal(61);
        expect(
          verifyColumnsInRsp(rsp.body.records[0], displayColumns),
        ).to.equal(true);
        const sortedArray = rsp.body.records.map((r) => r.fields.Url);
        expect(sortedArray).to.deep.equal(sortedArray.sort());
      });

      it('List: view ID + filter', async function () {
        const gridView = await prepareViewForTests();

        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
            where: '(Phone,eq,1-541-754-3010)',
            limit: 100,
          },
        });
        const displayColumns = columns.filter(
          (c) =>
            c.title !== 'MultiLineText' &&
            c.title !== 'Email' &&
            !isCreatedOrLastModifiedTimeCol(c),
        );

        const rspCount = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: {
            viewId: gridView.id,
            where: '(Phone,eq,1-541-754-3010)',
            limit: 100,
          },
        });
        expect(rspCount.body.count).to.equal(7);
        expect(
          verifyColumnsInRsp(rsp.body.records[0], displayColumns),
        ).to.equal(true);
        const filteredArray = rsp.body.records.map((r) => r.fields.Phone);
        expect(filteredArray).to.deep.equal(
          filteredArray.fill('1-541-754-3010'),
        );
      });

      it('List: view ID + fields', async function () {
        const gridView = await prepareViewForTests();

        const rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: gridView.id,
            fields: ['Phone', 'MultiLineText', 'SingleLineText', 'Email'],
            limit: 100,
          },
        });

        // limit > count has no next property
        expect(rsp.body).to.not.have.property('next');

        // use count api to verify since we are not including count in pageInfo
        const countRsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/count`,
          query: {
            viewId: gridView.id,
          },
        });
        expect(countRsp.body.count).to.equal(61);

        expect(
          verifyColumnsInRsp(rsp.body.records[0], [
            { title: 'Phone' },
            { title: 'SingleLineText' },
          ]),
        ).to.equal(true);
      });

      // #region Error handling
      it('List: invalid ID', async function () {
        // Invalid table ID
        await ncAxiosGet({
          url: `${textBasedUrlPrefix}/123456789/records`,
          status: 422,
        });

        // Invalid view ID
        await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            viewId: '123456789',
          },
          status: 422,
        });
      });

      it('List: invalid limit & offset', async function () {
        let rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            limit: -100,
          },
          status: 200,
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );

        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            limit: 'abc',
          },
          status: 200,
        });
        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );

        // Invalid offset : falls back to default value
        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            offset: -100,
          },
          status: 200,
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );

        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            offset: 'abc',
          },
          status: 200,
        });

        expect(rsp.body).to.have.property('next');
        expect(rsp.body.next).to.include(
          `${textBasedUrlPrefix}/${table.id}/records?page=2`,
        );

        // Offset > totalRows : returns empty list
        rsp = await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            offset: 10000,
          },
          status: 422,
        });
        expect(rsp.body.message).to.equal("Offset value '10000' is invalid");
      });

      it('List: invalid sort, filter, fields', async function () {
        // expect to ignore invalid sort, filter, fields
        await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            sort: JSON.stringify([{ direction: 'asc', field: 'abc' }]),
          },
          status: 422,
        });
        await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            where: 'abc',
          },
          status: 422,
        });
        await ncAxiosGet({
          url: `${textBasedUrlPrefix}/${table.id}/records`,
          query: {
            fields: 'abc',
          },
          status: 422,
        });
      });
      // #endregion error handling
    });

    describe('number-based', () => {
      let table: Model;
      let numberBasedUrlPrefix: string;
      beforeEach(async function () {
        table = await createTable(testContext.context, testContext.base, {
          title: 'numberTable',
          columns: [
            { column_name: 'id', uidt: UITypes.ID, pk: true, title: 'id' },
            { column_name: 'fNumber', uidt: UITypes.Number },
            { column_name: 'f,Decimal', uidt: UITypes.Number },
          ],
        });
        numberBasedUrlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
        await createBulkRowsV3(testContext.context, {
          base: testContext.base,
          table: table,
          values: [
            {
              fNumber: 3,
              'f,Decimal': 3,
            },
            {
              fNumber: 2,
              'f,Decimal': 2,
            },
            {
              fNumber: 1,
              'f,Decimal': 1,
            },
          ],
        });
      });

      it(`get list table with sort and filter`, async () => {
        const response = await ncAxiosGet({
          url: `${numberBasedUrlPrefix}/${table.id}/records`,
          query: {
            limit: 5,
            fields: ['fNumber', 'f,Decimal'],
            sort: JSON.stringify([
              { direction: 'desc', field: 'fNumber' },
              { direction: 'asc', field: 'f,Decimal' },
            ]),
            where: ['(fNumber,eq,1)'],
          },
        });
        expect(response.body.records.length).to.eq(1);
      });
    });
  });
});
