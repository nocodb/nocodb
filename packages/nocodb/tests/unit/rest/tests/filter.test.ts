import 'mocha';
import init from '../../init';
import { createProject } from '../../factory/project';
import Project from '../../../../src/lib/models/Project';
import { createTable } from '../../factory/table';
import { isSqlite } from '../../init/db';
import { UITypes } from 'nocodb-sdk';
import {
  createBulkRows,
  generateDefaultRowAttributes,
  generateMixedRowAttributes,
  rowMixedValue,
  listRow,
} from '../../factory/row';
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
  expectedRecords: any[],
  title: string
) {
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

function filterTextBased() {
  // let context;
  // let project: Project;
  // let table: Model;
  // let columns: any[];
  // let unfilteredRecords: any[] = [];

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

  // async function retrieveRecordsAndValidate(
  //   filter: {
  //     comparison_op: string;
  //     value: string;
  //     fk_column_id: any;
  //     status: string;
  //     logical_op: string;
  //   },
  //   expectedRecords: any[]
  // ) {
  //   // retrieve filtered records
  //   const response = await request(context.app)
  //     .get(`/api/v1/db/data/noco/${project.id}/${table.id}`)
  //     .set('xc-auth', context.token)
  //     .query({
  //       filterArrJson: JSON.stringify([filter]),
  //     })
  //     .expect(200);
  //
  //   // validate
  //   if (debugMode) {
  //     if (response.body.pageInfo.totalRows !== expectedRecords.length) {
  //       console.log(`Failed for filter: ${JSON.stringify(filter)}`);
  //       console.log(`Expected: ${expectedRecords.length}`);
  //       console.log(`Actual: ${response.body.pageInfo.totalRows}`);
  //       throw new Error('fix me!');
  //     }
  //     response.body.list.forEach((row, index) => {
  //       if (row[columns[1].title] !== expectedRecords[index].SingleLineText) {
  //         console.log(`Failed for filter: ${JSON.stringify(filter)}`);
  //         console.log(`Expected: ${expectedRecords[index].SingleLineText}`);
  //         console.log(`Actual: ${row[columns[1].title]}`);
  //         throw new Error('fix me!');
  //       }
  //     });
  //   } else {
  //     expect(response.body.pageInfo.totalRows).to.equal(expectedRecords.length);
  //     response.body.list.forEach((row, index) => {
  //       expect(row[columns[1].title] !== expectedRecords[index].SingleLineText);
  //     });
  //   }
  // }

  it('Type: Single Line Text', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const dataType = 'SingleLineText';

    const filter = {
      fk_column_id: columns[1].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'Afghanistan',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 'Afghanistan'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 'Afghanistan'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = 'Au';
    expectedRecords = unfilteredRecords.filter((record) =>
      record[dataType]?.includes('Au')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = 'Au';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record[dataType]?.includes('Au')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: LongText', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const dataType = 'MultiLineText';

    const filter = {
      fk_column_id: columns[2].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'Aberdeen, United Kingdom',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 'Aberdeen, United Kingdom'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 'Aberdeen, United Kingdom'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = 'abad';
    expectedRecords = unfilteredRecords.filter((record) =>
      record[dataType]?.includes('abad')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = 'abad';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record[dataType]?.includes('abad')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Email', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const dataType = 'Email';

    const filter = {
      fk_column_id: columns[3].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'leota@hotmail.com',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 'leota@hotmail.com'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 'leota@hotmail.com'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = 'cox.net';
    expectedRecords = unfilteredRecords.filter((record) =>
      record[dataType]?.includes('cox.net')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = 'cox.net';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record[dataType]?.includes('cox.net')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Phone', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const dataType = 'Phone';

    const filter = {
      fk_column_id: columns[4].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '504-621-8927',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === '504-621-8927'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== '504-621-8927'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = '504';
    expectedRecords = unfilteredRecords.filter((record) =>
      record[dataType]?.includes('504')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = '504';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record[dataType]?.includes('504')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: URL', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, empty, notempty, like, nlike

    const dataType = 'Url';

    const filter = {
      fk_column_id: columns[5].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: 'https://www.youtube.com',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 'https://www.youtube.com'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 'https://www.youtube.com'
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: empty
    filter.comparison_op = 'empty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === ''
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notempty
    filter.comparison_op = 'notempty';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== ''
    );
    //TBD await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: like
    filter.comparison_op = 'like';
    filter.value = 'e.com';
    expectedRecords = unfilteredRecords.filter((record) =>
      record[dataType]?.includes('e.com')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: nlike
    filter.comparison_op = 'nlike';
    filter.value = 'e.com';
    expectedRecords = unfilteredRecords.filter(
      (record) => !record[dataType]?.includes('e.com')
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
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
    // filter types to be verified
    // eq, neq, null, notnull, like, nlike, >, >=, <, <=

    const dataType = 'Number';

    const filter = {
      fk_column_id: columns[1].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '33',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 33
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 33
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >
    filter.comparison_op = 'gt';
    filter.value = '44';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] > 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >=
    filter.comparison_op = 'gte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] >= 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <
    filter.comparison_op = 'lt';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] < 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <=
    filter.comparison_op = 'lte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] <= 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Decimal', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, like, nlike, >, >=, <, <=

    const dataType = 'Decimal';

    const filter = {
      fk_column_id: columns[2].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '33.3',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => parseFloat(record[dataType]) === 33.3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => parseFloat(record[dataType]) !== 33.3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >
    filter.comparison_op = 'gt';
    filter.value = '44.26';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) > 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >=
    filter.comparison_op = 'gte';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) >= 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <
    filter.comparison_op = 'lt';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) < 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <=
    filter.comparison_op = 'lte';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) <= 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Currency', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, like, nlike, >, >=, <, <=

    const dataType = 'Currency';

    const filter = {
      fk_column_id: columns[3].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '33.3',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => parseFloat(record[dataType]) === 33.3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => parseFloat(record[dataType]) !== 33.3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >
    filter.comparison_op = 'gt';
    filter.value = '44.26';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) > 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >=
    filter.comparison_op = 'gte';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) >= 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <
    filter.comparison_op = 'lt';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) < 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <=
    filter.comparison_op = 'lte';
    expectedRecords = unfilteredRecords.filter(
      (record) =>
        parseFloat(record[dataType]) <= 44.26 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Percent', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, like, nlike, >, >=, <, <=

    const dataType = 'Percent';

    const filter = {
      fk_column_id: columns[4].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '33',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 33
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 33
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >
    filter.comparison_op = 'gt';
    filter.value = '44';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] > 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >=
    filter.comparison_op = 'gte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] >= 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <
    filter.comparison_op = 'lt';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] < 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <=
    filter.comparison_op = 'lte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] <= 44 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });

  it('Type: Rating', async () => {
    // filter types to be verified
    // eq, neq, null, notnull, like, nlike, >, >=, <, <=

    const dataType = 'Rating';

    const filter = {
      fk_column_id: columns[6].id,
      status: 'create',
      logical_op: 'and',
      comparison_op: 'eq',
      value: '3',
    };

    let expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === 3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: neq
    filter.comparison_op = 'neq';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== 3
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: null
    filter.comparison_op = 'null';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] === null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: notnull
    filter.comparison_op = 'notnull';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >
    filter.comparison_op = 'gt';
    filter.value = '2';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] > 2 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: >=
    filter.comparison_op = 'gte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] >= 2 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <
    filter.comparison_op = 'lt';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] < 2 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);

    // filter: <=
    filter.comparison_op = 'lte';
    expectedRecords = unfilteredRecords.filter(
      (record) => record[dataType] <= 2 && record[dataType] !== null
    );
    await retrieveRecordsAndValidate(filter, expectedRecords, dataType);
  });
}

export default function () {
  describe('Filter: Text based', filterTextBased);
  describe('Filter: Numerical', filterNumberBased);
}
