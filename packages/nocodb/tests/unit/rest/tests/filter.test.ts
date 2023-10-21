import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../init';
import { createProject } from '../../factory/base';
import Base from '~/models/Base';
import { createTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import Model from '../../../../src/models/Model';

const debugMode = true;

// Test case list

async function retrieveRecordsAndValidate(
  filter: {
    comparison_op: string;
    value: string;
    fk_column_id: any;
    status: string;
    logical_op: string;
  },
  title: string,
) {
  let expectedRecords = [];
  let toFloat = false;
  if (
    ['Number', 'Decimal', 'Currency', 'Percent', 'Duration', 'Rating'].includes(
      title,
    )
  ) {
    toFloat = true;
  }

  // case for all comparison operators
  switch (filter.comparison_op) {
    case 'eq':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) ===
          (toFloat ? parseFloat(filter.value) : filter.value),
      );
      break;
    case 'neq':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) !==
          (toFloat ? parseFloat(filter.value) : filter.value),
      );
      break;
    case 'null':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] === null,
      );
      break;
    case 'notnull':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] !== null,
      );
      break;
    case 'empty':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] === '',
      );
      break;
    case 'notempty':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] !== '',
      );
      break;
    case 'like':
      expectedRecords = unfilteredRecords.filter((record) =>
        record[title]?.includes(filter.value),
      );
      break;
    case 'nlike':
      expectedRecords = unfilteredRecords.filter(
        (record) => !record[title]?.includes(filter.value),
      );
      break;
    case 'gt':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) >
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null,
      );
      break;
    case 'gte':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) >=
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null,
      );
      break;
    case 'lt':
      expectedRecords = unfilteredRecords.filter((record) =>
        title === 'Rating'
          ? (toFloat ? parseFloat(record[title]) : record[title]) <
              (toFloat ? parseFloat(filter.value) : filter.value) ||
            record[title] === null
          : (toFloat ? parseFloat(record[title]) : record[title]) <
              (toFloat ? parseFloat(filter.value) : filter.value) &&
            record[title] !== null,
      );
      break;
    case 'lte':
      expectedRecords = unfilteredRecords.filter((record) =>
        title === 'Rating'
          ? (toFloat ? parseFloat(record[title]) : record[title]) <=
              (toFloat ? parseFloat(filter.value) : filter.value) ||
            record[title] === null
          : (toFloat ? parseFloat(record[title]) : record[title]) <=
              (toFloat ? parseFloat(filter.value) : filter.value) &&
            record[title] !== null,
      );
      break;
    case 'anyof':
      expectedRecords = unfilteredRecords.filter((record) => {
        const values = filter.value.split(',');
        const recordValue = record[title]?.split(',');
        return values.some((value) => recordValue?.includes(value));
      });
      break;
    case 'nanyof':
      expectedRecords = unfilteredRecords.filter((record) => {
        const values = filter.value.split(',');
        const recordValue = record[title]?.split(',');
        return !values.some((value) => recordValue?.includes(value));
      });
      break;
    case 'allof':
      expectedRecords = unfilteredRecords.filter((record) => {
        const values = filter.value.split(',');
        return values.every((value) => record[title]?.includes(value));
      });
      break;
    case 'nallof':
      expectedRecords = unfilteredRecords.filter((record) => {
        const values = filter.value.split(',');
        return !values.every((value) => record[title]?.includes(value));
      });
      break;
  }

  // retrieve filtered records
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${base.id}/${table.id}`)
    .set('xc-auth', context.token)
    .query({
      filterArrJson: JSON.stringify([filter]),
    })
    .expect(200);

  // validate
  if (debugMode) {
    if (response.body.pageInfo.totalRows !== expectedRecords.length) {
      console.log(`Failed for filter: ${JSON.stringify(filter)}`);
      console.log(`Expected: ${expectedRecords.length}`);
      console.log(`Actual: ${response.body.pageInfo.totalRows}`);
      throw new Error('fix me!');
    }
    response.body.list.forEach((row, index) => {
      if (row[title] != expectedRecords[index][title]) {
        console.log(`Failed for filter: ${JSON.stringify(filter)}`);
        console.log(`Expected: ${expectedRecords[index][title]}`);
        console.log(`Actual: ${row[title]}`);
        throw new Error('fix me!');
      }
    });
  } else {
    expect(response.body.pageInfo.totalRows).to.equal(expectedRecords.length);
    response.body.list.forEach((row, index) => {
      expect(row[title] !== expectedRecords[index][title]);
    });
  }
}

let context;
let base: Base;
let table: Model;
let columns: any[];
let unfilteredRecords: any[] = [];

async function verifyFilters(dataType, columnId, filterList) {
  const filter = {
    fk_column_id: columnId,
    status: 'create',
    logical_op: 'and',
    comparison_op: '',
    value: '',
  };

  for (let i = 0; i < filterList.length; i++) {
    filter.comparison_op = filterList[i].comparison_op;
    filter.value = filterList[i].value;
    await retrieveRecordsAndValidate(filter, dataType);
  }
}

function filterTextBased() {
  // prepare data for test cases
  beforeEach(async function () {
    console.time('#### filterTextBased');
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base, {
      table_name: 'textBased',
      title: 'TextBased',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleLineText',
          title: 'SingleLineText',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'MultiLineText',
          title: 'MultiLineText',
          uidt: UITypes.LongText,
        },
        {
          column_name: 'Email',
          title: 'Email',
          uidt: UITypes.Email,
        },
        {
          column_name: 'Phone',
          title: 'Phone',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Url',
          title: 'Url',
          uidt: UITypes.URL,
        },
      ],
    });

    columns = await table.getColumns();

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

    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
    console.timeEnd('#### filterTextBased');
  });

  it('Type: Single Line Text', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'Afghanistan' },
      { comparison_op: 'neq', value: 'Afghanistan' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'empty', value: '' },
      // { comparison_op: 'notempty', value: '' },
      { comparison_op: 'like', value: 'Au' },
      { comparison_op: 'nlike', value: 'Au' },
    ];
    await verifyFilters('SingleLineText', columns[1].id, filterList);
  });

  it('Type: Multi Line Text', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'Aberdeen, United Kingdom' },
      { comparison_op: 'neq', value: 'Aberdeen, United Kingdom' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'empty', value: '' },
      // { comparison_op: 'notempty', value: '' },
      { comparison_op: 'like', value: 'abad' },
      { comparison_op: 'nlike', value: 'abad' },
    ];
    await verifyFilters('MultiLineText', columns[2].id, filterList);
  });

  it('Type: Email', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'leota@hotmail.com' },
      { comparison_op: 'neq', value: 'leota@hotmail.com' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'empty', value: '' },
      // { comparison_op: 'notempty', value: '' },
      { comparison_op: 'like', value: 'cox.net' },
      { comparison_op: 'nlike', value: 'cox.net' },
    ];
    await verifyFilters('Email', columns[3].id, filterList);
  });

  it('Type: Phone', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '504-621-8927' },
      { comparison_op: 'neq', value: '504-621-8927' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'empty', value: '' },
      // { comparison_op: 'notempty', value: '' },
      { comparison_op: 'like', value: '504' },
      { comparison_op: 'nlike', value: '504' },
    ];
    await verifyFilters('Phone', columns[4].id, filterList);
  });

  it('Type: Url', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'https://www.youtube.com' },
      { comparison_op: 'neq', value: 'https://www.youtube.com' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'empty', value: '' },
      // { comparison_op: 'notempty', value: '' },
      { comparison_op: 'like', value: 'e.com' },
      { comparison_op: 'nlike', value: 'e.com' },
    ];
    await verifyFilters('Url', columns[5].id, filterList);
  });
}

function filterNumberBased() {
  // prepare data for test cases
  beforeEach(async function () {
    console.time('#### filterNumberBased');
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base, {
      table_name: 'numberBased',
      title: 'numberBased',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'Number',
          title: 'Number',
          uidt: UITypes.Number,
        },
        {
          column_name: 'Decimal',
          title: 'Decimal',
          uidt: UITypes.Decimal,
        },
        {
          column_name: 'Currency',
          title: 'Currency',
          uidt: UITypes.Currency,
        },
        {
          column_name: 'Percent',
          title: 'Percent',
          uidt: UITypes.Percent,
        },
        {
          column_name: 'Duration',
          title: 'Duration',
          uidt: UITypes.Duration,
        },
        {
          column_name: 'Rating',
          title: 'Rating',
          uidt: UITypes.Rating,
        },
      ],
    });

    columns = await table.getColumns();

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

    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
    console.timeEnd('#### filterNumberBased');
  });

  it('Type: Number', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '33' },
      { comparison_op: 'neq', value: '33' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '44' },
      { comparison_op: 'gte', value: '44' },
      { comparison_op: 'lt', value: '44' },
      { comparison_op: 'lte', value: '44' },
    ];
    await verifyFilters('Number', columns[1].id, filterList);
  });

  it('Type: Decimal', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '33.3' },
      { comparison_op: 'neq', value: '33.3' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '44.26' },
      { comparison_op: 'gte', value: '44.26' },
      { comparison_op: 'lt', value: '44.26' },
      { comparison_op: 'lte', value: '44.26' },
    ];
    await verifyFilters('Decimal', columns[2].id, filterList);
  });

  it('Type: Currency', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '33.3' },
      { comparison_op: 'neq', value: '33.3' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '44.26' },
      { comparison_op: 'gte', value: '44.26' },
      { comparison_op: 'lt', value: '44.26' },
      { comparison_op: 'lte', value: '44.26' },
    ];
    await verifyFilters('Decimal', columns[3].id, filterList);
  });

  it('Type: Percent', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '33' },
      { comparison_op: 'neq', value: '33' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '44' },
      { comparison_op: 'gte', value: '44' },
      { comparison_op: 'lt', value: '44' },
      { comparison_op: 'lte', value: '44' },
    ];
    await verifyFilters('Percent', columns[4].id, filterList);
  });

  it('Type: Duration', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '10' },
      { comparison_op: 'neq', value: '10' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '50' },
      { comparison_op: 'gte', value: '50' },
      { comparison_op: 'lt', value: '50' },
      { comparison_op: 'lte', value: '50' },
    ];
    await verifyFilters('Duration', columns[5].id, filterList);
  });

  it('Type: Rating', async () => {
    const filterList = [
      { comparison_op: 'eq', value: '3' },
      { comparison_op: 'neq', value: '3' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'gt', value: '2' },
      { comparison_op: 'gte', value: '2' },
      { comparison_op: 'lt', value: '2' },
      { comparison_op: 'lte', value: '2' },
    ];
    await verifyFilters('Rating', columns[6].id, filterList);
  });
}

function filterSelectBased() {
  // prepare data for test cases
  beforeEach(async function () {
    console.time('#### filterSelectBased');
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base, {
      table_name: 'selectBased',
      title: 'selectBased',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleSelect',
          title: 'SingleSelect',
          uidt: UITypes.SingleSelect,
          dtxp: "'jan','feb','mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'",
        },
        {
          column_name: 'MultiSelect',
          title: 'MultiSelect',
          uidt: UITypes.MultiSelect,
          dtxp: "'jan','feb','mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'",
        },
      ],
    });

    columns = await table.getColumns();

    const rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      const row = {
        SingleSelect: rowMixedValue(columns[1], i),
        MultiSelect: rowMixedValue(columns[2], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
    console.time('#### filterSelectBased');
  });

  it('Type: Single select', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'jan' },
      { comparison_op: 'neq', value: 'jan' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'like', value: 'j' },
      { comparison_op: 'nlike', value: 'j' },
      { comparison_op: 'anyof', value: 'jan,feb,mar' },
      { comparison_op: 'nanyof', value: 'jan,feb,mar' },
    ];
    await verifyFilters('SingleSelect', columns[1].id, filterList);
  });

  it('Type: Multi select', async () => {
    const filterList = [
      { comparison_op: 'eq', value: 'jan,feb,mar' },
      { comparison_op: 'neq', value: 'jan,feb,mar' },
      { comparison_op: 'null', value: '' },
      { comparison_op: 'notnull', value: '' },
      { comparison_op: 'like', value: 'jan' },
      { comparison_op: 'nlike', value: 'jan' },
      { comparison_op: 'anyof', value: 'jan,feb,mar' },
      { comparison_op: 'nanyof', value: 'jan,feb,mar' },
      { comparison_op: 'allof', value: 'jan,feb,mar' },
      { comparison_op: 'nallof', value: 'jan,feb,mar' },
    ];
    await verifyFilters('MultiSelect', columns[2].id, filterList);
  });
}

async function applyDateFilter(filterParams, expectedRecords) {
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${base.id}/${table.id}`)
    .set('xc-auth', context.token)
    .query({
      filterArrJson: JSON.stringify([filterParams]),
    })
    .expect(200);
  // expect(response.body.pageInfo.totalRows).to.equal(expectedRecords);
  if (response.body.pageInfo.totalRows !== expectedRecords) {
    console.log('filterParams', filterParams);
    console.log(
      'response.body.pageInfo.totalRows',
      response.body.pageInfo.totalRows,
    );
    console.log('expectedRecords', expectedRecords);
  }
  return response.body.list;
}

