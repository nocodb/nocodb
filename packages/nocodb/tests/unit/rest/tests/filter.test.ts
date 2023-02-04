import 'mocha';
import init from '../../init';
import { createProject } from '../../factory/project';
import Project from '../../../../src/lib/models/Project';
import { createTable } from '../../factory/table';
import { UITypes } from 'nocodb-sdk';
import { createBulkRows, rowMixedValue, listRow } from '../../factory/row';
import Model from '../../../../src/lib/models/Model';
import { expect } from 'chai';
import request from 'supertest';

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
  title: string
) {
  let expectedRecords = [];
  let toFloat = false;
  if (
    ['Number', 'Decimal', 'Currency', 'Percent', 'Duration', 'Rating'].includes(
      title
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
          (toFloat ? parseFloat(filter.value) : filter.value)
      );
      break;
    case 'neq':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) !==
          (toFloat ? parseFloat(filter.value) : filter.value)
      );
      break;
    case 'null':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] === null
      );
      break;
    case 'notnull':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] !== null
      );
      break;
    case 'empty':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] === ''
      );
      break;
    case 'notempty':
      expectedRecords = unfilteredRecords.filter(
        (record) => record[title] !== ''
      );
      break;
    case 'like':
      expectedRecords = unfilteredRecords.filter((record) =>
        record[title]?.includes(filter.value)
      );
      break;
    case 'nlike':
      expectedRecords = unfilteredRecords.filter(
        (record) => !record[title]?.includes(filter.value)
      );
      break;
    case 'gt':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) >
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null
      );
      break;
    case 'gte':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) >=
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null
      );
      break;
    case 'lt':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) <
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null
      );
      break;
    case 'lte':
      expectedRecords = unfilteredRecords.filter(
        (record) =>
          (toFloat ? parseFloat(record[title]) : record[title]) <=
            (toFloat ? parseFloat(filter.value) : filter.value) &&
          record[title] !== null
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
    .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
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
      if (row[title] !== expectedRecords[index][title]) {
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
let project: Project;
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
    context = await init();
    project = await createProject(context);
    table = await createTable(context, project, {
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

    let rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      let row = {
        SingleLineText: rowMixedValue(columns[1], i),
        MultiLineText: rowMixedValue(columns[2], i),
        Email: rowMixedValue(columns[3], i),
        Phone: rowMixedValue(columns[4], i),
        Url: rowMixedValue(columns[5], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ project, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
  });

  it('Type: Single Line Text', async () => {
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    context = await init();
    project = await createProject(context);
    table = await createTable(context, project, {
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

    let rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      let row = {
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
      project,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ project, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
  });

  it('Type: Number', async () => {
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    let filterList = [
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
    context = await init();
    project = await createProject(context);
    table = await createTable(context, project, {
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

    let rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      let row = {
        SingleSelect: rowMixedValue(columns[1], i),
        MultiSelect: rowMixedValue(columns[2], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ project, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
  });

  it('Type: Single select', async () => {
    let filterList = [
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
    let filterList = [
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

export default function () {
  describe('Filter: Text based', filterTextBased);
  describe('Filter: Numerical', filterNumberBased);
  describe('Filter: Select based', filterSelectBased);
}
