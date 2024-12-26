/**
 * Records List
 *  - default
 *  - pageSize
 *  - limit
 *  - offset
 *  - fields, single
 *  - fields, multiple
 *  - sort, ascending
 *  - sort, descending
 *  - sort, multiple
 *  - filter, single
 *  - filter, multiple
 *  - field type : number based (number, currency, percent, decimal, rating, duration)
 *  - field type : text based (text, longtext, email, phone, url)
 *  - field type : select based (single select, multi select)
 *  - field type : date based (date, datetime, time)
 *  - field type : virtual (link, lookup, rollup, formula)
 *  - field type : misc (checkbox, attachment, barcode, qrcode, json)
 *  - viewID
 *  - viewID, explicit fields
 *  - viewID, explicit sort
 *  - viewID, explicit filter
 *  # Error handling
 *    - invalid table ID
 *    - invalid view ID
 *    - invalid field name
 *    - invalid sort condition
 *    - invalid filter condition
 *    - invalid pageSize
 *    - invalid limit
 *    - invalid offset
 *
 *
 * Records Create
 *  - field type : number based (number, currency, percent, decimal, rating, duration)
 *  - field type : text based (text, longtext, email, phone, url)
 *  - field type : select based (single select, multi select)
 *  - field type : date based (date, datetime, time)
 *  - field type : virtual (link)
 *  - field type : misc (checkbox, attachment, barcode, qrcode, json)
 *  - bulk insert
 *  - bulk insert-all
 *  # Error handling
 *    - invalid table ID
 *    - invalid field type
 *    - invalid field value (when validation enabled : email, url, phone number, rating, select fields, text fields, number fields, date fields)
 *    - invalid payload size
 *
 *
 * Record read
 *  - field type : number based (number, currency, percent, decimal, rating, duration)
 *  - field type : text based (text, longtext, email, phone, url)
 *  - field type : select based (single select, multi select)
 *  - field type : date based (date, datetime, time)
 *  - field type : virtual (link, lookup, rollup, formula)
 *  - field type : misc (checkbox, attachment, barcode, qrcode, json)
 *  # Error handling
 *    - invalid table ID
 *    - invalid record ID
 *
 *
 * Record update
 * - field type : number based (number, currency, percent, decimal, rating, duration)
 * - field type : text based (text, longtext, email, phone, url)
 * - field type : select based (single select, multi select)
 * - field type : date based (date, datetime, time)
 * - field type : virtual (link)
 * - field type : misc (checkbox, attachment, barcode, qrcode, json)
 * - bulk update
 * - bulk update-all
 * # Error handling
 *    - invalid table ID
 *    - invalid record ID
 *
 * Record delete
 * - default
 * - bulk delete
 * # Error handling
 *    - invalid table ID
 *    - invalid record ID
 */

import 'mocha';
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isOrderCol,
  UITypes,
  ViewTypes,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import { createTable, getTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import {
  createLookupColumn,
  createLtarColumn,
  createRollupColumn,
  customColumns,
} from '../../factory/column';
import { createView, updateView } from '../../factory/view';

import { isPg } from '../../init/db';
import { defaultUserArgs } from '../../factory/user';
import type { ColumnType } from 'nocodb-sdk';
import type Base from '~/models/Base';
import type Model from '../../../../src/models/Model';

const debugMode = false;

let context;
let ctx: {
  workspace_id: string;
  base_id: string;
};
let sakilaCtx: {
  workspace_id: string;
  base_id: string;
};
let base: Base;
let table: Model;
let columns: any[];
let insertedRecords: any[] = [];

let sakilaProject: Base;
let customerTable: Model;
let customerColumns;
let actorTable: Model;
let actorColumns;
let countryTable: Model;
let countryColumns;
let cityTable: Model;
let cityColumns;

// Optimisation scope for time reduction
// 1. BeforeEach can be changed to BeforeAll for List and Read APIs

///////////////////////////////////////////////////////////////////////////////
// Utility routines

const verifyColumnsInRsp = (row, columns: ColumnType[]) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const expectedColumnsListStr = columns
    .filter((c) => !(c.system && isCreatedOrLastModifiedByCol(c) || isOrderCol(c)))
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === expectedColumnsListStr;
};

async function ncAxiosGet({
  url = `/api/v2/tables/${table.id}/records`,
  query = {},
  status = 200,
}: { url?: string; query?: any; status?: number } = {}) {
  const response = await request(context.app)
    .get(url)
    .set('xc-auth', context.token)
    .query(query)
    .send({});
  expect(response.status).to.equal(status);
  return response;
}

async function ncAxiosPost({
  url = `/api/v2/tables/${table.id}/records`,
  body = {},
  status = 200,
  query = {},
}: { url?: string; body?: any; status?: number; query?: any } = {}) {
  const response = await request(context.app)
    .post(url)
    .set('xc-auth', context.token)
    .query(query)
    .send(body);
  expect(response.status).to.equal(status);
  return response;
}

async function ncAxiosPatch({
  url = `/api/v2/tables/${table.id}/records`,
  body = {},
  status = 200,
}: { url?: string; body?: any; status?: number } = {}) {
  const response = await request(context.app)
    .patch(url)
    .set('xc-auth', context.token)
    .send(body);
  expect(response.status).to.equal(status);
  return response;
}

async function ncAxiosDelete({
  url = `/api/v2/tables/${table.id}/records`,
  body = {},
  status = 200,
}: { url?: string; body?: any; status?: number } = {}) {
  const response = await request(context.app)
    .delete(url)
    .set('xc-auth', context.token)
    .send(body);
  expect(response.status).to.equal(status);
  return response;
}

///////////////////////////////////////////////////////////////////////////////

async function ncAxiosLinkGet({
  urlParams: { tableId, linkId, rowId },
  query = {},
  status = 200,
  msg,
}: { urlParams?: any; query?: any; status?: number; msg?: string } = {}) {
  const urlParams = { tableId, linkId, rowId };
  const url = `/api/v2/tables/${urlParams.tableId}/links/${urlParams.linkId}/records/${urlParams.rowId}`;
  const response = await request(context.app)
    .get(url)
    .set('xc-auth', context.token)
    .query(query)
    .send({});
  if (debugMode && status !== response.status)
    console.log('#### expected', status, 'received', response.status);
  else expect(response.status).to.equal(status);

  // print error codes
  if (debugMode && status !== 200) {
    console.log('#### ', response.body.message || response.body.msg);
  }
  if (!debugMode && msg)
    expect(response.body.message || response.body.msg).to.equal(msg);

  return response;
}