function filterDateBased() {
  // prepare data for test cases
  beforeEach(async function () {
    console.time('#### filterDateBased');
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base, {
      table_name: 'dateBased',
      title: 'dateBased',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'Date',
          title: 'Date',
          uidt: UITypes.Date,
        },
      ],
    });

    columns = await table.getColumns();

    const rowAttributes = [];
    for (let i = 0; i < 800; i++) {
      const row = {
        Date: rowMixedValue(columns[1], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 800
    expect(unfilteredRecords.length).to.equal(800);
    console.time('#### filterDateBased');
  });

  it('Type: Date ', async () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const tomorrow = new Date(
      new Date().setDate(new Date().getDate() + 1),
    ).setHours(0, 0, 0, 0);
    const yesterday = new Date(
      new Date().setDate(new Date().getDate() - 1),
    ).setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(
      new Date().setDate(new Date().getDate() - 7),
    ).setHours(0, 0, 0, 0);
    const oneWeekFromNow = new Date(
      new Date().setDate(new Date().getDate() + 7),
    ).setHours(0, 0, 0, 0);
    const oneMonthAgo = new Date(
      new Date().setMonth(new Date().getMonth() - 1),
    ).setHours(0, 0, 0, 0);
    const oneMonthFromNow = new Date(
      new Date().setMonth(new Date().getMonth() + 1),
    ).setHours(0, 0, 0, 0);
    const daysAgo45 = new Date(
      new Date().setDate(new Date().getDate() - 45),
    ).setHours(0, 0, 0, 0);
    const daysFromNow45 = new Date(
      new Date().setDate(new Date().getDate() + 45),
    ).setHours(0, 0, 0, 0);
    const thisMonth15 = new Date(new Date().setDate(15)).setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(
      new Date().setFullYear(new Date().getFullYear() - 1),
    ).setHours(0, 0, 0, 0);
    const oneYearFromNow = new Date(
      new Date().setFullYear(new Date().getFullYear() + 1),
    ).setHours(0, 0, 0, 0);

    // records array with time set to 00:00:00; store time in unix epoch
    const recordsTimeSetToZero = unfilteredRecords.map((r) => {
      const date = new Date(r['Date']);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    const isFilterList = [
      {
        opSub: 'today',
        rowCount: recordsTimeSetToZero.filter((r) => r === today).length,
      },
      {
        opSub: 'tomorrow',
        rowCount: recordsTimeSetToZero.filter((r) => r === tomorrow).length,
      },
      {
        opSub: 'yesterday',
        rowCount: recordsTimeSetToZero.filter((r) => r === yesterday).length,
      },
      {
        opSub: 'oneWeekAgo',
        rowCount: recordsTimeSetToZero.filter((r) => r === oneWeekAgo).length,
      },
      {
        opSub: 'oneWeekFromNow',
        rowCount: recordsTimeSetToZero.filter((r) => r === oneWeekFromNow)
          .length,
      },
      {
        opSub: 'oneMonthAgo',
        rowCount: recordsTimeSetToZero.filter((r) => r === oneMonthAgo).length,
      },
      {
        opSub: 'oneMonthFromNow',
        rowCount: recordsTimeSetToZero.filter((r) => r === oneMonthFromNow)
          .length,
      },
      {
        opSub: 'daysAgo',
        value: 45,
        rowCount: recordsTimeSetToZero.filter((r) => r === daysAgo45).length,
      },
      {
        opSub: 'daysFromNow',
        value: 45,
        rowCount: recordsTimeSetToZero.filter((r) => r === daysFromNow45)
          .length,
      },
      {
        opSub: 'exactDate',
        value: new Date(thisMonth15).toISOString().split('T')[0],
        rowCount: recordsTimeSetToZero.filter((r) => r === thisMonth15).length,
      },
    ];

    // "is after" filter list
    const isAfterFilterList = [
      {
        opSub: 'today',
        rowCount: recordsTimeSetToZero.filter((r) => r > today).length,
      },
      {
        opSub: 'tomorrow',
        rowCount: recordsTimeSetToZero.filter((r) => r > tomorrow).length,
      },
      {
        opSub: 'yesterday',
        rowCount: recordsTimeSetToZero.filter((r) => r > yesterday).length,
      },
      {
        opSub: 'oneWeekAgo',
        rowCount: recordsTimeSetToZero.filter((r) => r > oneWeekAgo).length,
      },
      {
        opSub: 'oneWeekFromNow',
        rowCount: recordsTimeSetToZero.filter((r) => r > oneWeekFromNow).length,
      },
      {
        opSub: 'oneMonthAgo',
        rowCount: recordsTimeSetToZero.filter((r) => r > oneMonthAgo).length,
      },
      {
        opSub: 'oneMonthFromNow',
        rowCount: recordsTimeSetToZero.filter((r) => r > oneMonthFromNow)
          .length,
      },
      {
        opSub: 'daysAgo',
        value: 45,
        rowCount: recordsTimeSetToZero.filter((r) => r > daysAgo45).length,
      },
      {
        opSub: 'daysFromNow',
        value: 45,
        rowCount: recordsTimeSetToZero.filter((r) => r > daysFromNow45).length,
      },
      {
        opSub: 'exactDate',
        value: new Date().toISOString().split('T')[0],
        rowCount: recordsTimeSetToZero.filter((r) => r > today).length,
      },
    ];

    // "is within" filter list
    const isWithinFilterList = [
      {
        opSub: 'pastWeek',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= oneWeekAgo && r <= today,
        ).length,
      },
      {
        opSub: 'pastMonth',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= oneMonthAgo && r <= today,
        ).length,
      },
      {
        opSub: 'pastYear',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= oneYearAgo && r <= today,
        ).length,
      },
      {
        opSub: 'nextWeek',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= today && r <= oneWeekFromNow,
        ).length,
      },
      {
        opSub: 'nextMonth',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= today && r <= oneMonthFromNow,
        ).length,
      },
      {
        opSub: 'nextYear',
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= today && r <= oneYearFromNow,
        ).length,
      },
      {
        opSub: 'nextNumberOfDays',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= today && r <= daysFromNow45,
        ).length,
      },
      {
        opSub: 'pastNumberOfDays',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(
          (r) => r >= daysAgo45 && r <= today,
        ).length,
      },
    ];

    // rest of the filters (without subop type)
    const filterList = [
      {
        opType: 'blank',
        rowCount: unfilteredRecords.filter(
          (r) => r['Date'] === null || r['Date'] === '',
        ).length,
      },
      {
        opType: 'notblank',
        rowCount: unfilteredRecords.filter(
          (r) => r['Date'] !== null && r['Date'] !== '',
        ).length,
      },
    ];

    // is
    for (let i = 0; i < isFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'eq',
        comparison_sub_op: isFilterList[i].opSub,
        value: isFilterList[i].value,
      };
      await applyDateFilter(filter, isFilterList[i].rowCount);
    }

    // is not
    for (let i = 0; i < isFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'neq',
        comparison_sub_op: isFilterList[i].opSub,
        value: isFilterList[i].value,
      };
      await applyDateFilter(filter, 800 - isFilterList[i].rowCount);
    }

    // is before
    for (let i = 0; i < isAfterFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gt',
        comparison_sub_op: isAfterFilterList[i].opSub,
        value: isAfterFilterList[i].value,
      };
      await applyDateFilter(filter, isAfterFilterList[i].rowCount);
    }

    // is before or on
    for (let i = 0; i < isAfterFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'gte',
        comparison_sub_op: isAfterFilterList[i].opSub,
        value: isAfterFilterList[i].value,
      };
      await applyDateFilter(filter, isAfterFilterList[i].rowCount + 1);
    }

    // is after
    for (let i = 0; i < isAfterFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'lt',
        comparison_sub_op: isAfterFilterList[i].opSub,
        value: isAfterFilterList[i].value,
      };
      await applyDateFilter(filter, 800 - isAfterFilterList[i].rowCount - 1);
    }

    // is after or on
    for (let i = 0; i < isAfterFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'lte',
        comparison_sub_op: isAfterFilterList[i].opSub,
        value: isAfterFilterList[i].value,
      };
      await applyDateFilter(filter, 800 - isAfterFilterList[i].rowCount);
    }

    // is within
    for (let i = 0; i < isWithinFilterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: 'isWithin',
        comparison_sub_op: isWithinFilterList[i].opSub,
        value: isWithinFilterList[i].value,
      };
      await applyDateFilter(filter, isWithinFilterList[i].rowCount);
    }

    // rest of the filters (without subop type)
    for (let i = 0; i < filterList.length; i++) {
      const filter = {
        fk_column_id: columns[1].id,
        status: 'create',
        logical_op: 'and',
        comparison_op: filterList[i].opType,
        value: '',
      };
      await applyDateFilter(filter, filterList[i].rowCount);
    }
  });
}

export default function () {
  describe('Filter: Text based', filterTextBased);
  describe('Filter: Numerical', filterNumberBased);
  describe('Filter: Select based', filterSelectBased);
  describe('Filter: Date based', filterDateBased);
}