async function ncAxiosLinkAdd({
  urlParams: { tableId, linkId, rowId },
  body = {},
  status = 201,
  msg,
}: { urlParams?: any; body?: any; status?: number; msg?: string } = {}) {
  const urlParams = { tableId, linkId, rowId };
  const url = `/api/v2/tables/${urlParams.tableId}/links/${urlParams.linkId}/records/${urlParams.rowId}`;
  const response = await request(context.app)
    .post(url)
    .set('xc-auth', context.token)
    .send(body);

  if (debugMode && status !== response.status)
    console.log('#### expected', status, 'received', response.status);
  else expect(response.status).to.equal(status);

  // print error codes
  if (debugMode && status !== 201) {
    console.log('#### ', response.body.message || response.body.msg);
  }

  if (!debugMode && msg)
    expect(response.body.message || response.body.msg).to.equal(msg);

  return response;
}

async function ncAxiosLinkRemove({
  urlParams: { tableId, linkId, rowId },
  body = {},
  status = 200,
  msg,
}: { urlParams?: any; body?: any; status?: number; msg?: string } = {}) {
  const urlParams = { tableId, linkId, rowId };
  const url = `/api/v2/tables/${urlParams.tableId}/links/${urlParams.linkId}/records/${urlParams.rowId}`;
  const response = await request(context.app)
    .delete(url)
    .set('xc-auth', context.token)
    .send(body);
  if (debugMode && status !== response.status)
    console.log('#### expected', status, 'received', response.status);
  else expect(response.status).to.equal(status);

  // print error codes
  if (debugMode && status !== 200) {
    console.log('#### ', response.body.message || response.body.msg);
  }
  if (!debugMode && msg)
    expect(response.body.message || response.body.msg).to.equal(msg);

  return response;
}

///////////////////////////////////////////////////////////////////////////////
// generic table, sakila based
function generalDb() {
  beforeEach(async function () {
    context = await init();

    sakilaProject = await createSakilaProject(context);
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    sakilaCtx = {
      workspace_id: sakilaProject.fk_workspace_id,
      base_id: sakilaProject.id,
    };

    customerTable = await getTable({
      base: sakilaProject,
      name: 'customer',
    });
    customerColumns = await customerTable.getColumns(sakilaCtx);

    actorTable = await getTable({
      base: sakilaProject,
      name: 'actor',
    });
    actorColumns = await actorTable.getColumns(sakilaCtx);

    countryTable = await getTable({
      base: sakilaProject,
      name: 'country',
    });
    countryColumns = await countryTable.getColumns(sakilaCtx);

    cityTable = await getTable({
      base: sakilaProject,
      name: 'city',
    });
    cityColumns = await cityTable.getColumns(sakilaCtx);
  });

  it('Nested List - Link to another record', async function () {
    const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];

    // read first 4 records
    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records`,
      query: {
        limit: 10,
      },
    });
    expect(records.body.list.length).to.equal(10);

    // extract LTAR column "City List"
    const cityList = records.body.list.map((r) => r['Cities']);
    expect(cityList).to.deep.equal(expectedRecords);
  });

  it('Nested List - Lookup', async function () {
    const lookupColumn = await createLookupColumn(context, {
      base: sakilaProject,
      title: 'Lookup',
      table: countryTable,
      relatedTableName: cityTable.table_name,
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

    // read first 4 records
    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records`,
      query: {
        limit: 10,
      },
    });
    expect(records.body.list.length).to.equal(10);

    // extract Lookup column
    const lookupData = records.body.list.map((record) => record.Lookup);
    expect(lookupData).to.deep.equal(expectedRecords);
  });

  it('Nested List - Rollup', async function () {
    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
      title: 'Rollup',
      table: countryTable,
      relatedTableName: cityTable.table_name,
      relatedTableColumnTitle: 'City',
      rollupFunction: 'count',
    });

    const expectedRecords = [1, 3, 1, 2, 1, 13, 1, 1, 3, 2];

    // read first 4 records
    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records`,
      query: {
        limit: 10,
      },
    });
    expect(records.body.list.length).to.equal(10);

    // extract Lookup column
    const rollupData = records.body.list.map((record) => record.Rollup);

    expect(rollupData).to.deep.equal(expectedRecords);
  });

  it('Nested Read - Link to another record', async function () {
    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records/1`,
    });

    // extract LTAR column "City List"
    expect(+records.body['Cities']).to.equal(1);
  });

  it('Nested Read - Lookup', async function () {
    const lookupColumn = await createLookupColumn(context, {
      base: sakilaProject,
      title: 'Lookup',
      table: countryTable,
      relatedTableName: cityTable.table_name,
      relatedTableColumnTitle: 'City',
    });

    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records/1`,
    });
    expect(records.body.Lookup).to.deep.equal(['Kabul']);
  });

  it('Nested Read - Rollup', async function () {
    const rollupColumn = await createRollupColumn(context, {
      base: sakilaProject,
      title: 'Rollup',
      table: countryTable,
      relatedTableName: cityTable.table_name,
      relatedTableColumnTitle: 'City',
      rollupFunction: 'count',
    });

    const records = await ncAxiosGet({
      url: `/api/v2/tables/${countryTable.id}/records/1`,
    });

    expect(records.body.Rollup).to.equal(1);
  });
}

function textBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init(false);
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base, {
      table_name: 'textBased',
      title: 'TextBased',
      columns: customColumns('textBased'),
    });

    // retrieve column meta
    columns = await table.getColumns(ctx);

    // build records
    const rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      const row = {
        SingleLineText: rowMixedValue(columns[1], i),
        MultiLineText: rowMixedValue(columns[2], i),
        Email: rowMixedValue(columns[3], i),
        Phone: rowMixedValue(columns[4], i),
        Url: rowMixedValue(columns[5], i),
      };
      rowAttributes.push(row);
    }

    // insert records
    // creating bulk records using older set of APIs
    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });

    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(insertedRecords.length).to.equal(400);
  });

  /////////////////////////////////////////////////////////////////////////////

  // LIST
  //

  /////////////////////////////////////////////////////////////////////////////

  it('List: default', async function () {
    const rsp = await ncAxiosGet();

    const expectedPageInfo = {
      totalRows: 400,
      page: 1,
      pageSize: 25,
      isFirstPage: true,
      isLastPage: false,
    };
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);

    // verify if all the columns are present in the response
    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);

    // verify column data
    const expectedData = insertedRecords.slice(0, 1);
    expect(JSON.stringify(rsp.body.list[0])).to.deep.equal(
      JSON.stringify(expectedData[0]),
    );
  });

  it('List: offset, limit', async function () {
    const rsp = await ncAxiosGet({ query: { offset: 200, limit: 100 } });

    const expectedPageInfo = {
      totalRows: 400,
      page: 3,
      pageSize: 100,
      isFirstPage: false,
      isLastPage: false,
    };
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);
  });

  it('List: fields, single', async function () {
    const rsp = await ncAxiosGet({
      query: { fields: 'SingleLineText' },
    });

    expect(
      verifyColumnsInRsp(rsp.body.list[0], [{ title: 'SingleLineText' }]),
    ).to.equal(true);
  });

  it('List: fields, multiple', async function () {
    const rsp = await ncAxiosGet({
      query: { fields: ['SingleLineText', 'MultiLineText'] },
    });

    expect(
      verifyColumnsInRsp(rsp.body.list[0], [
        { title: 'SingleLineText' },
        { title: 'MultiLineText' },
      ]),
    ).to.equal(true);
  });

  it('List: sort, ascending', async function () {
    const sortColumn = columns.find((c) => c.title === 'SingleLineText');
    const rsp = await ncAxiosGet({
      query: { sort: 'SingleLineText', limit: 400 },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const sortedArray = rsp.body.list.map((r) => r[sortColumn.title]);
    expect(sortedArray).to.deep.equal(sortedArray.sort());
  });

  it('List: sort, descending', async function () {
    const sortColumn = columns.find((c) => c.title === 'SingleLineText');
    const rsp = await ncAxiosGet({
      query: { sort: '-SingleLineText', limit: 400 },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const descSortedArray = rsp.body.list.map((r) => r[sortColumn.title]);
    expect(descSortedArray).to.deep.equal(descSortedArray.sort().reverse());
  });

  it('List: sort, multiple', async function () {
    const rsp = await ncAxiosGet({
      query: {
        sort: ['-SingleLineText', '-MultiLineText'],
        limit: 400,
      },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    // Combination of SingleLineText & MultiLineText should be in descending order
    const sortedArray = rsp.body.list.map(
      (r) => r.SingleLineText + r.MultiLineText,
    );
    expect(sortedArray).to.deep.equal(sortedArray.sort().reverse());
  });

  it('List: filter, single', async function () {
    const rsp = await ncAxiosGet({
      query: {
        where: '(SingleLineText,eq,Afghanistan)',
        limit: 400,
      },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const filteredArray = rsp.body.list.map((r) => r.SingleLineText);
    expect(filteredArray).to.deep.equal(filteredArray.fill('Afghanistan'));
  });

  it('List: filter, multiple', async function () {
    const rsp = await ncAxiosGet({
      query: {
        where:
          '(SingleLineText,eq,Afghanistan)~and(MultiLineText,eq,Allahabad, India)',
        limit: 400,
      },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const filteredArray = rsp.body.list.map(
      (r) => r.SingleLineText + ' ' + r.MultiLineText,
    );
    expect(filteredArray).to.deep.equal(
      filteredArray.fill('Afghanistan Allahabad, India'),
    );
  });

  it('List: view ID', async function () {
    const gridView = await createView(context, {
      title: 'grid0',
      table,
      type: ViewTypes.GRID,
    });

    const fk_column_id = columns.find((c) => c.title === 'SingleLineText').id;
    await updateView(context, {
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
    let rsp = await ncAxiosGet({ query: { viewId: gridView.id } });
    expect(rsp.body.pageInfo.totalRows).to.equal(31);

    await updateView(context, {
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
      query: {
        viewId: gridView.id,
      },
    });
    expect(rsp.body.pageInfo.totalRows).to.equal(61);

    // Sort by SingleLineText
    await updateView(context, {
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
      query: {
        viewId: gridView.id,
      },
    });
    expect(rsp.body.pageInfo.totalRows).to.equal(61);

    // verify sorted order
    // Would contain all 'Afghanistan' as we have 31 records for it
    expect(
      verifyColumnsInRsp(
        rsp.body.list[0],
        columns.filter((c) => !isCreatedOrLastModifiedTimeCol(c) || !c.system),
      ),
    ).to.equal(true);
    const filteredArray = rsp.body.list.map((r) => r.SingleLineText);
    expect(filteredArray).to.deep.equal(filteredArray.fill('Afghanistan'));

    await updateView(context, {
      table,
      view: gridView,
      field: ['SingleLineText'],
    });

    // fetch records from view
    rsp = await ncAxiosGet({
      query: {
        viewId: gridView.id,
      },
    });
    const displayColumns = columns.filter(
      (c) =>
        c.title !== 'SingleLineText' &&
        (!isCreatedOrLastModifiedTimeCol(c) || !c.system),
    );
    expect(verifyColumnsInRsp(rsp.body.list[0], displayColumns)).to.equal(true);
  });

  async function prepareViewForTests() {
    const gridView = await createView(context, {
      title: 'grid0',
      table,
      type: ViewTypes.GRID,
    });

    const fk_column_id = columns.find((c) => c.title === 'SingleLineText').id;
    await updateView(context, {
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
      query: { viewId: gridView.id },
    });
    expect(rsp.body.pageInfo.totalRows).to.equal(61);
    const displayColumns = columns.filter(
      (c) =>
        c.title !== 'MultiLineText' &&
        c.title !== 'Email' &&
        !isCreatedOrLastModifiedTimeCol(c),
    );
    expect(verifyColumnsInRsp(rsp.body.list[0], displayColumns)).to.equal(true);
    return gridView;
  }

  it('List: view ID + sort', async function () {
    const gridView = await prepareViewForTests();

    const rsp = await ncAxiosGet({
      query: {
        viewId: gridView.id,
        sort: 'Url',
        limit: 100,
      },
    });
    const displayColumns = columns.filter(
      (c) =>
        c.title !== 'MultiLineText' &&
        c.title !== 'Email' &&
        !isCreatedOrLastModifiedTimeCol(c),
    );
    expect(rsp.body.pageInfo.totalRows).to.equal(61);
    expect(verifyColumnsInRsp(rsp.body.list[0], displayColumns)).to.equal(true);
    const sortedArray = rsp.body.list.map((r) => r['Url']);
    expect(sortedArray).to.deep.equal(sortedArray.sort());
  });

  it('List: view ID + filter', async function () {
    const gridView = await prepareViewForTests();

    const rsp = await ncAxiosGet({
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
    expect(rsp.body.pageInfo.totalRows).to.equal(7);
    expect(verifyColumnsInRsp(rsp.body.list[0], displayColumns)).to.equal(true);
    const filteredArray = rsp.body.list.map((r) => r['Phone']);
    expect(filteredArray).to.deep.equal(filteredArray.fill('1-541-754-3010'));
  });

  it('List: view ID + fields', async function () {
    const gridView = await prepareViewForTests();

    const rsp = await ncAxiosGet({
      query: {
        viewId: gridView.id,
        fields: ['Phone', 'MultiLineText', 'SingleLineText', 'Email'],
        limit: 100,
      },
    });
    expect(rsp.body.pageInfo.totalRows).to.equal(61);
    expect(
      verifyColumnsInRsp(rsp.body.list[0], [
        { title: 'Phone' },
        { title: 'SingleLineText' },
      ]),
    ).to.equal(true);
  });

  // Error handling
  it('List: invalid ID', async function () {
    // Invalid table ID
    await ncAxiosGet({
      url: `/api/v2/tables/123456789/records`,
      status: 404,
    });

    // Invalid view ID
    await ncAxiosGet({
      query: {
        viewId: '123456789',
      },
      status: 404,
    });
  });

  it('List: invalid limit & offset', async function () {
    const expectedPageInfo = {
      totalRows: 400,
      page: 1,
      pageSize: 25,
      isFirstPage: true,
      isLastPage: false,
    };

    // Invalid limit : falls back to default value
    let rsp = await ncAxiosGet({
      query: {
        limit: -100,
      },
      status: 200,
    });
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);

    rsp = await ncAxiosGet({
      query: {
        limit: 'abc',
      },
      status: 200,
    });
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);

    // Invalid offset : falls back to default value
    rsp = await ncAxiosGet({
      query: {
        offset: -100,
      },
      status: 200,
    });
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);

    rsp = await ncAxiosGet({
      query: {
        offset: 'abc',
      },
      status: 200,
    });
    expect(rsp.body.pageInfo).to.deep.equal(expectedPageInfo);

    // Offset > totalRows : returns empty list
    rsp = await ncAxiosGet({
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
      query: {
        sort: 'abc',
      },
      status: 404,
    });
    await ncAxiosGet({
      query: {
        where: 'abc',
      },
      status: 422,
    });
    await ncAxiosGet({
      query: {
        fields: 'abc',
      },
      status: 404,
    });
  });

  /////////////////////////////////////////////////////////////////////////////

  // CREATE
  //

  /////////////////////////////////////////////////////////////////////////////
  const newRecord = {
    SingleLineText: 'abc',
    MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
    Email: 'a@b.com',
    Url: 'https://www.abc.com',
    Phone: '1-234-567-8910',
  };

  it('Create: all fields', async function () {
    const rsp = await ncAxiosPost({ body: newRecord });

    expect(rsp.body).to.deep.equal({ Id: 401 });
  });

  it('Create: few fields left out', async function () {
    const newRecord = {
      SingleLineText: 'abc',
      MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
    };
    const rsp = await ncAxiosPost({ body: newRecord });

    // fields left out should be null
    expect(rsp.body).to.deep.equal({ Id: 401 });
  });

  it('Create: bulk', async function () {
    const rsp = await ncAxiosPost({ body: [newRecord, newRecord, newRecord] });

    expect(rsp.body).to.deep.equal([{ Id: 401 }, { Id: 402 }, { Id: 403 }]);
  });

  // Error handling
  it('Create: invalid ID', async function () {
    // Invalid table ID
    await ncAxiosPost({
      url: `/api/v2/tables/123456789/records`,
      status: 404,
    });

    // Invalid data - create should not specify ID
    await ncAxiosPost({
      body: { ...newRecord, Id: 300 },
      status: 400,
    });
    // Invalid data - number instead of string
    // await ncAxiosPost({
    //   body: { ...newRecord, SingleLineText: 300 },
    //   status: 400,
    // });
  });

  // TBD : default value handling

  /////////////////////////////////////////////////////////////////////////////

  // READ
  //

  /////////////////////////////////////////////////////////////////////////////

  it('Read: all fields', async function () {
    const rsp = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/100`,
    });
  });

  it('Read: invalid ID', async function () {
    // Invalid table ID
    await ncAxiosGet({
      url: `/api/v2/tables/123456789/records/100`,
      status: 404,
    });
    // Invalid row ID
    await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/1000`,
      status: 404,
    });
  });

  /////////////////////////////////////////////////////////////////////////////

  // UPDATE
  //

  /////////////////////////////////////////////////////////////////////////////

  it('Update: all fields', async function () {
    const rsp = await ncAxiosPatch({
      body: [
        {
          Id: 1,
          ...newRecord,
        },
      ],
    });
    expect(rsp.body).to.deep.equal([{ Id: 1 }]);
  });

  it('Update: partial', async function () {
    const recordBeforeUpdate = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/1`,
      query: {
        fields: 'Id,SingleLineText,MultiLineText',
      },
    });

    const rsp = await ncAxiosPatch({
      body: [
        {
          Id: 1,
          SingleLineText: 'some text',
          MultiLineText: 'some more text',
        },
      ],
    });
    expect(rsp.body).to.deep.equal([{ Id: 1 }]);

    const recordAfterUpdate = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/1`,
      query: {
        fields: 'Id,SingleLineText,MultiLineText',
      },
    });
    expect(recordAfterUpdate.body).to.deep.equal({
      ...recordBeforeUpdate.body,
      SingleLineText: 'some text',
      MultiLineText: 'some more text',
    });
  });

  it('Update: bulk', async function () {
    const rsp = await ncAxiosPatch({
      body: [
        {
          Id: 1,
          SingleLineText: 'some text',
          MultiLineText: 'some more text',
        },
        {
          Id: 2,
          SingleLineText: 'some text',
          MultiLineText: 'some more text',
        },
      ],
    });
    expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);
  });

  // Error handling

  it('Update: invalid ID', async function () {
    // Invalid table ID
    await ncAxiosPatch({
      url: `/api/v2/tables/123456789/records`,
      body: { Id: 100, SingleLineText: 'some text' },
      status: 404,
    });
    // Invalid row ID
    await ncAxiosPatch({
      body: { Id: 123456789, SingleLineText: 'some text' },
      status: 404,
    });
  });

  /////////////////////////////////////////////////////////////////////////////

  // DELETE
  //

  /////////////////////////////////////////////////////////////////////////////

  it('Delete: single', async function () {
    const rsp = await ncAxiosDelete({ body: [{ Id: 1 }] });
    expect(rsp.body).to.deep.equal([{ Id: 1 }]);

    // check that it's gone
    await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/1`,
      status: 404,
    });
  });

  it('Delete: bulk', async function () {
    const rsp = await ncAxiosDelete({ body: [{ Id: 1 }, { Id: 2 }] });
    expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);

    // check that it's gone
    await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/1`,
      status: 404,
    });
    await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/2`,
      status: 404,
    });
  });

  // Error handling

  it('Delete: invalid ID', async function () {
    // Invalid table ID
    await ncAxiosDelete({
      url: `/api/v2/tables/123456789/records`,
      body: { Id: 100 },
      status: 404,
    });
    // Invalid row ID
    await ncAxiosDelete({ body: { Id: '123456789' }, status: 404 });
  });
}

function numberBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base, {
      table_name: 'numberBased',
      title: 'numberBased',
      columns: customColumns('numberBased'),
    });

    // retrieve column meta
    columns = await table.getColumns(ctx);

    // build records
    const rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      const row = {
        Number: rowMixedValue(columns[1], i),
        Decimal: rowMixedValue(columns[2], i),
        Currency: rowMixedValue(columns[3], i),
        Percent: rowMixedValue(columns[4], i),
        Duration: rowMixedValue(columns[5], i),
        Rating: rowMixedValue(columns[6], i),
      };
      rowAttributes.push(row);
    }

    // insert records
    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });

    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(insertedRecords.length).to.equal(400);
  });

  const records = [
    {
      Id: 1,
      Number: 33,
      Decimal: 33.3,
      Currency: 33.3,
      Percent: 33,
      Duration: 10,
      Rating: 0,
    },
    {
      Id: 2,
      Number: null,
      Decimal: 456.34,
      Currency: 456.34,
      Percent: null,
      Duration: 20,
      Rating: 1,
    },
    {
      Id: 3,
      Number: 456,
      Decimal: 333.3,
      Currency: 333.3,
      Percent: 456,
      Duration: 30,
      Rating: 2,
    },
    {
      Id: 4,
      Number: 333,
      Decimal: null,
      Currency: null,
      Percent: 333,
      Duration: 40,
      Rating: 3,
    },
    {
      Id: 5,
      Number: 267,
      Decimal: 267.5674,
      Currency: 267.5674,
      Percent: 267,
      Duration: 50,
      Rating: null,
    },
    {
      Id: 6,
      Number: 34,
      Decimal: 34,
      Currency: 34,
      Percent: 34,
      Duration: 60,
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
      Duration: 70,
      Rating: 5,
    },
    {
      Id: 9,
      Number: 44,
      Decimal: 44.2647,
      Currency: 44.2647,
      Percent: 44,
      Duration: 80,
      Rating: 0,
    },
    {
      Id: 10,
      Number: 33,
      Decimal: 33.98,
      Currency: 33.98,
      Percent: 33,
      Duration: 90,
      Rating: 1,
    },
  ];

  it('Number based- List & CRUD', async function () {
    // list 10 records
    let rsp = await ncAxiosGet({
      query: {
        limit: 10,
        fields: 'Id,Number,Decimal,Currency,Percent,Duration,Rating',
      },
    });
    const pageInfo = {
      totalRows: 400,
      page: 1,
      pageSize: 10,
      isFirstPage: true,
      isLastPage: false,
    };
    expect(rsp.body.pageInfo).to.deep.equal(pageInfo);
    expect(rsp.body.list).to.deep.equal(records);

    ///////////////////////////////////////////////////////////////////////////

    // insert 10 records
    // remove Id's from record array
    records.forEach((r) => delete r.Id);
    rsp = await ncAxiosPost({
      body: records,
    });

    // prepare array with 10 Id's, from 401 to 410
    const ids = [];
    for (let i = 401; i <= 410; i++) {
      ids.push({ Id: i });
    }
    expect(rsp.body).to.deep.equal(ids);

    ///////////////////////////////////////////////////////////////////////////

    // read record with Id 401
    rsp = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/401`,
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
      body: updatedRecords,
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );

    // verify updated records
    rsp = await ncAxiosGet({
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
      body: updatedRecords.map((record) => ({ Id: record.Id })),
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );
  });
}

function selectBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base, {
      table_name: 'selectBased',
      title: 'selectBased',
      columns: customColumns('selectBased'),
    });

    // retrieve column meta
    columns = await table.getColumns(ctx);

    // build records
    const rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      const row = {
        SingleSelect: rowMixedValue(columns[1], i),
        MultiSelect: rowMixedValue(columns[2], i),
      };
      rowAttributes.push(row);
    }

    // insert records
    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });

    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(insertedRecords.length).to.equal(400);
  });

  const records = [
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

  it('Select based- List & CRUD', async function () {
    // list 10 records
    let rsp = await ncAxiosGet({
      query: {
        limit: 10,
        fields: 'Id,SingleSelect,MultiSelect',
      },
    });
    const pageInfo = {
      totalRows: 400,
      page: 1,
      pageSize: 10,
      isFirstPage: true,
      isLastPage: false,
    };
    expect(rsp.body.pageInfo).to.deep.equal(pageInfo);
    expect(rsp.body.list).to.deep.equal(records);

    ///////////////////////////////////////////////////////////////////////////

    // insert 10 records
    // remove Id's from record array
    records.forEach((r) => delete r.Id);
    rsp = await ncAxiosPost({
      body: records,
    });

    // prepare array with 10 Id's, from 401 to 410
    const ids = [];
    for (let i = 401; i <= 410; i++) {
      ids.push({ Id: i });
    }
    expect(rsp.body).to.deep.equal(ids);

    ///////////////////////////////////////////////////////////////////////////

    // read record with Id 401
    rsp = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/401`,
      query: {
        fields: 'Id,SingleSelect,MultiSelect',
      },
    });
    expect(rsp.body).to.deep.equal({ Id: 401, ...records[0] });

    ///////////////////////////////////////////////////////////////////////////

    // update record with Id 401 to 404
    const updatedRecord = {
      SingleSelect: 'jan',
      MultiSelect: 'jan,feb,mar',
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
      body: updatedRecords,
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );

    // verify updated records
    rsp = await ncAxiosGet({
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
      body: updatedRecords.map((record) => ({ Id: record.Id })),
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );
  });
}

function dateBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base, {
      table_name: 'dateBased',
      title: 'dateBased',
      columns: customColumns('dateBased'),
    });

    // retrieve column meta
    columns = await table.getColumns(ctx);

    // build records
    // 800: one year before to one year after
    const rowAttributes = [];
    for (let i = 0; i < 800; i++) {
      const row = {
        Date: rowMixedValue(columns[1], i),
        DateTime: rowMixedValue(columns[2], i),
      };
      rowAttributes.push(row);
    }

    // insert records
    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });

    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 800
    expect(insertedRecords.length).to.equal(800);
  });

  it('Date based- List & CRUD', async function () {
    // list 10 records
    let rsp = await ncAxiosGet({
      query: {
        limit: 10,
      },
    });
    const pageInfo = {
      totalRows: 800,
      page: 1,
      pageSize: 10,
      isFirstPage: true,
      isLastPage: false,
    };

    expect(rsp.body.pageInfo).to.deep.equal(pageInfo);

    // extract first 10 records from inserted records
    const records = insertedRecords.slice(0, 10);
    expect(JSON.stringify(rsp.body.list)).to.deep.equal(
      JSON.stringify(records),
    );

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
      body: records,
    });

    // prepare array with 10 Id's, from 801 to 810
    const ids = [];
    for (let i = 801; i <= 810; i++) {
      ids.push({ Id: i });
    }
    expect(rsp.body).to.deep.equal(ids);

    ///////////////////////////////////////////////////////////////////////////

    // read record with Id 801
    rsp = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/801`,
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
      body: updatedRecords,
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );

    // verify updated records
    rsp = await ncAxiosGet({
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
      body: updatedRecords.map((record) => ({ Id: record.Id })),
    });
    expect(rsp.body).to.deep.equal(
      updatedRecords.map((record) => ({ Id: record.Id })),
    );
  });
}

function linkBased() {
  let tblCity: Model;
  let tblCountry: Model;
  let tblActor: Model;
  let tblFilm: Model;

  let columnsFilm;
  let columnsActor;
  let columnsCountry;
  let columnsCity;

  async function prepareRecords(title: string, count: number) {
    const records = [];
    for (let i = 1; i <= count; i++) {
      records.push({
        Id: i,
        [title]: `${title} ${i}`,
      });
    }
    return records;
  }

  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const columns = [
      {
        title: 'Title',
        column_name: 'Title',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    try {
      // Prepare City table
      columns[0].title = 'City';
      columns[0].column_name = 'City';
      tblCity = await createTable(context, base, {
        title: 'City',
        table_name: 'City',
        columns: customColumns('custom', columns),
      });
      const cityRecords = await prepareRecords('City', 100);

      // insert records
      await createBulkRows(context, {
        base,
        table: tblCity,
        values: cityRecords,
      });

      insertedRecords = await listRow({ base, table: tblCity });

      // Prepare Country table
      columns[0].title = 'Country';
      columns[0].column_name = 'Country';
      tblCountry = await createTable(context, base, {
        title: 'Country',
        table_name: 'Country',
        columns: customColumns('custom', columns),
      });
      const countryRecords = await prepareRecords('Country', 100);
      // insert records
      await createBulkRows(context, {
        base,
        table: tblCountry,
        values: countryRecords,
      });

      // Prepare Actor table
      columns[0].title = 'Actor';
      columns[0].column_name = 'Actor';
      tblActor = await createTable(context, base, {
        title: 'Actor',
        table_name: 'Actor',
        columns: customColumns('custom', columns),
      });
      const actorRecords = await prepareRecords('Actor', 100);
      await createBulkRows(context, {
        base,
        table: tblActor,
        values: actorRecords,
      });

      // Prepare Movie table
      columns[0].title = 'Film';
      columns[0].column_name = 'Film';
      tblFilm = await createTable(context, base, {
        title: 'Film',
        table_name: 'Film',
        columns: customColumns('custom', columns),
      });
      const filmRecords = await prepareRecords('Film', 100);
      await createBulkRows(context, {
        base,
        table: tblFilm,
        values: filmRecords,
      });

      // Create links
      // Country <hm> City
      await createLtarColumn(context, {
        title: 'Cities',
        parentTable: tblCountry,
        childTable: tblCity,
        type: 'hm',
      });
      await createLtarColumn(context, {
        title: 'Films',
        parentTable: tblActor,
        childTable: tblFilm,
        type: 'mm',
      });

      columnsFilm = await tblFilm.getColumns(ctx);
      columnsActor = await tblActor.getColumns(ctx);
      columnsCountry = await tblCountry.getColumns(ctx);
      columnsCity = await tblCity.getColumns(ctx);
    } catch (e) {
      console.log(e);
    }
  });

  function getColumnId(columns, title: string) {
    return columns.find((c) => c.title === title).id;
  }

  it('Has-Many ', async function () {
    // Create hm link between Country and City
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5],
      status: 201,
    });

    // verify in Country table
    let rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
    });

    // page Info
    const pageInfo = {
      totalRows: 5,
      page: 1,
      pageSize: 25,
      isFirstPage: true,
      isLastPage: true,
    };
    expect(rsp.body.pageInfo).to.deep.equal(pageInfo);

    // links
    expect(rsp.body.list).to.deep.equal([
      { Id: 1, City: 'City 1' },
      { Id: 2, City: 'City 2' },
      { Id: 3, City: 'City 3' },
      { Id: 4, City: 'City 4' },
      { Id: 5, City: 'City 5' },
    ]);

    ///////////////////////////////////////////////////////////////////

    // verify in City table
    for (let i = 1; i <= 10; i++) {
      rsp = await ncAxiosLinkGet({
        urlParams: {
          tableId: tblCity.id,
          linkId: getColumnId(columnsCity, 'Country'),
          rowId: i,
        },
      });
      if (i <= 5) {
        expect(rsp.body).to.deep.equal({
          Id: 1,
          Country: `Country 1`,
        });
      } else {
        expect(rsp.body).to.deep.equal({});
      }
    }

    // Update hm link between Country and City
    // List them for a record & verify in both tables
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
      body: [6, 7],
    });

    // verify in Country table
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
    });
    expect(rsp.body.list).to.deep.equal([
      { Id: 1, City: 'City 1' },
      { Id: 2, City: 'City 2' },
      { Id: 3, City: 'City 3' },
      { Id: 4, City: 'City 4' },
      { Id: 5, City: 'City 5' },
      { Id: 6, City: 'City 6' },
      { Id: 7, City: 'City 7' },
    ]);

    // verify in City table
    for (let i = 1; i <= 10; i++) {
      rsp = await ncAxiosLinkGet({
        urlParams: {
          tableId: tblCity.id,
          linkId: getColumnId(columnsCity, 'Country'),
          rowId: i,
        },
      });
      if (i <= 7) {
        expect(rsp.body).to.deep.equal({
          Id: 1,
          Country: `Country 1`,
        });
      } else {
        expect(rsp.body).to.deep.equal({});
      }
    }

    // Delete hm link between Country and City
    // List them for a record & verify in both tables
    await ncAxiosLinkRemove({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
      body: [1, 3, 5, 7],
    });

    // verify in Country table
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
    });
    expect(rsp.body.list).to.deep.equal([
      { Id: 2, City: 'City 2' },
      { Id: 4, City: 'City 4' },
      { Id: 6, City: 'City 6' },
    ]);
    // verify in City table
    for (let i = 1; i <= 10; i++) {
      rsp = await ncAxiosLinkGet({
        urlParams: {
          tableId: tblCity.id,
          linkId: getColumnId(columnsCity, 'Country'),
          rowId: i,
        },
      });

      if (i % 2 === 0 && i <= 6) {
        expect(rsp.body).to.deep.equal({
          Id: 1,
          Country: `Country 1`,
        });
      } else {
        expect(rsp.body).to.deep.equal({});
      }
    }
  });

  // Create mm link between Actor and Film
  // List them for a record & verify in both tables

  function initArraySeq(i, count) {
    return Array.from({ length: count }, (_, index) => i + index);
  }

  it('Create Many-Many ', async function () {
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
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
        rowId: 1,
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
    let rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
    });

    // page info
    const pageInfo = {
      totalRows: 20,
      page: 1,
      pageSize: 25,
      isFirstPage: true,
      isLastPage: true,
    };
    expect(rsp.body.pageInfo).to.deep.equal(pageInfo);

    // Links
    expect(rsp.body.list.length).to.equal(20);
    rsp.body.list.sort((a, b) => a.Id - b.Id);
    for (let i = 1; i <= 20; i++) {
      expect(rsp.body.list[i - 1]).to.deep.equal({
        Id: i,
        Film: `Film ${i}`,
      });
    }

    // Second record
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 2,
      },
    });
    expect(rsp.body.list.length).to.equal(1);
    expect(rsp.body.list.sort((a, b) => a.Id - b.Id)[0]).to.deep.equal({
      Id: 1,
      Film: `Film 1`,
    });

    // verify in Film table
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblFilm.id,
        linkId: getColumnId(columnsFilm, 'Actors'),
        rowId: 1,
      },
    });
    expect(rsp.body.list.length).to.equal(20);
    rsp.body.list.sort((a, b) => a.Id - b.Id);
    for (let i = 1; i <= 20; i++) {
      expect(rsp.body.list[i - 1]).to.deep.equal({
        Id: i,
        Actor: `Actor ${i}`,
      });
    }

    // Update mm link between Actor and Film
    // List them for a record & verify in both tables
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
      body: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    });

    // verify in Actor table
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
    });
    expect(rsp.body.list.length).to.equal(25);
    rsp.body.list.sort((a, b) => a.Id - b.Id);
    // paginated response, limit to 25
    /* TODO enable this after fix
    for (let i = 1; i <= 25; i++) {
      expect(rsp.body.list[i - 1]).to.deep.equal({
        Id: i,
        Film: `Film ${i}`,
      });
    }
    */

    // verify in Film table
    for (let i = 21; i <= 30; i++) {
      const rsp = await ncAxiosLinkGet({
        urlParams: {
          tableId: tblFilm.id,
          linkId: getColumnId(columnsFilm, 'Actors'),
          rowId: i,
        },
      });
      expect(rsp.body.list.length).to.equal(1);
      rsp.body.list.sort((a, b) => a.Id - b.Id);
      expect(rsp.body.list[0]).to.deep.equal({
        Id: 1,
        Actor: `Actor 1`,
      });
    }

    // Delete mm link between Actor and Film
    // List them for a record & verify in both tables
    await ncAxiosLinkRemove({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
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

    // verify in Actor table
    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
    });
    expect(rsp.body.list.length).to.equal(15);
    rsp.body.list.sort((a, b) => a.Id - b.Id);
    for (let i = 2; i <= 30; i += 2) {
      expect(rsp.body.list[i / 2 - 1]).to.deep.equal({
        Id: i,
        Film: `Film ${i}`,
      });
    }

    // verify in Film table
    for (let i = 2; i <= 30; i++) {
      const rsp = await ncAxiosLinkGet({
        urlParams: {
          tableId: tblFilm.id,
          linkId: getColumnId(columnsFilm, 'Actors'),
          rowId: i,
        },
      });
      if (i % 2 === 0) {
        expect(rsp.body.list.length).to.equal(1);
        rsp.body.list.sort((a, b) => a.Id - b.Id);
        expect(rsp.body.list[0]).to.deep.equal({
          Id: 1,
          Actor: `Actor 1`,
        });
      } else {
        expect(rsp.body.list.length).to.equal(0);
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
        rowId: 1,
      },
      body: [{ Id: 1 }, { Id: 2 }, { Id: 3 }],
    });

    // update the link
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 2,
      },
      body: [{ Id: 2 }, { Id: 3 }],
    });

    // verify record 1
    let rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
    });
    expect(rsp.body.list.length).to.equal(1);
    expect(rsp.body.list).to.deep.equal([{ Id: 1, City: 'City 1' }]);

    rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 2,
      },
    });
    expect(rsp.body.list.length).to.equal(2);
    expect(rsp.body.list).to.deep.equal([
      { Id: 2, City: 'City 2' },
      { Id: 3, City: 'City 3' },
    ]);
  });

  // limit & offset verification
  it('Limit & offset verification', async function () {
    // add a link
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
      body: initArraySeq(1, 50),
    });

    // verify record 1
    let rsp = await ncAxiosLinkGet({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
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
        rowId: 1,
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
        rowId: 1,
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
    await ncAxiosLinkAdd({
      ...validParams,
      urlParams: { ...validParams.urlParams, tableId: 9999 },
      status: 404,
    });

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
      status: 201,
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
      status: 404,
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
      console.log('Link Remove: Invalid body parameter - empty body : ignore');
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
        console.log('Link Remove: Invalid body parameter - repeated row id');
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
      status: 404,
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
      console.log('Link List: Invalid query parameter - limit > total records');
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
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    };

    await nestedAddTests(validParams);
  });

  it('Error handling : HM: Nested REMOVE', async function () {
    // Prepare data
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
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
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
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
        rowId: 1,
      },
      body: [1],
      status: 201,
    };

    await nestedAddTests(validParams, 'bt');
  });

  it('Error handling : BT: Nested REMOVE', async function () {
    // Prepare data
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblCity.id,
        linkId: getColumnId(columnsCity, 'Country'),
        rowId: 1,
      },
      body: [1],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblCity.id,
        linkId: getColumnId(columnsCity, 'Country'),
        rowId: 1,
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
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblCity.id,
        linkId: getColumnId(columnsCity, 'Country'),
        rowId: 1,
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
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    };

    await nestedAddTests(validParams);
  });

  it('Error handling : MM: Nested REMOVE', async function () {
    // Prepare data
    await ncAxiosLinkAdd({
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblCountry.id,
        linkId: getColumnId(columnsCountry, 'Cities'),
        rowId: 1,
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
        rowId: 1,
      },
      body: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: 201,
    });

    const validParams = {
      urlParams: {
        tableId: tblActor.id,
        linkId: getColumnId(columnsActor, 'Films'),
        rowId: 1,
      },
      query: {
        offset: 0,
        limit: 10,
      },
      status: 200,
    };

    await nestedListTests(validParams);
  });
}

function userFieldBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init(false, 'creator');
    base = await createProject(context);
    ctx = {
      workspace_id: context.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base, {
      table_name: 'userBased',
      title: 'userBased',
      columns: customColumns('userBased'),
    });

    // retrieve column meta
    columns = await table.getColumns(ctx);

    // add users to workspace
    const users = [
      'a@nocodb.com',
      'b@nocodb.com',
      'c@nocodb.com',
      'd@nocodb.com',
      'e@nocodb.com',
    ];
    for (const email of users) {
      await addUsers(email);
    }
    const userList = await getUsers();
    userList[userList.length] = { email: null };
    userList[userList.length] = { email: '' };

    // build records
    const rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      const row = {
        userFieldSingle: [{ email: userList[i % userList.length].email }],
        userFieldMulti: [
          { email: userList[i % userList.length].email },
          { email: userList[(i + 1) % userList.length].email },
        ],
      };
      rowAttributes.push(row);
    }

    // insert records
    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });

    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(insertedRecords.length).to.equal(400);
  });

  async function addUsers(email) {
    const response = await request(context.app)
      .post('/api/v1/auth/user/signup')
      .send({ email, password: defaultUserArgs.password })
      .expect(200);

    const token = response.body.token;
    expect(token).to.be.a('string');

    // invite users to workspace
    if (process.env.EE === 'true') {
      const rsp = await request(context.app)
        .post(`/api/v1/workspaces/${context.fk_workspace_id}/invitations`)
        .set('xc-auth', context.token)
        .send({ email, roles: WorkspaceUserRoles.VIEWER });
      console.log(rsp);
    }
  }

  async function getUsers() {
    const response = await request(context.app)
      .get(`/api/v2/meta/bases/${base.id}/users`)
      .set('xc-auth', context.token);

    expect(response.body).to.have.keys(['users']);
    expect(response.body.users.list).to.have.length(6);
    return response.body.users.list;
  }

  it('List records', async function () {
    // retrieve inserted records
    insertedRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(insertedRecords.length).to.equal(400);
    expect(insertedRecords[0].userFieldSingle[0]).to.have.keys([
      'email',
      'id',
      'display_name',
      'meta'
    ]);
    expect(insertedRecords[0].userFieldMulti[0]).to.have.keys([
      'email',
      'id',
      'display_name',
      'meta'
    ]);
  });

  it('List: sort, ascending', async function () {
    const sortColumn = columns.find((c) => c.title === 'userFieldSingle');
    const rsp = await ncAxiosGet({
      query: { sort: 'userFieldSingle', limit: 400 },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const sortedArray = rsp.body.list.map((r) => r[sortColumn.title]);
    expect(sortedArray).to.deep.equal(
      sortedArray.sort((a, b) => {
        const emailA = a ? a[0]?.email?.toLowerCase() : '';
        const emailB = b ? b[0]?.email?.toLowerCase() : '';

        if (emailA < emailB) {
          return -1;
        }
        if (emailA > emailB) {
          return 1;
        }

        // Emails are equal, no change in order
        return 0;
      }),
    );
  });

  it('List: filter, single', async function () {
    const userList = await getUsers();
    const rsp = await ncAxiosGet({
      query: {
        where: `(userFieldSingle,eq,${userList[2].id})`,
        limit: 400,
      },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const filteredArray = rsp.body.list.map((r) => r.userFieldSingle);
    expect(filteredArray).to.deep.equal(filteredArray.fill(userList[2]));
  });

  it('List: sort, ascending for user multi field', async function () {
    const sortColumn = columns.find((c) => c.title === 'userFieldMulti');
    const rsp = await ncAxiosGet({
      query: { sort: 'userFieldMulti', limit: 400 },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    const sortedArray = rsp.body.list.map((r) => r[sortColumn.title]);
    expect(sortedArray).to.deep.equal(
      sortedArray.sort((a, b) => {
        const emailA = a ? a[0]?.email?.toLowerCase() : '';
        const emailB = b ? b[0]?.email?.toLowerCase() : '';

        if (emailA < emailB) {
          return -1;
        }
        if (emailA > emailB) {
          return 1;
        }

        // Emails are equal, no change in order
        return 0;
      }),
    );
  });

  it('List: filter, user multi field', async function () {
    const userList = await getUsers();
    const rsp = await ncAxiosGet({
      query: {
        where: `(userFieldMulti,anyof,${userList[2].id})`,
        limit: 400,
      },
    });

    expect(verifyColumnsInRsp(rsp.body.list[0], columns)).to.equal(true);
    expect(rsp.body.list.length).to.equal(100);
  });

  it('Create record : using email', async function () {
    const newRecord = {
      userFieldSingle: 'a@nocodb.com',
      userFieldMulti: 'a@nocodb.com,b@nocodb.com',
    };
    const rsp = await ncAxiosPost({ body: newRecord });
    expect(rsp.body).to.deep.equal({ Id: 401 });

    const record = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/401`,
    });
    expect(record.body.Id).to.equal(401);
    expect(record.body.userFieldSingle[0].email).to.equal('a@nocodb.com');
    expect(record.body.userFieldMulti[0].email).to.equal('a@nocodb.com');
    expect(record.body.userFieldMulti[1].email).to.equal('b@nocodb.com');
  });

  it('Create record : using ID', async function () {
    const userList = await getUsers();

    const id0 = userList.find((u) => u.email === 'test@example.com').id;
    const id1 = userList.find((u) => u.email === 'a@nocodb.com').id;

    const newRecord = {
      userFieldSingle: id0,
      userFieldMulti: `${id0},${id1}`,
    };
    const rsp = await ncAxiosPost({ body: newRecord });
    expect(rsp.body).to.deep.equal({ Id: 401 });

    const record = await ncAxiosGet({
      url: `/api/v2/tables/${table.id}/records/401`,
    });
    expect(record.body.Id).to.equal(401);
    expect(record.body.userFieldSingle[0].email).to.equal('test@example.com');
    expect(record.body.userFieldMulti[0].email).to.equal('test@example.com');
    expect(record.body.userFieldMulti[1].email).to.equal('a@nocodb.com');
  });

  it('Create record : duplicate ID', async function () {
    const userList = await getUsers();

    const newRecord1 = {
      userFieldSingle: userList[0].id,
      userFieldMulti: `${userList[0].id},${userList[0].id}`,
    };
    const rsp = await ncAxiosPost({ body: newRecord1, status: 422 });
    expect(rsp.body.msg).to.equal('Duplicate users not allowed for user field');

    const newRecord2 = {
      userFieldSingle: `${userList[0].id},${userList[1].id}`,
      userFieldMulti: `${userList[0].id},${userList[1].id}`,
    };
    const rsp2 = await ncAxiosPost({ body: newRecord2, status: 422 });
    expect(rsp2.body.msg).to.equal(
      "Multiple users not allowed for 'userFieldSingle'",
    );
  });
}

///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////

export default function () {
  // standalone tables
  describe('Text based', textBased);
  describe('Numerical', numberBased);
  describe('Select based', selectBased);
  describe('Date based', dateBased);
  describe('Link based', linkBased);
  describe('User field based', userFieldBased);
  // based out of Sakila db, for link based tests
  describe('General', generalDb);
}

///////////////////////////////////////////////////////////////////////////////
